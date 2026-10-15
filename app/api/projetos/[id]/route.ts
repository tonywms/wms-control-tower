import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/permissions";

const STATUS_VALIDOS = [
  "Não iniciado",
  "Planejado",
  "Em andamento",
  "Pausado",
  "Bloqueado",
  "Finalizado",
  "Cancelado",
];

const PRIORIDADES_VALIDAS = [
  "Baixa",
  "Normal",
  "Alta",
  "Crítica",
];

/*
 * ============================================================
 * GET
 * ============================================================
 * Busca um projeto específico.
 * ============================================================
 */

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;

    const supabase = await createClient();

    const {
      data,
      error,
    } = await supabase
      .from("projetos")
      .select(`
        *,
        cliente:clientes (
          id,
          nome
        ),
        etapa:etapas (
          id,
          nome,
          ordem
        )
      `)
      .eq("id", id)
      .single();

    if (error) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
        },
        {
          status: 404,
        },
      );
    }

    return NextResponse.json({
      success: true,
      projeto: data,
    });
  } catch (error) {
    console.error(
      "[GET /api/projetos/:id] Erro:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Erro inesperado.",
      },
      {
        status: 500,
      },
    );
  }
}

/*
 * ============================================================
 * PUT
 * ============================================================
 * Atualiza os dados do projeto.
 *
 * Permissão necessária:
 * editar
 *
 * Se o status também for alterado:
 * alterar_status
 * ============================================================
 */

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    /*
     * ========================================================
     * 0. AUTORIZAÇÃO PARA EDIÇÃO
     * ========================================================
     */

    const autorizacao =
      await requirePermission("editar");

    if (!autorizacao.ok) {
      return NextResponse.json(
        {
          success: false,
          error: autorizacao.error,
        },
        {
          status: autorizacao.status,
        },
      );
    }

    const usuarioAtual =
      autorizacao.usuario;

    const { id } = await context.params;

    const body = await request.json();

    const supabase = await createClient();

    /*
     * ========================================================
     * 1. BUSCAR PROJETO ATUAL
     * ========================================================
     */

    const {
      data: projetoAtual,
      error: buscaError,
    } = await supabase
      .from("projetos")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (buscaError) {
      console.error(
        "[PUT /api/projetos/:id] Erro ao buscar projeto:",
        buscaError,
      );

      return NextResponse.json(
        {
          success: false,
          error: buscaError.message,
          details:
            buscaError.details ?? null,
          hint:
            buscaError.hint ?? null,
          code:
            buscaError.code ?? null,
        },
        {
          status: 500,
        },
      );
    }

    if (!projetoAtual) {
      console.error(
        "[PUT /api/projetos/:id] Projeto não encontrado:",
        id,
      );

      return NextResponse.json(
        {
          success: false,
          error: "Projeto não encontrado.",
          projeto_id: id,
        },
        {
          status: 404,
        },
      );
    }

    /*
     * ========================================================
     * 2. VALIDAR STATUS
     * ========================================================
     */

    const status =
      typeof body.status === "string"
        ? body.status
        : projetoAtual.status;

    if (!STATUS_VALIDOS.includes(status)) {
      return NextResponse.json(
        {
          success: false,
          error: `Status inválido: ${status}`,
        },
        {
          status: 400,
        },
      );
    }

    /*
     * ========================================================
     * 3. SE O STATUS MUDOU, EXIGIR ALTERAR_STATUS
     * ========================================================
     */

    if (projetoAtual.status !== status) {
      const autorizacaoStatus =
        await requirePermission(
          "alterar_status",
        );

      if (!autorizacaoStatus.ok) {
        return NextResponse.json(
          {
            success: false,
            error:
              autorizacaoStatus.error,
          },
          {
            status: autorizacaoStatus.status,
          },
        );
      }
    }

    /*
     * ========================================================
     * 4. VALIDAR PRIORIDADE
     * ========================================================
     */

    const prioridade =
      typeof body.prioridade === "string"
        ? body.prioridade
        : projetoAtual.prioridade;

    if (
      !PRIORIDADES_VALIDAS.includes(
        prioridade,
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error: `Prioridade inválida: ${prioridade}`,
        },
        {
          status: 400,
        },
      );
    }

    /*
     * ========================================================
     * 5. PERCENTUAL
     * ========================================================
     */

    const percentual =
      body.percentual === undefined
        ? projetoAtual.percentual
        : Math.min(
            100,
            Math.max(
              0,
              Number(body.percentual) || 0,
            ),
          );

    /*
     * ========================================================
     * 6. RESOLVER ETAPA
     * ========================================================
     */

    let etapaIdFinal =
      body.etapa_id !== undefined
        ? body.etapa_id || null
        : projetoAtual.etapa_id;

    const faseOrigemRecebida =
      typeof body.fase_origem === "string"
        ? body.fase_origem.trim()
        : "";

    /*
     * Se fase_origem foi enviada,
     * localizar a etapa pelo nome.
     */

    if (faseOrigemRecebida) {
      const {
        data: etapaPorNome,
        error: etapaPorNomeError,
      } = await supabase
        .from("etapas")
        .select(
          "id, nome, ordem",
        )
        .ilike(
          "nome",
          faseOrigemRecebida,
        )
        .maybeSingle();

      if (etapaPorNomeError) {
        console.error(
          "[PUT /api/projetos/:id] Erro ao buscar etapa pelo nome:",
          etapaPorNomeError,
        );

        return NextResponse.json(
          {
            success: false,
            error:
              "Erro ao localizar a etapa informada.",
            details:
              etapaPorNomeError.message,
            code:
              etapaPorNomeError.code ??
              null,
          },
          {
            status: 500,
          },
        );
      }

      if (etapaPorNome) {
        etapaIdFinal =
          etapaPorNome.id;

        console.log(
          "[PUT /api/projetos/:id] Etapa resolvida pela fase:",
          {
            fase:
              faseOrigemRecebida,
            etapa_id:
              etapaPorNome.id,
            etapa_nome:
              etapaPorNome.nome,
          },
        );
      } else {
        return NextResponse.json(
          {
            success: false,
            error:
              `A etapa "${faseOrigemRecebida}" não foi encontrada.`,
          },
          {
            status: 400,
          },
        );
      }
    }

    /*
     * ========================================================
     * 7. VALIDAR ETAPA
     * ========================================================
     */

    let etapaFinal = null;

    if (etapaIdFinal) {
      const {
        data: etapaValida,
        error: etapaValidaError,
      } = await supabase
        .from("etapas")
        .select(
          "id, nome, ordem",
        )
        .eq("id", etapaIdFinal)
        .maybeSingle();

      if (etapaValidaError) {
        console.error(
          "[PUT /api/projetos/:id] Erro ao validar etapa:",
          etapaValidaError,
        );

        return NextResponse.json(
          {
            success: false,
            error:
              "Erro ao validar a etapa do projeto.",
            details:
              etapaValidaError.message,
            code:
              etapaValidaError.code ??
              null,
          },
          {
            status: 500,
          },
        );
      }

      if (!etapaValida) {
        return NextResponse.json(
          {
            success: false,
            error:
              "A etapa informada não existe.",
            etapa_id: etapaIdFinal,
          },
          {
            status: 400,
          },
        );
      }

      etapaFinal = etapaValida;
    }

    /*
     * ========================================================
     * 8. FASE DE ORIGEM
     * ========================================================
     */

    let faseOrigemFinal =
      body.fase_origem !== undefined
        ? body.fase_origem || null
        : projetoAtual.fase_origem;

    if (etapaFinal) {
      faseOrigemFinal =
        etapaFinal.nome;
    }

    /*
     * ========================================================
     * 9. MONTAR UPDATE
     * ========================================================
     */

    const updateData = {
      nome:
        typeof body.nome === "string"
          ? body.nome.trim()
          : projetoAtual.nome,

      plataforma:
        typeof body.plataforma === "string"
          ? body.plataforma.trim()
          : projetoAtual.plataforma,

      etapa_id:
        etapaIdFinal,

      setor:
        typeof body.setor === "string"
          ? body.setor.trim()
          : projetoAtual.setor,

      responsavel_id:
        body.responsavel_id !== undefined
          ? body.responsavel_id || null
          : projetoAtual.responsavel_id,

      responsavel_nome:
        typeof body.responsavel_nome ===
        "string"
          ? body.responsavel_nome.trim()
          : projetoAtual.responsavel_nome,

      status,

      prioridade,

      data_inicio:
        body.data_inicio !== undefined
          ? body.data_inicio || null
          : projetoAtual.data_inicio,

      data_fim:
        body.data_fim !== undefined
          ? body.data_fim || null
          : projetoAtual.data_fim,

      observacoes:
        body.observacoes !== undefined
          ? body.observacoes || null
          : projetoAtual.observacoes,

      fase_origem:
        faseOrigemFinal,

      percentual,

      updated_at:
        new Date().toISOString(),
    };

    /*
     * ========================================================
     * 10. LOG DO UPDATE
     * ========================================================
     */

    console.log(
      "[PUT /api/projetos/:id] UPDATE:",
      {
        id,
        usuario_id:
          usuarioAtual.usuarioId,
        usuario_nome:
          usuarioAtual.nome,
        perfil:
          usuarioAtual.perfil,
        etapa_id_anterior:
          projetoAtual.etapa_id,
        etapa_id_novo:
          updateData.etapa_id,
        fase_origem_anterior:
          projetoAtual.fase_origem,
        fase_origem_nova:
          updateData.fase_origem,
        updateData,
      },
    );

    /*
     * ========================================================
     * 11. EXECUTAR UPDATE
     * ========================================================
     */

    const {
      data: projetoAtualizadoDireto,
      error: updateError,
    } = await supabase
      .from("projetos")
      .update(updateData)
      .eq("id", id)
      .select("*")
      .maybeSingle();

    if (updateError) {
      console.error(
        "[PUT /api/projetos/:id] ERRO REAL NO UPDATE:",
        updateError,
      );

      return NextResponse.json(
        {
          success: false,
          error: updateError.message,
          details:
            updateError.details ??
            null,
          hint:
            updateError.hint ??
            null,
          code:
            updateError.code ??
            null,
        },
        {
          status: 500,
        },
      );
    }

    if (!projetoAtualizadoDireto) {
      console.error(
        "[PUT /api/projetos/:id] NENHUMA LINHA FOI ALTERADA:",
        {
          id,
          etapa_id_enviado:
            updateData.etapa_id,
          fase_origem_enviada:
            updateData.fase_origem,
        },
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "O banco não alterou nenhum registro.",
          details:
            "O UPDATE foi executado, porém nenhuma linha foi retornada. Verifique as políticas RLS/permissões da tabela projetos.",
          projeto_id: id,
          updateData,
        },
        {
          status: 403,
        },
      );
    }

    /*
     * ========================================================
     * 12. CONFIRMAÇÃO DO BANCO
     * ========================================================
     */

    console.log(
      "[PUT /api/projetos/:id] UPDATE CONFIRMADO PELO BANCO:",
      {
        id:
          projetoAtualizadoDireto.id,
        etapa_id:
          projetoAtualizadoDireto.etapa_id,
        fase_origem:
          projetoAtualizadoDireto.fase_origem,
      },
    );

    /*
     * ========================================================
     * 13. HISTÓRICO DE STATUS
     * ========================================================
     */

    if (
      projetoAtual.status !== status
    ) {
      const motivo =
        typeof body.motivo === "string"
          ? body.motivo.trim()
          : "Status alterado durante a edição do projeto.";

      const {
        error: historicoError,
      } = await supabase
        .from("historico_status")
        .insert({
          projeto_id: id,

          status_anterior:
            projetoAtual.status,

          status_novo:
            status,

          motivo,

          usuario_id:
            usuarioAtual.usuarioId,

          usuario_nome:
            usuarioAtual.nome,

          created_at:
            new Date().toISOString(),
        });

      if (historicoError) {
        console.error(
          "[PUT /api/projetos/:id] Erro ao registrar histórico:",
          historicoError,
        );
      }
    }

    /*
     * ========================================================
     * 14. AUDITORIA GERAL DO PROJETO
     * ========================================================
     * Registra somente os campos que realmente mudaram.
     * O historico_status continua existindo separadamente para
     * as regras específicas de movimentação do Kanban.
     * ========================================================
     */

    const valorHistorico = (valor: unknown) => {
      if (valor === null || valor === undefined || valor === "") {
        return null;
      }

      return String(valor);
    };

    const alteracoesProjeto: Array<{
      projeto_id: string;
      campo: string;
      valor_anterior: string | null;
      valor_novo: string | null;
      usuario_id: string | null;
      usuario_nome: string;
      origem: string;
      created_at: string;
    }> = [];

    const agoraHistorico = new Date().toISOString();

    const registrarAlteracao = (
      campo: string,
      valorAnterior: unknown,
      valorNovo: unknown,
    ) => {
      const anterior = valorHistorico(valorAnterior);
      const novo = valorHistorico(valorNovo);

      if (anterior === novo) {
        return;
      }

      alteracoesProjeto.push({
        projeto_id: id,
        campo,
        valor_anterior: anterior,
        valor_novo: novo,
        usuario_id: usuarioAtual.usuarioId ?? null,
        usuario_nome: usuarioAtual.nome || "Sistema",
        origem: "edicao",
        created_at: agoraHistorico,
      });
    };

    registrarAlteracao(
      "Nome",
      projetoAtual.nome,
      projetoAtualizadoDireto.nome,
    );

    registrarAlteracao(
      "Plataforma",
      projetoAtual.plataforma,
      projetoAtualizadoDireto.plataforma,
    );

    registrarAlteracao(
      "Etapa",
      projetoAtual.fase_origem,
      projetoAtualizadoDireto.fase_origem,
    );

    registrarAlteracao(
      "Setor",
      projetoAtual.setor,
      projetoAtualizadoDireto.setor,
    );

    registrarAlteracao(
      "Responsável",
      projetoAtual.responsavel_nome,
      projetoAtualizadoDireto.responsavel_nome,
    );

    registrarAlteracao(
      "Status",
      projetoAtual.status,
      projetoAtualizadoDireto.status,
    );

    registrarAlteracao(
      "Prioridade",
      projetoAtual.prioridade,
      projetoAtualizadoDireto.prioridade,
    );

    registrarAlteracao(
      "Data de início",
      projetoAtual.data_inicio,
      projetoAtualizadoDireto.data_inicio,
    );

    registrarAlteracao(
      "Data final",
      projetoAtual.data_fim,
      projetoAtualizadoDireto.data_fim,
    );

    registrarAlteracao(
      "Observações",
      projetoAtual.observacoes,
      projetoAtualizadoDireto.observacoes,
    );

    registrarAlteracao(
      "Progresso",
      projetoAtual.percentual !== null &&
        projetoAtual.percentual !== undefined
        ? `${projetoAtual.percentual}%`
        : null,
      projetoAtualizadoDireto.percentual !== null &&
        projetoAtualizadoDireto.percentual !== undefined
        ? `${projetoAtualizadoDireto.percentual}%`
        : null,
    );

    if (alteracoesProjeto.length > 0) {
      const { error: auditoriaError } =
        await supabase
          .from("historico_projeto")
          .insert(alteracoesProjeto);

      if (auditoriaError) {
        console.error(
          "[PUT /api/projetos/:id] Erro ao registrar auditoria geral:",
          auditoriaError,
        );
      } else {
        console.log(
          "[PUT /api/projetos/:id] AUDITORIA REGISTRADA:",
          {
            projeto_id: id,
            total_alteracoes: alteracoesProjeto.length,
            campos: alteracoesProjeto.map(
              (item) => item.campo,
            ),
          },
        );
      }
    }

    /*
     * ========================================================
     * 15. BUSCAR PROJETO COMPLETO
     * ========================================================
     */

    const {
      data: projetoCompleto,
      error: projetoCompletoError,
    } = await supabase
      .from("projetos")
      .select(`
        *,
        cliente:clientes (
          id,
          nome
        ),
        etapa:etapas (
          id,
          nome,
          ordem
        )
      `)
      .eq("id", id)
      .maybeSingle();

    if (projetoCompletoError) {
      console.error(
        "[PUT /api/projetos/:id] Erro ao buscar projeto completo:",
        projetoCompletoError,
      );

      return NextResponse.json({
        success: true,
        message:
          "Projeto atualizado com sucesso.",
        projeto:
          projetoAtualizadoDireto,
      });
    }

    /*
     * ========================================================
     * 16. LOG FINAL
     * ========================================================
     */

    console.log(
      "[PUT /api/projetos/:id] PROJETO FINAL:",
      {
        id,

        etapa_id:
          projetoCompleto?.etapa_id,

        etapa:
          projetoCompleto?.etapa?.nome,

        fase_origem:
          projetoCompleto?.fase_origem,

        usuario:
          usuarioAtual.nome,

        perfil:
          usuarioAtual.perfil,
      },
    );

    return NextResponse.json({
      success: true,
      message:
        "Projeto atualizado com sucesso.",
      projeto:
        projetoCompleto ??
        projetoAtualizadoDireto,
    });
  } catch (error) {
    console.error(
      "[PUT /api/projetos/:id] Erro inesperado:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Erro inesperado ao atualizar projeto.",
      },
      {
        status: 500,
      },
    );
  }
}

/*
 * ============================================================
 * DELETE
 * ============================================================
 * Exclui um projeto.
 *
 * Permissão necessária:
 * excluir
 *
 * Perfis autorizados atualmente:
 *
 * CEO
 * Diretoria
 * P&D
 *
 * A autorização é feita no servidor através do usuário
 * autenticado no Supabase Auth.
 * ============================================================
 */

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    /*
     * ========================================================
     * 0. AUTORIZAÇÃO
     * ========================================================
     */

    const autorizacao =
      await requirePermission("excluir");

    if (!autorizacao.ok) {
      return NextResponse.json(
        {
          success: false,
          error: autorizacao.error,
        },
        {
          status: autorizacao.status,
        },
      );
    }

    const usuarioAtual =
      autorizacao.usuario;

    const { id } =
      await context.params;

    /*
     * ========================================================
     * 1. VALIDAR ID
     * ========================================================
     */

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error:
            "ID do projeto não informado.",
        },
        {
          status: 400,
        },
      );
    }

    const supabase =
      await createClient();

    /*
     * ========================================================
     * 2. CONFIRMAR QUE O PROJETO EXISTE
     * ========================================================
     */

    const {
      data: projeto,
      error: buscaError,
    } = await supabase
      .from("projetos")
      .select(
        "id, nome, cliente_id, status",
      )
      .eq("id", id)
      .maybeSingle();

    if (buscaError) {
      console.error(
        "[DELETE /api/projetos/:id] Erro ao buscar projeto:",
        buscaError,
      );

      return NextResponse.json(
        {
          success: false,
          error: buscaError.message,
          details:
            buscaError.details ??
            null,
          hint:
            buscaError.hint ??
            null,
          code:
            buscaError.code ??
            null,
        },
        {
          status: 500,
        },
      );
    }

    if (!projeto) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Projeto não encontrado.",
          projeto_id: id,
        },
        {
          status: 404,
        },
      );
    }

    /*
     * ========================================================
     * 3. LOG DE AUDITORIA
     * ========================================================
     */

    console.log(
      "[DELETE /api/projetos/:id] EXCLUSÃO AUTORIZADA:",
      {
        projeto_id:
          projeto.id,

        projeto_nome:
          projeto.nome,

        cliente_id:
          projeto.cliente_id,

        status:
          projeto.status,

        usuario_id:
          usuarioAtual.usuarioId,

        usuario_nome:
          usuarioAtual.nome,

        perfil:
          usuarioAtual.perfil,

        auth_user_id:
          usuarioAtual.authUserId,

        data:
          new Date().toISOString(),
      },
    );

    /*
     * ========================================================
     * 4. EXCLUIR PROJETO
     * ========================================================
     */

    const {
      error: deleteError,
    } = await supabase
      .from("projetos")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error(
        "[DELETE /api/projetos/:id] Erro ao excluir projeto:",
        deleteError,
      );

      return NextResponse.json(
        {
          success: false,
          error:
            deleteError.message,
          details:
            deleteError.details ??
            null,
          hint:
            deleteError.hint ??
            null,
          code:
            deleteError.code ??
            null,
        },
        {
          status: 500,
        },
      );
    }

    /*
     * ========================================================
     * 5. RETORNO
     * ========================================================
     */

    return NextResponse.json({
      success: true,

      message:
        "Projeto excluído com sucesso.",

      projeto: {
        id:
          projeto.id,

        nome:
          projeto.nome,
      },

      usuario: {
        id:
          usuarioAtual.usuarioId,

        nome:
          usuarioAtual.nome,

        perfil:
          usuarioAtual.perfil,
      },
    });
  } catch (error) {
    console.error(
      "[DELETE /api/projetos/:id] Erro inesperado:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Erro inesperado ao excluir projeto.",
      },
      {
        status: 500,
      },
    );
  }
}
