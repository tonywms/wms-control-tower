import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type Body = {
  tipo?: "redistribuicao" | "reprogramacao_prazo" | "alteracao_prioridade" | "alteracao_status";

  prioridade_anterior?: string | null;
  prioridade_nova?: string | null;

  status_anterior?: string | null;
  status_novo?: "Pausado" | "Bloqueado" | "Em andamento" | null;

  responsavel_anterior_id?: string | null;
  responsavel_novo_id?: string | null;

  prazo_anterior?: string | null;
  prazo_novo?: string | null;

  justificativa?: string;

  recomendacao?: string | null;
  score_origem_antes?: number | null;
  score_origem_depois?: number | null;
  score_destino_antes?: number | null;
  score_destino_depois?: number | null;

  score_anterior?: number | null;
  score_novo?: number | null;
  urgencia_anterior?: number | null;
  urgencia_nova?: number | null;
  quadrante_anterior?: string | null;
  quadrante_novo?: string | null;
};

function texto(valor: unknown) {
  if (valor === null || valor === undefined || valor === "") return null;
  return String(valor);
}

function dataValida(valor: string | null | undefined) {
  if (!valor) return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(valor);
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

    if (
      body.tipo !== "redistribuicao" &&
      body.tipo !== "reprogramacao_prazo" &&
      body.tipo !== "alteracao_prioridade" &&
      body.tipo !== "alteracao_status"
    ) {
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

    const supabaseNormal = await createClient();

    // No DEV local estamos trabalhando com bypass de Auth.
    // O admin client fica restrito ao servidor e permite update/auditoria
    // sem abrir policies anon no Supabase.
    const supabase =
      process.env.NODE_ENV !== "production"
        ? createAdminClient()
        : supabaseNormal;

    const { data: projeto, error: projetoError } = await supabase
      .from("projetos")
      .select(
        "id,nome,responsavel_id,responsavel_nome,data_fim,prioridade,status",
      )
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

    const usuarioAtual = permissao.usuario;
    const agora = new Date().toISOString();

    if (body.tipo === "redistribuicao") {
      const responsavelAnteriorId = projeto.responsavel_id ?? null;
      const esperadoAnteriorId = body.responsavel_anterior_id ?? null;

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

      // Governança não permite deixar um projeto sem responsável.
      // Este fluxo aceita definir um responsável quando o projeto está órfão
      // (NULL -> usuário) e redistribuir entre usuários (usuário -> usuário).
      if (!responsavelNovoId) {
        return NextResponse.json(
          {
            success: false,
            error: "Selecione um novo responsável para o projeto.",
          },
          { status: 400 },
        );
      }

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
          throw new Error(
            `Erro ao validar novo responsável: ${usuarioError.message}`,
          );
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

      let updateResponsavelQuery = supabase
        .from("projetos")
        .update({
          responsavel_id: responsavelNovoId,
          responsavel_nome: responsavelNovoNome,
          updated_at: agora,
        })
        .eq("id", id);

      // PostgreSQL/Supabase exige IS NULL para comparar coluna nula.
      // Isso permite a decisão gerencial: Sem responsável -> usuário.
      updateResponsavelQuery =
        responsavelAnteriorId === null
          ? updateResponsavelQuery.is("responsavel_id", null)
          : updateResponsavelQuery.eq("responsavel_id", responsavelAnteriorId);

      const { data: atualizado, error: updateError } =
        await updateResponsavelQuery
          .select("id,nome,responsavel_id,responsavel_nome,data_fim")
          .maybeSingle();

      if (updateError) {
        throw new Error(
          `Erro ao redistribuir projeto: ${updateError.message}`,
        );
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

      const anteriorNome =
        projeto.responsavel_nome || "Sem responsável";
      const novoNome =
        responsavelNovoNome || "Sem responsável";

      const detalhes = [
        `Redistribuição gerencial: ${anteriorNome} → ${novoNome}.`,
        `Justificativa: ${justificativa}.`,
        body.recomendacao
          ? `Recomendação simulada: ${body.recomendacao}.`
          : null,
        body.score_origem_antes != null &&
        body.score_origem_depois != null
          ? `Carga origem: ${body.score_origem_antes} → ${body.score_origem_depois}.`
          : null,
        body.score_destino_antes != null &&
        body.score_destino_depois != null
          ? `Carga destino: ${body.score_destino_antes} → ${body.score_destino_depois}.`
          : null,
      ]
        .filter(Boolean)
        .join(" ");

      const { error: historicoError } = await supabase
        .from("historico_projeto")
        .insert([
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
        ]);

      if (historicoError) {
        console.error(
          "[decisao-gerencial] Falha de auditoria da redistribuição:",
          historicoError,
        );

        return NextResponse.json(
          {
            success: false,
            applied: true,
            error:
              "A redistribuição foi aplicada, mas houve falha ao registrar a auditoria.",
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
    }

    // ============================================================
    // ALTERAÇÃO GERENCIAL DE STATUS
    // ============================================================
    if (body.tipo === "alteracao_status") {
      const statusAtual = projeto.status ?? null;
      const statusEsperado = body.status_anterior ?? null;
      const statusNovo = body.status_novo ?? null;

      if (statusAtual !== statusEsperado) {
        return NextResponse.json(
          {
            success: false,
            error:
              "O status do projeto foi alterado por outro usuário. Atualize a governança e tente novamente.",
          },
          { status: 409 },
        );
      }

      if (statusAtual === "Finalizado" || statusAtual === "Cancelado") {
        return NextResponse.json(
          { success: false, error: `O projeto está ${statusAtual} e não aceita nova decisão operacional.` },
          { status: 409 },
        );
      }

      const statusGerenciais = ["Pausado", "Bloqueado", "Em andamento"] as const;
      if (!statusNovo || !statusGerenciais.includes(statusNovo)) {
        return NextResponse.json(
          { success: false, error: "Novo status gerencial inválido." },
          { status: 400 },
        );
      }

      if (statusNovo === statusAtual) {
        return NextResponse.json(
          { success: false, error: "O novo status deve ser diferente do status atual." },
          { status: 400 },
        );
      }

      const { data: atualizado, error: statusError } = await supabase.rpc(
        "alterar_status_projeto",
        {
          p_projeto_id: id,
          p_novo_status: statusNovo,
          p_motivo: justificativa,
          p_usuario_id: usuarioAtual.usuarioId,
          p_usuario_nome: usuarioAtual.nome || "Sistema",
        },
      );

      if (statusError) {
        throw new Error(`Erro ao alterar status: ${statusError.message}`);
      }

      const detalhes = [
        `Alteração gerencial de status: ${statusAtual || "Não informado"} → ${statusNovo}.`,
        `Justificativa: ${justificativa}.`,
        body.score_anterior != null && body.score_novo != null
          ? `Score: ${body.score_anterior} → ${body.score_novo}.`
          : null,
        body.urgencia_anterior != null && body.urgencia_nova != null
          ? `Urgência: ${body.urgencia_anterior} → ${body.urgencia_nova}.`
          : null,
        body.quadrante_anterior && body.quadrante_novo
          ? `Quadrante: ${body.quadrante_anterior} → ${body.quadrante_novo}.`
          : null,
      ]
        .filter(Boolean)
        .join(" ");

      const { error: historicoError } = await supabase
        .from("historico_projeto")
        .insert({
          projeto_id: id,
          campo: "Decisão gerencial",
          valor_anterior: texto(statusAtual),
          valor_novo: detalhes,
          usuario_id: usuarioAtual.usuarioId ?? null,
          usuario_nome: usuarioAtual.nome || "Sistema",
          origem: "governanca",
          created_at: agora,
        });

      if (historicoError) {
        return NextResponse.json(
          {
            success: false,
            applied: true,
            error:
              "O status foi alterado, mas houve falha ao registrar a decisão na auditoria gerencial.",
            details: historicoError.message,
          },
          { status: 500 },
        );
      }

      return NextResponse.json({
        success: true,
        projeto: atualizado,
        decisao: {
          tipo: "alteracao_status",
          status_anterior: statusAtual,
          status_novo: statusNovo,
          justificativa,
          aplicado_por: usuarioAtual.nome,
          aplicado_em: agora,
        },
      });
    }

    // ============================================================
    // ALTERAÇÃO GERENCIAL DE PRIORIDADE
    // ============================================================
    if (body.tipo === "alteracao_prioridade") {
      const prioridadeAtual = projeto.prioridade ?? null;
      const prioridadeEsperada = body.prioridade_anterior ?? null;
      const prioridadeNova = body.prioridade_nova ?? null;

      if (prioridadeAtual !== prioridadeEsperada) {
        return NextResponse.json(
          {
            success: false,
            error:
              "A prioridade do projeto foi alterada por outro usuário. Atualize a governança e simule novamente.",
          },
          { status: 409 },
        );
      }

      const prioridadesValidas = ["Baixa", "Normal", "Alta", "Crítica"];

      if (!prioridadeNova || !prioridadesValidas.includes(prioridadeNova)) {
        return NextResponse.json(
          { success: false, error: "Nova prioridade inválida." },
          { status: 400 },
        );
      }

      if (prioridadeNova === prioridadeAtual) {
        return NextResponse.json(
          {
            success: false,
            error: "A nova prioridade deve ser diferente da prioridade atual.",
          },
          { status: 400 },
        );
      }

      const { data: atualizado, error: updateError } = await supabase
        .from("projetos")
        .update({
          prioridade: prioridadeNova,
          updated_at: agora,
        })
        .eq("id", id)
        .eq("prioridade", prioridadeAtual)
        .select("id,nome,responsavel_id,responsavel_nome,data_fim,prioridade")
        .maybeSingle();

      if (updateError) {
        throw new Error(
          `Erro ao alterar prioridade: ${updateError.message}`,
        );
      }

      if (!atualizado) {
        return NextResponse.json(
          {
            success: false,
            error:
              "A alteração de prioridade não foi aplicada porque o projeto mudou durante a confirmação. Atualize e tente novamente.",
          },
          { status: 409 },
        );
      }

      const detalhes = [
        `Alteração de prioridade: ${prioridadeAtual || "Não informada"} → ${prioridadeNova}.`,
        `Justificativa: ${justificativa}.`,
        body.score_anterior != null && body.score_novo != null
          ? `Score: ${body.score_anterior} → ${body.score_novo}.`
          : null,
        body.urgencia_anterior != null && body.urgencia_nova != null
          ? `Urgência: ${body.urgencia_anterior} → ${body.urgencia_nova}.`
          : null,
        body.quadrante_anterior && body.quadrante_novo
          ? `Quadrante: ${body.quadrante_anterior} → ${body.quadrante_novo}.`
          : null,
      ]
        .filter(Boolean)
        .join(" ");

      const { error: historicoError } = await supabase
        .from("historico_projeto")
        .insert([
          {
            projeto_id: id,
            campo: "Prioridade",
            valor_anterior: texto(prioridadeAtual),
            valor_novo: texto(prioridadeNova),
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
        ]);

      if (historicoError) {
        return NextResponse.json(
          {
            success: false,
            applied: true,
            error:
              "A prioridade foi alterada, mas houve falha ao registrar a auditoria.",
            details: historicoError.message,
          },
          { status: 500 },
        );
      }

      return NextResponse.json({
        success: true,
        projeto: atualizado,
        decisao: {
          tipo: "alteracao_prioridade",
          prioridade_anterior: prioridadeAtual,
          prioridade_nova: prioridadeNova,
          justificativa,
          aplicado_por: usuarioAtual.nome,
          aplicado_em: agora,
        },
      });
    }

    // ============================================================
    // REPROGRAMAÇÃO DE PRAZO
    // ============================================================
    const prazoAtual = projeto.data_fim ?? null;
    const prazoEsperado = body.prazo_anterior ?? null;
    const prazoNovo = body.prazo_novo ?? null;

    if (prazoAtual !== prazoEsperado) {
      return NextResponse.json(
        {
          success: false,
          error:
            "O prazo do projeto foi alterado por outro usuário. Atualize a governança e simule novamente.",
        },
        { status: 409 },
      );
    }

    if (!dataValida(prazoNovo)) {
      return NextResponse.json(
        {
          success: false,
          error: "Informe uma nova data final válida.",
        },
        { status: 400 },
      );
    }

    if (prazoNovo === prazoAtual) {
      return NextResponse.json(
        {
          success: false,
          error: "O novo prazo deve ser diferente do prazo atual.",
        },
        { status: 400 },
      );
    }

    let updateQuery = supabase
      .from("projetos")
      .update({
        data_fim: prazoNovo,
        updated_at: agora,
      })
      .eq("id", id);

    updateQuery =
      prazoAtual === null
        ? updateQuery.is("data_fim", null)
        : updateQuery.eq("data_fim", prazoAtual);

    const { data: atualizado, error: updateError } =
      await updateQuery
        .select("id,nome,responsavel_id,responsavel_nome,data_fim")
        .maybeSingle();

    if (updateError) {
      throw new Error(
        `Erro ao reprogramar prazo: ${updateError.message}`,
      );
    }

    if (!atualizado) {
      return NextResponse.json(
        {
          success: false,
          error:
            "A reprogramação não foi aplicada porque o projeto mudou durante a confirmação. Atualize e tente novamente.",
        },
        { status: 409 },
      );
    }

    const detalhes = [
      `Reprogramação de prazo: ${prazoAtual || "Sem prazo"} → ${prazoNovo}.`,
      `Justificativa: ${justificativa}.`,
      body.score_anterior != null && body.score_novo != null
        ? `Score: ${body.score_anterior} → ${body.score_novo}.`
        : null,
      body.urgencia_anterior != null && body.urgencia_nova != null
        ? `Urgência: ${body.urgencia_anterior} → ${body.urgencia_nova}.`
        : null,
      body.quadrante_anterior && body.quadrante_novo
        ? `Quadrante: ${body.quadrante_anterior} → ${body.quadrante_novo}.`
        : null,
    ]
      .filter(Boolean)
      .join(" ");

    const { error: historicoError } = await supabase
      .from("historico_projeto")
      .insert([
        {
          projeto_id: id,
          campo: "Data final",
          valor_anterior: texto(prazoAtual),
          valor_novo: texto(prazoNovo),
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
      ]);

    if (historicoError) {
      console.error(
        "[decisao-gerencial] Falha de auditoria da reprogramação:",
        historicoError,
      );

      return NextResponse.json(
        {
          success: false,
          applied: true,
          error:
            "O novo prazo foi aplicado, mas houve falha ao registrar a auditoria.",
          details: historicoError.message,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      projeto: atualizado,
      decisao: {
        tipo: "reprogramacao_prazo",
        prazo_anterior: prazoAtual,
        prazo_novo: prazoNovo,
        justificativa,
        score_anterior: body.score_anterior ?? null,
        score_novo: body.score_novo ?? null,
        urgencia_anterior: body.urgencia_anterior ?? null,
        urgencia_nova: body.urgencia_nova ?? null,
        quadrante_anterior: body.quadrante_anterior ?? null,
        quadrante_novo: body.quadrante_novo ?? null,
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