import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type TipoItem = "projeto" | "acao" | "pendencia";
type Operacao =
  | "reprogramar_prazo"
  | "definir_responsavel"
  | "concluir"
  | "cancelar";

type Auditoria = {
  projeto_id: string;
  campo: string;
  valor_anterior: string | null;
  valor_novo: string | null;
  usuario_id: string | null;
  usuario_nome: string;
  origem: string;
  created_at: string;
};

async function getSupabase() {
  if (process.env.NODE_ENV !== "production") return createAdminClient();
  return await createClient();
}

function texto(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function dataValida(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function valorHistorico(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  return String(value);
}

export async function POST(request: NextRequest) {
  try {
    const permissao = await requirePermission("editar");

    if (!permissao.ok) {
      return NextResponse.json(
        { success: false, error: permissao.error },
        { status: permissao.status },
      );
    }

    const usuarioAtual = permissao.usuario;
    const body = await request.json();

    const projetoId = texto(body.projeto_id);
    const referenciaId = texto(body.referencia_id);
    const itemTipo = texto(body.item_tipo) as TipoItem;
    const operacao = texto(body.operacao) as Operacao;
    const prazo = texto(body.prazo);
    const responsavelId = texto(body.responsavel_id);
    const inconsistenciaId = texto(body.inconsistencia_id);
    const categoriaInconsistencia = texto(body.categoria);
    const severidadeInconsistencia = texto(body.severidade);
    const tituloInconsistencia = texto(body.titulo);
    const descricaoInconsistencia = texto(body.descricao);
    const recomendacaoInconsistencia = texto(body.recomendacao);

    if (!projetoId || !referenciaId) {
      return NextResponse.json(
        { success: false, error: "Projeto ou referência não informado." },
        { status: 400 },
      );
    }

    if (!["projeto", "acao", "pendencia"].includes(itemTipo)) {
      return NextResponse.json(
        { success: false, error: "Tipo de item inválido." },
        { status: 400 },
      );
    }

    if (
      ![
        "reprogramar_prazo",
        "definir_responsavel",
        "concluir",
        "cancelar",
      ].includes(operacao)
    ) {
      return NextResponse.json(
        { success: false, error: "Operação inválida." },
        { status: 400 },
      );
    }

    const supabase = await getSupabase();
    const agora = new Date().toISOString();

    // Confirma que o projeto-pai existe. Toda auditoria fica vinculada a ele,
    // inclusive quando o saneamento é feito em uma ação ou pendência.
    const { data: projeto, error: projetoError } = await supabase
      .from("projetos")
      .select("id,nome,data_fim,responsavel_id,responsavel_nome")
      .eq("id", projetoId)
      .maybeSingle();

    if (projetoError) throw projetoError;

    if (!projeto) {
      return NextResponse.json(
        { success: false, error: "Projeto não encontrado." },
        { status: 404 },
      );
    }

    let auditoria: Auditoria | null = null;

    // ============================================================
    // REPROGRAMAR PRAZO
    // ============================================================
    if (operacao === "reprogramar_prazo") {
      if (!prazo || !dataValida(prazo)) {
        return NextResponse.json(
          { success: false, error: "Informe um novo prazo válido." },
          { status: 400 },
        );
      }

      if (itemTipo === "projeto") {
        const prazoAnterior = projeto.data_fim ?? null;

        const { data, error } = await supabase
          .from("projetos")
          .update({ data_fim: prazo, updated_at: agora })
          .eq("id", projetoId)
          .select("id")
          .maybeSingle();

        if (error) throw error;
        if (!data) {
          return NextResponse.json(
            { success: false, error: "Projeto não encontrado." },
            { status: 404 },
          );
        }

        auditoria = {
          projeto_id: projetoId,
          campo: "Saneamento · Prazo do projeto",
          valor_anterior: valorHistorico(prazoAnterior),
          valor_novo: valorHistorico(prazo),
          usuario_id: usuarioAtual.usuarioId ?? null,
          usuario_nome: usuarioAtual.nome || "Sistema",
          origem: "saneamento_gerencial",
          created_at: agora,
        };
      } else if (itemTipo === "acao") {
        const { data: atual, error: atualError } = await supabase
          .from("projeto_acoes")
          .select("id,titulo,prazo")
          .eq("id", referenciaId)
          .eq("projeto_id", projetoId)
          .maybeSingle();

        if (atualError) throw atualError;
        if (!atual) {
          return NextResponse.json(
            { success: false, error: "Ação não encontrada." },
            { status: 404 },
          );
        }

        const { data, error } = await supabase
          .from("projeto_acoes")
          .update({ prazo, updated_at: agora })
          .eq("id", referenciaId)
          .eq("projeto_id", projetoId)
          .select("id")
          .maybeSingle();

        if (error) throw error;
        if (!data) {
          return NextResponse.json(
            { success: false, error: "Ação não encontrada." },
            { status: 404 },
          );
        }

        auditoria = {
          projeto_id: projetoId,
          campo: `Saneamento · Prazo da ação · ${atual.titulo}`,
          valor_anterior: valorHistorico(atual.prazo),
          valor_novo: valorHistorico(prazo),
          usuario_id: usuarioAtual.usuarioId ?? null,
          usuario_nome: usuarioAtual.nome || "Sistema",
          origem: "saneamento_gerencial",
          created_at: agora,
        };
      } else {
        const { data: atual, error: atualError } = await supabase
          .from("projeto_pendencias")
          .select("id,titulo,prazo")
          .eq("id", referenciaId)
          .eq("projeto_id", projetoId)
          .maybeSingle();

        if (atualError) throw atualError;
        if (!atual) {
          return NextResponse.json(
            { success: false, error: "Pendência não encontrada." },
            { status: 404 },
          );
        }

        const { data, error } = await supabase
          .from("projeto_pendencias")
          .update({ prazo, updated_at: agora })
          .eq("id", referenciaId)
          .eq("projeto_id", projetoId)
          .select("id")
          .maybeSingle();

        if (error) throw error;
        if (!data) {
          return NextResponse.json(
            { success: false, error: "Pendência não encontrada." },
            { status: 404 },
          );
        }

        auditoria = {
          projeto_id: projetoId,
          campo: `Saneamento · Prazo da pendência · ${atual.titulo}`,
          valor_anterior: valorHistorico(atual.prazo),
          valor_novo: valorHistorico(prazo),
          usuario_id: usuarioAtual.usuarioId ?? null,
          usuario_nome: usuarioAtual.nome || "Sistema",
          origem: "saneamento_gerencial",
          created_at: agora,
        };
      }
    }

    // ============================================================
    // DEFINIR RESPONSÁVEL
    // ============================================================
    if (operacao === "definir_responsavel") {
      if (!responsavelId) {
        return NextResponse.json(
          { success: false, error: "Selecione um responsável." },
          { status: 400 },
        );
      }

      const { data: usuario, error: usuarioError } = await supabase
        .from("usuarios")
        .select("id,nome,ativo")
        .eq("id", responsavelId)
        .eq("ativo", true)
        .maybeSingle();

      if (usuarioError) throw usuarioError;

      if (!usuario) {
        return NextResponse.json(
          { success: false, error: "Responsável ativo não encontrado." },
          { status: 404 },
        );
      }

      if (itemTipo === "projeto") {
        const responsavelAnterior = projeto.responsavel_nome ?? null;

        const { data, error } = await supabase
          .from("projetos")
          .update({
            responsavel_id: responsavelId,
            responsavel_nome: usuario.nome,
            updated_at: agora,
          })
          .eq("id", projetoId)
          .select("id")
          .maybeSingle();

        if (error) throw error;
        if (!data) {
          return NextResponse.json(
            { success: false, error: "Projeto não encontrado." },
            { status: 404 },
          );
        }

        auditoria = {
          projeto_id: projetoId,
          campo: "Saneamento · Responsável do projeto",
          valor_anterior: valorHistorico(responsavelAnterior),
          valor_novo: valorHistorico(usuario.nome),
          usuario_id: usuarioAtual.usuarioId ?? null,
          usuario_nome: usuarioAtual.nome || "Sistema",
          origem: "saneamento_gerencial",
          created_at: agora,
        };
      } else if (itemTipo === "acao") {
        const { data: atual, error: atualError } = await supabase
          .from("projeto_acoes")
          .select("id,titulo,responsavel_id")
          .eq("id", referenciaId)
          .eq("projeto_id", projetoId)
          .maybeSingle();

        if (atualError) throw atualError;
        if (!atual) {
          return NextResponse.json(
            { success: false, error: "Ação não encontrada." },
            { status: 404 },
          );
        }

        let responsavelAnteriorNome: string | null = null;
        if (atual.responsavel_id) {
          const { data: anterior } = await supabase
            .from("usuarios")
            .select("nome")
            .eq("id", atual.responsavel_id)
            .maybeSingle();
          responsavelAnteriorNome = anterior?.nome ?? atual.responsavel_id;
        }

        const { data, error } = await supabase
          .from("projeto_acoes")
          .update({ responsavel_id: responsavelId, updated_at: agora })
          .eq("id", referenciaId)
          .eq("projeto_id", projetoId)
          .select("id")
          .maybeSingle();

        if (error) throw error;
        if (!data) {
          return NextResponse.json(
            { success: false, error: "Ação não encontrada." },
            { status: 404 },
          );
        }

        auditoria = {
          projeto_id: projetoId,
          campo: `Saneamento · Responsável da ação · ${atual.titulo}`,
          valor_anterior: valorHistorico(responsavelAnteriorNome),
          valor_novo: valorHistorico(usuario.nome),
          usuario_id: usuarioAtual.usuarioId ?? null,
          usuario_nome: usuarioAtual.nome || "Sistema",
          origem: "saneamento_gerencial",
          created_at: agora,
        };
      } else {
        const { data: atual, error: atualError } = await supabase
          .from("projeto_pendencias")
          .select("id,titulo,responsavel_id")
          .eq("id", referenciaId)
          .eq("projeto_id", projetoId)
          .maybeSingle();

        if (atualError) throw atualError;
        if (!atual) {
          return NextResponse.json(
            { success: false, error: "Pendência não encontrada." },
            { status: 404 },
          );
        }

        let responsavelAnteriorNome: string | null = null;
        if (atual.responsavel_id) {
          const { data: anterior } = await supabase
            .from("usuarios")
            .select("nome")
            .eq("id", atual.responsavel_id)
            .maybeSingle();
          responsavelAnteriorNome = anterior?.nome ?? atual.responsavel_id;
        }

        const { data, error } = await supabase
          .from("projeto_pendencias")
          .update({ responsavel_id: responsavelId, updated_at: agora })
          .eq("id", referenciaId)
          .eq("projeto_id", projetoId)
          .select("id")
          .maybeSingle();

        if (error) throw error;
        if (!data) {
          return NextResponse.json(
            { success: false, error: "Pendência não encontrada." },
            { status: 404 },
          );
        }

        auditoria = {
          projeto_id: projetoId,
          campo: `Saneamento · Responsável da pendência · ${atual.titulo}`,
          valor_anterior: valorHistorico(responsavelAnteriorNome),
          valor_novo: valorHistorico(usuario.nome),
          usuario_id: usuarioAtual.usuarioId ?? null,
          usuario_nome: usuarioAtual.nome || "Sistema",
          origem: "saneamento_gerencial",
          created_at: agora,
        };
      }
    }

    // ============================================================
    // CONCLUIR / CANCELAR
    // ============================================================
    if (operacao === "concluir" || operacao === "cancelar") {
      if (itemTipo === "projeto") {
        return NextResponse.json(
          {
            success: false,
            error:
              "Altere o status do projeto pelo fluxo oficial do Projeto 360/Kanban.",
          },
          { status: 400 },
        );
      }

      const statusNovo = operacao === "concluir" ? "Concluída" : "Cancelada";
      const concluidaEm = operacao === "concluir" ? agora : null;

      if (itemTipo === "acao") {
        const { data: atual, error: atualError } = await supabase
          .from("projeto_acoes")
          .select("id,titulo,status")
          .eq("id", referenciaId)
          .eq("projeto_id", projetoId)
          .maybeSingle();

        if (atualError) throw atualError;
        if (!atual) {
          return NextResponse.json(
            { success: false, error: "Ação não encontrada." },
            { status: 404 },
          );
        }

        const { data, error } = await supabase
          .from("projeto_acoes")
          .update({
            status: statusNovo,
            concluida_em: concluidaEm,
            updated_at: agora,
          })
          .eq("id", referenciaId)
          .eq("projeto_id", projetoId)
          .select("id")
          .maybeSingle();

        if (error) throw error;
        if (!data) {
          return NextResponse.json(
            { success: false, error: "Ação não encontrada." },
            { status: 404 },
          );
        }

        auditoria = {
          projeto_id: projetoId,
          campo: `Saneamento · Status da ação · ${atual.titulo}`,
          valor_anterior: valorHistorico(atual.status),
          valor_novo: valorHistorico(statusNovo),
          usuario_id: usuarioAtual.usuarioId ?? null,
          usuario_nome: usuarioAtual.nome || "Sistema",
          origem: "saneamento_gerencial",
          created_at: agora,
        };
      } else {
        const { data: atual, error: atualError } = await supabase
          .from("projeto_pendencias")
          .select("id,titulo,status")
          .eq("id", referenciaId)
          .eq("projeto_id", projetoId)
          .maybeSingle();

        if (atualError) throw atualError;
        if (!atual) {
          return NextResponse.json(
            { success: false, error: "Pendência não encontrada." },
            { status: 404 },
          );
        }

        const { data, error } = await supabase
          .from("projeto_pendencias")
          .update({
            status: statusNovo,
            concluida_em: concluidaEm,
            updated_at: agora,
          })
          .eq("id", referenciaId)
          .eq("projeto_id", projetoId)
          .select("id")
          .maybeSingle();

        if (error) throw error;
        if (!data) {
          return NextResponse.json(
            { success: false, error: "Pendência não encontrada." },
            { status: 404 },
          );
        }

        auditoria = {
          projeto_id: projetoId,
          campo: `Saneamento · Status da pendência · ${atual.titulo}`,
          valor_anterior: valorHistorico(atual.status),
          valor_novo: valorHistorico(statusNovo),
          usuario_id: usuarioAtual.usuarioId ?? null,
          usuario_nome: usuarioAtual.nome || "Sistema",
          origem: "saneamento_gerencial",
          created_at: agora,
        };
      }
    }

    // ============================================================
    // AUDITORIA DO SANEAMENTO
    // ============================================================
    if (!auditoria) {
      return NextResponse.json(
        { success: false, error: "Nenhuma alteração foi produzida pelo saneamento." },
        { status: 400 },
      );
    }

    const { error: auditoriaError } = await supabase
      .from("historico_projeto")
      .insert(auditoria);

    if (auditoriaError) {
      // A alteração operacional já foi aplicada. Não escondemos a falha de
      // rastreabilidade: o frontend recebe um erro explícito e o servidor
      // registra o incidente para correção.
      console.error(
        "[POST /api/inconsistencias/sanear] Saneamento aplicado, mas auditoria falhou:",
        auditoriaError,
      );

      return NextResponse.json(
        {
          success: false,
          applied: true,
          audit_failed: true,
          error:
            "O saneamento foi aplicado, mas o registro de auditoria falhou. Reaudite a carteira e verifique o histórico do projeto.",
        },
        { status: 500 },
      );
    }

    // ============================================================
    // HISTÓRICO DE INCONSISTÊNCIAS SANEADAS
    // ============================================================
    const { error: historicoSaneamentoError } = await supabase
      .from("historico_saneamento")
      .insert({
        projeto_id: projetoId,
        inconsistencia_id: inconsistenciaId || null,
        referencia_id: referenciaId,
        item_tipo: itemTipo,
        categoria: categoriaInconsistencia || "Não informada",
        severidade: severidadeInconsistencia || "Atenção",
        titulo: tituloInconsistencia || auditoria.campo,
        descricao: descricaoInconsistencia || null,
        recomendacao: recomendacaoInconsistencia || null,
        operacao,
        campo_alterado: auditoria.campo,
        valor_anterior: auditoria.valor_anterior,
        valor_novo: auditoria.valor_novo,
        usuario_id: usuarioAtual.usuarioId ?? null,
        usuario_nome: usuarioAtual.nome || "Sistema",
        saneado_em: agora,
      });

    if (historicoSaneamentoError) {
      console.error(
        "[POST /api/inconsistencias/sanear] Saneamento e auditoria aplicados, mas histórico de saneamento falhou:",
        historicoSaneamentoError,
      );

      return NextResponse.json(
        {
          success: false,
          applied: true,
          audit_applied: true,
          history_failed: true,
          error:
            "O saneamento e a auditoria foram aplicados, mas o histórico de inconsistências saneadas não pôde ser gravado.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Saneamento aplicado, auditado e arquivado no histórico com sucesso.",
      auditoria: {
        campo: auditoria.campo,
        valor_anterior: auditoria.valor_anterior,
        valor_novo: auditoria.valor_novo,
        usuario_nome: auditoria.usuario_nome,
        origem: auditoria.origem,
        created_at: auditoria.created_at,
      },
    });
  } catch (error) {
    console.error("[POST /api/inconsistencias/sanear]", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Erro ao aplicar saneamento.",
      },
      { status: 500 },
    );
  }
}
