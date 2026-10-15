import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/permissions";

const TIPOS_VALIDOS = ["Pendência", "Impedimento"] as const;
const PRIORIDADES_VALIDAS = ["Baixa", "Normal", "Alta", "Crítica"] as const;
const STATUS_VALIDOS = [
  "Pendente",
  "Em andamento",
  "Concluída",
  "Cancelada",
] as const;

type RouteContext = {
  params: Promise<{ id: string }>;
};

function texto(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function textoOuNull(value: unknown): string | null {
  const valueText = texto(value);
  return valueText ? valueText : null;
}

function dataOuNull(value: unknown): string | null {
  const valueText = texto(value);
  if (!valueText) return null;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(valueText)) {
    throw new Error("Prazo inválido. Use o formato AAAA-MM-DD.");
  }

  return valueText;
}

async function projetoExiste(id: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("projetos")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return Boolean(data);
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
      .from("projeto_pendencias")
      .select(`
        id,
        projeto_id,
        titulo,
        descricao,
        tipo,
        prioridade,
        status,
        responsavel_id,
        prazo,
        concluida_em,
        criado_por,
        created_at,
        updated_at,
        responsavel:usuarios!projeto_pendencias_responsavel_id_fkey (
          id,
          nome
        ),
        criador:usuarios!projeto_pendencias_criado_por_fkey (
          id,
          nome
        )
      `)
      .eq("projeto_id", id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(
        "[GET /api/projetos/:id/pendencias]",
        error,
      );

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
      pendencias: data ?? [],
    });
  } catch (error) {
    console.error(
      "[GET /api/projetos/:id/pendencias] Erro inesperado:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Erro inesperado ao carregar pendências.",
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

    if (!(await projetoExiste(id))) {
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

    const titulo = texto(body.titulo);
    const descricao = textoOuNull(body.descricao);
    const tipo = texto(body.tipo) || "Pendência";
    const prioridade = texto(body.prioridade) || "Normal";
    const status = texto(body.status) || "Pendente";
    const responsavelId = textoOuNull(body.responsavel_id);

    let prazo: string | null;

    try {
      prazo = dataOuNull(body.prazo);
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Prazo inválido.",
        },
        { status: 400 },
      );
    }

    if (!titulo) {
      return NextResponse.json(
        { success: false, error: "Informe o título da pendência." },
        { status: 400 },
      );
    }

    if (titulo.length > 200) {
      return NextResponse.json(
        {
          success: false,
          error: "O título deve possuir no máximo 200 caracteres.",
        },
        { status: 400 },
      );
    }

    if (
      !TIPOS_VALIDOS.includes(
        tipo as (typeof TIPOS_VALIDOS)[number],
      )
    ) {
      return NextResponse.json(
        { success: false, error: "Tipo de pendência inválido." },
        { status: 400 },
      );
    }

    if (
      !PRIORIDADES_VALIDAS.includes(
        prioridade as (typeof PRIORIDADES_VALIDAS)[number],
      )
    ) {
      return NextResponse.json(
        { success: false, error: "Prioridade inválida." },
        { status: 400 },
      );
    }

    if (
      !STATUS_VALIDOS.includes(
        status as (typeof STATUS_VALIDOS)[number],
      )
    ) {
      return NextResponse.json(
        { success: false, error: "Status da pendência inválido." },
        { status: 400 },
      );
    }

    const concluidaEm =
      status === "Concluída" ? new Date().toISOString() : null;

    const supabase = await createClient();

    const { data, error } = await supabase
      .from("projeto_pendencias")
      .insert({
        projeto_id: id,
        titulo,
        descricao,
        tipo,
        prioridade,
        status,
        responsavel_id: responsavelId,
        prazo,
        concluida_em: concluidaEm,
        criado_por: permissao.usuario.usuarioId,
      })
      .select(`
        id,
        projeto_id,
        titulo,
        descricao,
        tipo,
        prioridade,
        status,
        responsavel_id,
        prazo,
        concluida_em,
        criado_por,
        created_at,
        updated_at
      `)
      .single();

    if (error) {
      console.error(
        "[POST /api/projetos/:id/pendencias]",
        error,
      );

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
        message: "Pendência criada com sucesso.",
        pendencia: data,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error(
      "[POST /api/projetos/:id/pendencias] Erro inesperado:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Erro inesperado ao criar pendência.",
      },
      { status: 500 },
    );
  }
}
