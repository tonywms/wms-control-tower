import { NextRequest, NextResponse } from "next/server";
import { unstable_rethrow } from "next/navigation";

import {
  fecharSemanasAnterioresPendentes,
  obterSemanaUtil,
  registrarFotografiaSemana,
} from "@/lib/plano-semana/historico";

import { executarRetencaoNotificacoes } from "@/lib/notificacoes/retencao";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  const iniciadoEm = new Date().toISOString();

  let inicioSemana: string | null = null;
  let fimSemana: string | null = null;

  try {
    /*
     * ============================================================
     * SEGURANÃ‡A DO CRON
     * ============================================================
     */
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      console.error(
        "[CRON plano-semana] CRON_SECRET nÃ£o configurado.",
      );

      return NextResponse.json(
        {
          success: false,
          error: "CRON_SECRET nÃ£o configurado.",
        },
        {
          status: 500,
        },
      );
    }

    const authorization =
      req.headers.get("authorization");



    /*
     * ============================================================
     * VALIDAÃ‡ÃƒO DO TOKEN
     * ============================================================
     */
    if (
      authorization !==
      `Bearer ${cronSecret}`
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "NÃ£o autorizado.",
        },
        {
          status: 401,
        },
      );
    }

    /*
     * ============================================================
     * 1. FECHAMENTO DE SEMANAS ANTERIORES
     * ============================================================
     */
    const fechamento =
      await fecharSemanasAnterioresPendentes();

    /*
     * ============================================================
     * 2. RETENÃ‡ÃƒO DE NOTIFICAÃ‡Ã•ES
     * ============================================================
     *
     * Regra:
     *
     * - NotificaÃ§Ã£o ativa:
     *      NUNCA Ã© excluÃ­da.
     *
     * - NotificaÃ§Ã£o resolvida hÃ¡ menos de 90 dias:
     *      permanece como histÃ³rico.
     *
     * - NotificaÃ§Ã£o resolvida hÃ¡ mais de 90 dias:
     *      Ã© excluÃ­da automaticamente.
     */
    const retencaoNotificacoes =
      await executarRetencaoNotificacoes();

    console.info(
      "[CRON notificacoes-retencao]",
      {
        diasRetencao:
          retencaoNotificacoes.diasRetencao,

        limite:
          retencaoNotificacoes.limite,

        excluidas:
          retencaoNotificacoes.excluidas,
      },
    );

    /*
     * ============================================================
     * 3. IDENTIFICAÃ‡ÃƒO DA SEMANA ATUAL
     * ============================================================
     */
    const semana =
      obterSemanaUtil();

    inicioSemana =
      semana.inicio;

    fimSemana =
      semana.fim;

    /*
     * ============================================================
     * 4. FOTOGRAFIA DA SEMANA
     * ============================================================
     */
    const resultado =
      await registrarFotografiaSemana({
        inicio:
          semana.inicio,

        fim:
          semana.fim,

        registradoPor:
          null,

        registradoPorNome:
          "AutomaÃ§Ã£o semanal",
      });

    const finalizadoEm =
      new Date().toISOString();

    /*
     * ============================================================
     * 5. AUDITORIA
     * ============================================================
     */
    const supabase =
      createAdminClient();

    const {
      error: auditoriaError,
    } = await supabase
      .from(
        "plano_semana_execucoes",
      )
      .insert({
        tipo_execucao:
          "Automatica",

        origem:
          "/api/cron/plano-semana",

        inicio_semana:
          semana.inicio,

        fim_semana:
          semana.fim,

        status_semana:
          resultado.statusFechamento,

        semanas_fechadas:
          fechamento.quantidade,

        sucesso:
          true,

        mensagem:
          resultado.message,

        erro:
          null,

        detalhes: {
          fechamento,

          retencao_notificacoes: {
            dias_retencao:
              retencaoNotificacoes.diasRetencao,

            limite:
              retencaoNotificacoes.limite,

            excluidas:
              retencaoNotificacoes.excluidas,
          },

          fotografia: {
            id:
              resultado.semana.id,

            planejadas:
              resultado.semana.planejadas,

            concluidas:
              resultado.semana.concluidas,

            pendentes:
              resultado.semana.pendentes,

            atrasadas:
              resultado.semana.atrasadas,

            percentual_execucao:
              resultado.semana.percentual_execucao,

            percentual_risco:
              resultado.semana.percentual_risco,
          },
        },

        iniciado_em:
          iniciadoEm,

        finalizado_em:
          finalizadoEm,
      });

    /*
     * ============================================================
     * 6. FALHA SOMENTE NA AUDITORIA
     * ============================================================
     */
    if (auditoriaError) {
      console.error(
        "[CRON plano-semana] ExecuÃ§Ã£o concluÃ­da, mas auditoria falhou:",
        auditoriaError,
      );

      return NextResponse.json(
        {
          success:
            false,

          automatico:
            true,

          audit_failed:
            true,

          error:
            "A captura automÃ¡tica foi executada, mas a auditoria nÃ£o pÃ´de ser registrada.",

          inicio:
            semana.inicio,

          fim:
            semana.fim,

          semana:
            resultado.semana,

          fechamento,

          retencaoNotificacoes,
        },
        {
          status: 500,
        },
      );
    }

    /*
     * ============================================================
     * 7. LOG DE SUCESSO
     * ============================================================
     */
    console.info(
      "[CRON plano-semana]",
      {
        inicio:
          semana.inicio,

        fim:
          semana.fim,

        status:
          resultado.statusFechamento,

        semanasFechadas:
          fechamento.quantidade,

        notificacoesExcluidas:
          retencaoNotificacoes.excluidas,

        registradoEm:
          finalizadoEm,
      },
    );

    /*
     * ============================================================
     * 8. RETORNO
     * ============================================================
     */
    return NextResponse.json({
      success:
        true,

      automatico:
        true,

      auditado:
        true,

      fechamento,

      retencaoNotificacoes,

      inicio:
        semana.inicio,

      fim:
        semana.fim,

      semana:
        resultado.semana,

      message:
        resultado.message,
    });
  } catch (error) {
    /*
     * NecessÃ¡rio para preservar os sinais internos
     * utilizados pelo Next.js.
     */
    unstable_rethrow(
      error,
    );

    console.error(
      "[CRON plano-semana]",
      error,
    );

    /*
     * ============================================================
     * AUDITORIA DE ERRO
     * ============================================================
     */
    try {
      const supabase =
        createAdminClient();

      await supabase
        .from(
          "plano_semana_execucoes",
        )
        .insert({
          tipo_execucao:
            "Automatica",

          origem:
            "/api/cron/plano-semana",

          inicio_semana:
            inicioSemana,

          fim_semana:
            fimSemana,

          status_semana:
            null,

          semanas_fechadas:
            0,

          sucesso:
            false,

          mensagem:
            null,

          erro:
            error instanceof Error
              ? error.message
              : "Erro desconhecido na captura automÃ¡tica.",

          detalhes: {},

          iniciado_em:
            iniciadoEm,

          finalizado_em:
            new Date().toISOString(),
        });
    } catch (auditError) {
      console.error(
        "[CRON plano-semana] Falha ao registrar auditoria do erro:",
        auditError,
      );
    }

    /*
     * ============================================================
     * RETORNO DO ERRO ORIGINAL
     * ============================================================
     */
    return NextResponse.json(
      {
        success:
          false,

        error:
          error instanceof Error
            ? error.message
            : "Erro na captura automÃ¡tica da semana.",
      },
      {
        status: 500,
      },
    );
  }
}

