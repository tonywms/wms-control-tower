import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/permissions";

const STATUS_VALIDOS = [
  "Previsto",
  "Em andamento",
  "Concluído",
  "Cancelado",
] as const;

type RouteContext = {
  params: Promise<{ id: string }>;
};

function texto(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function textoOuNull(value: unknown): string | null {
  const valor = texto(value);
  return valor || null;
}

function dataOuNull(value: unknown, campo: string): string | null {
  const valor = texto(value);
  if (!valor) return null;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    throw new Error(`${campo} inválida. Use o formato AAAA-MM-DD.`);
  }

  return valor;
}

function numeroInteiro(value: unknown, padrao = 0): number {
  if (value === null || value === undefined || value === "") {
    return padrao;
  }

  const numero = Number(value);

  if (!Number.isInteger(numero)) {
    throw new Error("A ordem do marco deve ser um número inteiro.");
  }

  return numero;
}

export async function GET(
  _request: NextRequest,
  context: RouteContext,
) {
  try {
    const permissao = await requirePermission("visualizar");

    if (!permissao.ok) {
      return NextResponse.json(
        { success: false, error: permissao.error },
        { status: permissao.status },
      );
    }

    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "ID do projeto não informado." },
        { status: 400 },
      );
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .from("projeto_marcos")
      .select(`
        id,
        projeto_id,
        nome,
        descricao,
        status,
        responsavel_id,
        data_prevista,
        data_realizada,
        ordem,
        criado_por,
        created_at,
        updated_at,
        responsavel:usuarios!projeto_marcos_responsavel_id_fkey (
          id,
          nome
        ),
        criador:usuarios!projeto_marcos_criado_por_fkey (
          id,
          nome
        )
      `)
      .eq("projeto_id", id)
      .order("ordem", { ascending: true })
      .order("data_prevista", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[GET /api/projetos/:id/marcos]", error);

      return NextResponse.json(
        {
          success: false,
          error: error.message,
          details: error.details ?? null,
          hint: error.hint ?? null,
          code: error.code ?? null,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      marcos: data ?? [],
    });
  } catch (error) {
    console.error(
      "[GET /api/projetos/:id/marcos] Erro inesperado:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Erro inesperado ao carregar marcos.",
      },
      { status: 500 },
    );
  }
}

export async function POST(
  request: NextRequest,
  context: RouteContext,
) {
  try {
    const permissao = await requirePermission("editar");

    if (!permissao.ok) {
      return NextResponse.json(
        { success: false, error: permissao.error },
        { status: permissao.status },
      );
    }

    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "ID do projeto não informado." },
        { status: 400 },
      );
    }

    const supabase = await createClient();

    const { data: projeto, error: projetoError } = await supabase
      .from("projetos")
      .select("id")
      .eq("id", id)
      .maybeSingle();

    if (projetoError) {
      return NextResponse.json(
        { success: false, error: projetoError.message },
        { status: 500 },
      );
    }

    if (!projeto) {
      return NextResponse.json(
        { success: false, error: "Projeto não encontrado." },
        { status: 404 },
      );
    }

    let body: Record<string, unknown>;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Corpo da requisição inválido." },
        { status: 400 },
      );
    }

    const nome = texto(body.nome);
    const descricao = textoOuNull(body.descricao);
    const status = texto(body.status) || "Previsto";
    const responsavelId = textoOuNull(body.responsavel_id);

    let dataPrevista: string | null;
    let dataRealizada: string | null;
    let ordem: number;

    try {
      dataPrevista = dataOuNull(body.data_prevista, "Data prevista");
      dataRealizada = dataOuNull(body.data_realizada, "Data realizada");
      ordem = numeroInteiro(body.ordem, 0);
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          error:
            error instanceof Error ? error.message : "Dados inválidos.",
        },
        { status: 400 },
      );
    }

    if (!nome) {
      return NextResponse.json(
        { success: false, error: "Informe o nome do marco." },
        { status: 400 },
      );
    }

    if (nome.length > 200) {
      return NextResponse.json(
        {
          success: false,
          error: "O nome do marco deve possuir no máximo 200 caracteres.",
        },
        { status: 400 },
      );
    }

    if (
      !STATUS_VALIDOS.includes(
        status as (typeof STATUS_VALIDOS)[number],
      )
    ) {
      return NextResponse.json(
        { success: false, error: "Status do marco inválido." },
        { status: 400 },
      );
    }

    if (status === "Concluído" && !dataRealizada) {
      dataRealizada = new Date().toISOString().slice(0, 10);
    }

    if (status !== "Concluído") {
      dataRealizada = null;
    }

    const { data, error } = await supabase
      .from("projeto_marcos")
      .insert({
        projeto_id: id,
        nome,
        descricao,
        status,
        responsavel_id: responsavelId,
        data_prevista: dataPrevista,
        data_realizada: dataRealizada,
        ordem,
        criado_por: permissao.usuario.usuarioId,
      })
      .select(`
        id,
        projeto_id,
        nome,
        descricao,
        status,
        responsavel_id,
        data_prevista,
        data_realizada,
        ordem,
        criado_por,
        created_at,
        updated_at
      `)
      .single();

    if (error) {
      console.error("[POST /api/projetos/:id/marcos]", error);

      return NextResponse.json(
        {
          success: false,
          error: error.message,
          details: error.details ?? null,
          hint: error.hint ?? null,
          code: error.code ?? null,
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Marco criado com sucesso.",
        marco: data,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error(
      "[POST /api/projetos/:id/marcos] Erro inesperado:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Erro inesperado ao criar marco.",
      },
      { status: 500 },
    );
  }
}
