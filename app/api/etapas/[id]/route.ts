import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/permissions";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

const normalizarNome = (valor: string) => {
  return valor.trim().replace(/\s+/g, " ");
};

export async function GET(
  _request: NextRequest,
  context: RouteContext,
) {
  const permissao = await requirePermission("visualizar");

  if (!permissao.ok) {
    return NextResponse.json(
      {
        success: false,
        error: permissao.error,
      },
      { status: permissao.status },
    );
  }

  const { id } = await context.params;

  const supabase = await createClient();

  const { data: etapa, error } = await supabase
    .from("etapas")
    .select(
      `
        id,
        nome,
        descricao,
        ordem,
        ativo,
        created_at,
        updated_at
      `,
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("GET /api/etapas/[id]:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Não foi possível carregar a etapa.",
      },
      { status: 500 },
    );
  }

  if (!etapa) {
    return NextResponse.json(
      {
        success: false,
        error: "Etapa não encontrada.",
      },
      { status: 404 },
    );
  }

  return NextResponse.json({
    success: true,
    etapa,
  });
}

export async function PUT(
  request: NextRequest,
  context: RouteContext,
) {
  const permissao = await requirePermission("editar");

  if (!permissao.ok) {
    return NextResponse.json(
      {
        success: false,
        error: permissao.error,
      },
      { status: permissao.status },
    );
  }

  const { id } = await context.params;

  try {
    const body = await request.json();

    const nome = normalizarNome(String(body.nome ?? ""));

    const descricao =
      body.descricao !== undefined &&
      body.descricao !== null
        ? String(body.descricao).trim() || null
        : null;

    const ativo =
      body.ativo === undefined
        ? true
        : Boolean(body.ativo);

    const ordemRaw = Number(body.ordem);

    const ordem =
      Number.isFinite(ordemRaw) && ordemRaw > 0
        ? Math.floor(ordemRaw)
        : 0;

    if (!nome) {
      return NextResponse.json(
        {
          success: false,
          error: "Informe o nome da etapa.",
        },
        { status: 400 },
      );
    }

    if (nome.length > 120) {
      return NextResponse.json(
        {
          success: false,
          error:
            "O nome da etapa deve possuir no máximo 120 caracteres.",
        },
        { status: 400 },
      );
    }

    const supabase = await createClient();

    const { data: etapaAtual, error: etapaError } =
      await supabase
        .from("etapas")
        .select("id, nome")
        .eq("id", id)
        .maybeSingle();

    if (etapaError) {
      console.error(
        "PUT /api/etapas/[id] busca:",
        etapaError,
      );

      return NextResponse.json(
        {
          success: false,
          error: "Não foi possível localizar a etapa.",
        },
        { status: 500 },
      );
    }

    if (!etapaAtual) {
      return NextResponse.json(
        {
          success: false,
          error: "Etapa não encontrada.",
        },
        { status: 404 },
      );
    }

    const { data: etapaDuplicada, error: duplicadaError } =
      await supabase
        .from("etapas")
        .select("id, nome")
        .ilike("nome", nome)
        .neq("id", id)
        .maybeSingle();

    if (duplicadaError) {
      console.error(
        "PUT /api/etapas/[id] duplicidade:",
        duplicadaError,
      );

      return NextResponse.json(
        {
          success: false,
          error: "Não foi possível validar o nome da etapa.",
        },
        { status: 500 },
      );
    }

    if (etapaDuplicada) {
      return NextResponse.json(
        {
          success: false,
          error: "Já existe outra etapa com esse nome.",
        },
        { status: 409 },
      );
    }

    const { data: etapa, error } = await supabase
      .from("etapas")
      .update({
        nome,
        descricao,
        ordem,
        ativo,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select(
        `
          id,
          nome,
          descricao,
          ordem,
          ativo,
          created_at,
          updated_at
        `,
      )
      .single();

    if (error) {
      console.error("PUT /api/etapas/[id]:", error);

      return NextResponse.json(
        {
          success: false,
          error: "Não foi possível atualizar a etapa.",
          details: error.message,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      etapa,
    });
  } catch (error) {
    console.error(
      "PUT /api/etapas/[id] exception:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error: "Dados inválidos.",
      },
      { status: 400 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  context: RouteContext,
) {
  const permissao = await requirePermission("excluir");

  if (!permissao.ok) {
    return NextResponse.json(
      {
        success: false,
        error: permissao.error,
      },
      { status: permissao.status },
    );
  }

  const { id } = await context.params;

  const supabase = await createClient();

  const { data: etapa, error: etapaError } =
    await supabase
      .from("etapas")
      .select("id, nome")
      .eq("id", id)
      .maybeSingle();

  if (etapaError) {
    console.error(
      "DELETE /api/etapas/[id] busca:",
      etapaError,
    );

    return NextResponse.json(
      {
        success: false,
        error: "Não foi possível localizar a etapa.",
      },
      { status: 500 },
    );
  }

  if (!etapa) {
    return NextResponse.json(
      {
        success: false,
        error: "Etapa não encontrada.",
      },
      { status: 404 },
    );
  }

  const { count, error: projetosError } = await supabase
    .from("projetos")
    .select("id", {
      count: "exact",
      head: true,
    })
    .eq("etapa_id", id);

  if (projetosError) {
    console.error(
      "DELETE /api/etapas/[id] projetos:",
      projetosError,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Não foi possível verificar os projetos vinculados.",
      },
      { status: 500 },
    );
  }

  if ((count ?? 0) > 0) {
    return NextResponse.json(
      {
        success: false,
        error:
          `A etapa "${etapa.nome}" possui ${count} projeto(s) vinculado(s). ` +
          "Desative a etapa em vez de excluí-la.",
      },
      { status: 409 },
    );
  }

  const { error } = await supabase
    .from("etapas")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("DELETE /api/etapas/[id]:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Não foi possível excluir a etapa.",
        details: error.message,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    message: "Etapa excluída com sucesso.",
  });
}