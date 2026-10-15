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
  params: Promise<{
    id: string;
    marcoId: string;
  }>;
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

    const { id, marcoId } = await context.params;

    if (!id || !marcoId) {
      return NextResponse.json(
        { success: false, error: "Projeto ou marco não informado." },
        { status: 400 },
      );
    }

    const supabase = await createClient();

    const { data: atual, error: buscaError } = await supabase
      .from("projeto_marcos")
      .select("*")
      .eq("id", marcoId)
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
        { success: false, error: "Marco não encontrado." },
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

    const nome =
      body.nome !== undefined ? texto(body.nome) : atual.nome;

    const descricao =
      body.descricao !== undefined
        ? textoOuNull(body.descricao)
        : atual.descricao;

    const status =
      body.status !== undefined ? texto(body.status) : atual.status;

    const responsavelId =
      body.responsavel_id !== undefined
        ? textoOuNull(body.responsavel_id)
        : atual.responsavel_id;

    let dataPrevista = atual.data_prevista;
    let dataRealizada = atual.data_realizada;
    let ordem = atual.ordem;

    try {
      if (body.data_prevista !== undefined) {
        dataPrevista = dataOuNull(
          body.data_prevista,
          "Data prevista",
        );
      }

      if (body.data_realizada !== undefined) {
        dataRealizada = dataOuNull(
          body.data_realizada,
          "Data realizada",
        );
      }

      if (body.ordem !== undefined) {
        ordem = numeroInteiro(body.ordem, atual.ordem ?? 0);
      }
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
      .update({
        nome,
        descricao,
        status,
        responsavel_id: responsavelId,
        data_prevista: dataPrevista,
        data_realizada: dataRealizada,
        ordem,
        updated_at: new Date().toISOString(),
      })
      .eq("id", marcoId)
      .eq("projeto_id", id)
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
      console.error(
        "[PUT /api/projetos/:id/marcos/:marcoId]",
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
      message: "Marco atualizado com sucesso.",
      marco: data,
    });
  } catch (error) {
    console.error(
      "[PUT /api/projetos/:id/marcos/:marcoId] Erro inesperado:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Erro inesperado ao atualizar marco.",
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

    const { id, marcoId } = await context.params;

    if (!id || !marcoId) {
      return NextResponse.json(
        { success: false, error: "Projeto ou marco não informado." },
        { status: 400 },
      );
    }

    const supabase = await createClient();

    const { data: marco, error: buscaError } = await supabase
      .from("projeto_marcos")
      .select("id, nome")
      .eq("id", marcoId)
      .eq("projeto_id", id)
      .maybeSingle();

    if (buscaError) {
      return NextResponse.json(
        { success: false, error: buscaError.message },
        { status: 500 },
      );
    }

    if (!marco) {
      return NextResponse.json(
        { success: false, error: "Marco não encontrado." },
        { status: 404 },
      );
    }

    const { error } = await supabase
      .from("projeto_marcos")
      .delete()
      .eq("id", marcoId)
      .eq("projeto_id", id);

    if (error) {
      console.error(
        "[DELETE /api/projetos/:id/marcos/:marcoId]",
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
      message: "Marco excluído com sucesso.",
      marco: {
        id: marco.id,
        nome: marco.nome,
      },
    });
  } catch (error) {
    console.error(
      "[DELETE /api/projetos/:id/marcos/:marcoId] Erro inesperado:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Erro inesperado ao excluir marco.",
      },
      { status: 500 },
    );
  }
}
