import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/permissions";

const normalizarNome = (valor: string) => {
  return valor.trim().replace(/\s+/g, " ");
};

export async function GET(request: NextRequest) {
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

  const supabase = await createClient();

  const searchParams = request.nextUrl.searchParams;

  const search = searchParams.get("search")?.trim() ?? "";
  const includeInactive =
    searchParams.get("includeInactive") === "true";

  let query = supabase
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
    .order("ordem", { ascending: true })
    .order("nome", { ascending: true });

  if (!includeInactive) {
    query = query.eq("ativo", true);
  }

  if (search) {
    query = query.or(
      `nome.ilike.%${search}%,descricao.ilike.%${search}%`,
    );
  }

  const { data, error } = await query;

  if (error) {
    console.error("GET /api/etapas:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Não foi possível carregar as etapas.",
        details: error.message,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    etapas: data ?? [],
  });
}

export async function POST(request: NextRequest) {
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

    const { data: etapaExistente, error: buscaError } =
      await supabase
        .from("etapas")
        .select("id, nome")
        .ilike("nome", nome)
        .maybeSingle();

    if (buscaError) {
      console.error(
        "POST /api/etapas busca:",
        buscaError,
      );

      return NextResponse.json(
        {
          success: false,
          error: "Não foi possível validar a etapa.",
        },
        { status: 500 },
      );
    }

    if (etapaExistente) {
      return NextResponse.json(
        {
          success: false,
          error: "Já existe uma etapa com esse nome.",
        },
        { status: 409 },
      );
    }

    const { data: etapa, error } = await supabase
      .from("etapas")
      .insert({
        nome,
        descricao,
        ordem,
        ativo,
        updated_at: new Date().toISOString(),
      })
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
      console.error("POST /api/etapas:", error);

      return NextResponse.json(
        {
          success: false,
          error: "Não foi possível criar a etapa.",
          details: error.message,
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        etapa,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/etapas exception:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Dados inválidos.",
      },
      { status: 400 },
    );
  }
}