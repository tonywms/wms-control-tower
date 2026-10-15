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
  params: Promise<{
    id: string;
    pendenciaId: string;
  }>;
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

export async function PUT(
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

    const { id, pendenciaId } = await context.params;

    if (!id || !pendenciaId) {
      return NextResponse.json(
        {
          success: false,
          error: "Projeto ou pendência não informado.",
        },
        { status: 400 },
      );
    }

    const supabase = await createClient();

    const { data: atual, error: buscaError } = await supabase
      .from("projeto_pendencias")
      .select("*")
      .eq("id", pendenciaId)
      .eq("projeto_id", id)
      .maybeSingle();

    if (buscaError) {
      return NextResponse.json(
        { success: false, error: buscaError.message },
        { status: 500 },
      );
    }

    if (!atual) {
      return NextResponse.json(
        { success: false, error: "Pendência não encontrada." },
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

    const titulo =
      body.titulo !== undefined
        ? texto(body.titulo)
        : atual.titulo;

    const descricao =
      body.descricao !== undefined
        ? textoOuNull(body.descricao)
        : atual.descricao;

    const tipo =
      body.tipo !== undefined
        ? texto(body.tipo)
        : atual.tipo;

    const prioridade =
      body.prioridade !== undefined
        ? texto(body.prioridade)
        : atual.prioridade;

    const status =
      body.status !== undefined
        ? texto(body.status)
        : atual.status;

    const responsavelId =
      body.responsavel_id !== undefined
        ? textoOuNull(body.responsavel_id)
        : atual.responsavel_id;

    let prazo = atual.prazo;

    if (body.prazo !== undefined) {
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

    let concluidaEm = atual.concluida_em;

    if (status === "Concluída" && atual.status !== "Concluída") {
      concluidaEm = new Date().toISOString();
    }

    if (status !== "Concluída") {
      concluidaEm = null;
    }

    const { data, error } = await supabase
      .from("projeto_pendencias")
      .update({
        titulo,
        descricao,
        tipo,
        prioridade,
        status,
        responsavel_id: responsavelId,
        prazo,
        concluida_em: concluidaEm,
        updated_at: new Date().toISOString(),
      })
      .eq("id", pendenciaId)
      .eq("projeto_id", id)
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
        "[PUT /api/projetos/:id/pendencias/:pendenciaId]",
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
      message: "Pendência atualizada com sucesso.",
      pendencia: data,
    });
  } catch (error) {
    console.error(
      "[PUT /api/projetos/:id/pendencias/:pendenciaId] Erro inesperado:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Erro inesperado ao atualizar pendência.",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
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

    const { id, pendenciaId } = await context.params;

    if (!id || !pendenciaId) {
      return NextResponse.json(
        {
          success: false,
          error: "Projeto ou pendência não informado.",
        },
        { status: 400 },
      );
    }

    const supabase = await createClient();

    const { data: pendencia, error: buscaError } = await supabase
      .from("projeto_pendencias")
      .select("id, titulo")
      .eq("id", pendenciaId)
      .eq("projeto_id", id)
      .maybeSingle();

    if (buscaError) {
      return NextResponse.json(
        { success: false, error: buscaError.message },
        { status: 500 },
      );
    }

    if (!pendencia) {
      return NextResponse.json(
        { success: false, error: "Pendência não encontrada." },
        { status: 404 },
      );
    }

    const { error } = await supabase
      .from("projeto_pendencias")
      .delete()
      .eq("id", pendenciaId)
      .eq("projeto_id", id);

    if (error) {
      console.error(
        "[DELETE /api/projetos/:id/pendencias/:pendenciaId]",
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
      message: "Pendência excluída com sucesso.",
      pendencia: {
        id: pendencia.id,
        titulo: pendencia.titulo,
      },
    });
  } catch (error) {
    console.error(
      "[DELETE /api/projetos/:id/pendencias/:pendenciaId] Erro inesperado:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Erro inesperado ao excluir pendência.",
      },
      { status: 500 },
    );
  }
}
