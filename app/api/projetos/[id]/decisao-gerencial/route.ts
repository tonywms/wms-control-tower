import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";

type Body = {
  tipo?: string;
  responsavel_anterior_id?: string | null;
  responsavel_novo_id?: string | null;
  justificativa?: string;
  recomendacao?: string | null;
  score_origem_antes?: number | null;
  score_origem_depois?: number | null;
  score_destino_antes?: number | null;
  score_destino_depois?: number | null;
};

function texto(valor: unknown) {
  if (valor === null || valor === undefined || valor === "") return null;
  return String(valor);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
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
    const body = (await request.json()) as Body;

    if (body.tipo !== "redistribuicao") {
      return NextResponse.json(
        { success: false, error: "Tipo de decisão gerencial inválido." },
        { status: 400 },
      );
    }

    const justificativa =
      typeof body.justificativa === "string" ? body.justificativa.trim() : "";

    if (justificativa.length < 10) {
      return NextResponse.json(
        {
          success: false,
          error: "A justificativa deve possuir pelo menos 10 caracteres.",
        },
        { status: 400 },
      );
    }

    const supabase = await createClient();

    const { data: projeto, error: projetoError } = await supabase
      .from("projetos")
      .select("id,nome,responsavel_id,responsavel_nome")
      .eq("id", id)
      .maybeSingle();

    if (projetoError) {
      throw new Error(`Erro ao buscar projeto: ${projetoError.message}`);
    }

    if (!projeto) {
      return NextResponse.json(
        { success: false, error: "Projeto não encontrado." },
        { status: 404 },
      );
    }

    const responsavelAnteriorId = projeto.responsavel_id ?? null;
    const esperadoAnteriorId = body.responsavel_anterior_id ?? null;

    // Proteção contra decisão baseada em tela desatualizada.
    if (responsavelAnteriorId !== esperadoAnteriorId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "O responsável do projeto foi alterado por outro usuário. Atualize a governança e simule novamente.",
        },
        { status: 409 },
      );
    }

    const responsavelNovoId = body.responsavel_novo_id ?? null;

    if (responsavelNovoId === responsavelAnteriorId) {
      return NextResponse.json(
        {
          success: false,
          error: "O novo responsável deve ser diferente do responsável atual.",
        },
        { status: 400 },
      );
    }

    let responsavelNovoNome: string | null = null;

    if (responsavelNovoId) {
      const { data: usuarioNovo, error: usuarioError } = await supabase
        .from("usuarios")
        .select("id,nome,ativo")
        .eq("id", responsavelNovoId)
        .eq("ativo", true)
        .maybeSingle();

      if (usuarioError) {
        throw new Error(`Erro ao validar novo responsável: ${usuarioError.message}`);
      }

      if (!usuarioNovo) {
        return NextResponse.json(
          {
            success: false,
            error: "O novo responsável não existe ou está inativo.",
          },
          { status: 400 },
        );
      }

      responsavelNovoNome = usuarioNovo.nome;
    }

    const agora = new Date().toISOString();

    const { data: atualizado, error: updateError } = await supabase
      .from("projetos")
      .update({
        responsavel_id: responsavelNovoId,
        responsavel_nome: responsavelNovoNome,
        updated_at: agora,
      })
      .eq("id", id)
      .eq(
        "responsavel_id",
        responsavelAnteriorId,
      )
      .select("id,nome,responsavel_id,responsavel_nome")
      .maybeSingle();

    if (updateError) {
      throw new Error(`Erro ao redistribuir projeto: ${updateError.message}`);
    }

    if (!atualizado) {
      return NextResponse.json(
        {
          success: false,
          error:
            "A redistribuição não foi aplicada porque o projeto mudou durante a confirmação. Atualize e tente novamente.",
        },
        { status: 409 },
      );
    }

    const usuarioAtual = permissao.usuario;
    const anteriorNome = projeto.responsavel_nome || "Sem responsável";
    const novoNome = responsavelNovoNome || "Sem responsável";

    const detalhes = [
      `Redistribuição gerencial: ${anteriorNome} → ${novoNome}.`,
      `Justificativa: ${justificativa}`,
      body.recomendacao ? `Recomendação simulada: ${body.recomendacao}.` : null,
      body.score_origem_antes !== null &&
      body.score_origem_antes !== undefined &&
      body.score_origem_depois !== null &&
      body.score_origem_depois !== undefined
        ? `Carga origem: ${body.score_origem_antes} → ${body.score_origem_depois}.`
        : null,
      body.score_destino_antes !== null &&
      body.score_destino_antes !== undefined &&
      body.score_destino_depois !== null &&
      body.score_destino_depois !== undefined
        ? `Carga destino: ${body.score_destino_antes} → ${body.score_destino_depois}.`
        : null,
    ]
      .filter(Boolean)
      .join(" ");

    const historico = [
      {
        projeto_id: id,
        campo: "Responsável",
        valor_anterior: texto(anteriorNome),
        valor_novo: texto(novoNome),
        usuario_id: usuarioAtual.usuarioId ?? null,
        usuario_nome: usuarioAtual.nome || "Sistema",
        origem: "governanca",
        created_at: agora,
      },
      {
        projeto_id: id,
        campo: "Decisão gerencial",
        valor_anterior: null,
        valor_novo: detalhes,
        usuario_id: usuarioAtual.usuarioId ?? null,
        usuario_nome: usuarioAtual.nome || "Sistema",
        origem: "governanca",
        created_at: agora,
      },
    ];

    const { error: historicoError } = await supabase
      .from("historico_projeto")
      .insert(historico);

    if (historicoError) {
      // A decisão já foi aplicada. Não desfazemos silenciosamente a alteração;
      // retornamos erro explícito para que a falha de auditoria seja visível.
      console.error(
        "[POST /api/projetos/:id/decisao-gerencial] Falha de auditoria:",
        historicoError,
      );

      return NextResponse.json(
        {
          success: false,
          applied: true,
          error:
            "A redistribuição foi aplicada, mas houve falha ao registrar a auditoria. Verifique o histórico do projeto.",
          details: historicoError.message,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      projeto: atualizado,
      decisao: {
        tipo: "redistribuicao",
        responsavel_anterior: anteriorNome,
        responsavel_novo: novoNome,
        justificativa,
        aplicado_por: usuarioAtual.nome,
        aplicado_em: agora,
      },
    });
  } catch (error) {
    console.error(
      "[POST /api/projetos/:id/decisao-gerencial] Error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Erro interno ao aplicar decisão gerencial.",
      },
      { status: 500 },
    );
  }
}
