import { NextRequest, NextResponse } from "next/server";
import { unstable_rethrow } from "next/navigation";

import {
  fecharSemanasAnterioresPendentes,
  obterSemanaUtil,
  registrarFotografiaSemana,
} from "@/lib/plano-semana/historico";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  const iniciadoEm = new Date().toISOString();
  let inicioSemana: string | null = null;
  let fimSemana: string | null = null;

  try {
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      console.error("[CRON plano-semana] CRON_SECRET não configurado.");

      return NextResponse.json(
        {
          success: false,
          error: "CRON_SECRET não configurado.",
        },
        { status: 500 },
      );
    }

    const authorization = req.headers.get("authorization");

    if (authorization !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        {
          success: false,
          error: "Não autorizado.",
        },
        { status: 401 },
      );
    }

    const fechamento = await fecharSemanasAnterioresPendentes();

    const semana = obterSemanaUtil();

    inicioSemana = semana.inicio;
    fimSemana = semana.fim;

    const resultado = await registrarFotografiaSemana({
      inicio: semana.inicio,
      fim: semana.fim,
      registradoPor: null,
      registradoPorNome: "Automação semanal",
    });

    const finalizadoEm = new Date().toISOString();

    const supabase = createAdminClient();

    const { error: auditoriaError } = await supabase
      .from("plano_semana_execucoes")
      .insert({
        tipo_execucao: "Automatica",
        origem: "/api/cron/plano-semana",
        inicio_semana: semana.inicio,
        fim_semana: semana.fim,
        status_semana: resultado.statusFechamento,
        semanas_fechadas: fechamento.quantidade,
        sucesso: true,
        mensagem: resultado.message,
        erro: null,
        detalhes: {
          fechamento,
          fotografia: {
            id: resultado.semana.id,
            planejadas: resultado.semana.planejadas,
            concluidas: resultado.semana.concluidas,
            pendentes: resultado.semana.pendentes,
            atrasadas: resultado.semana.atrasadas,
            percentual_execucao: resultado.semana.percentual_execucao,
            percentual_risco: resultado.semana.percentual_risco,
          },
        },
        iniciado_em: iniciadoEm,
        finalizado_em: finalizadoEm,
      });

    if (auditoriaError) {
      console.error(
        "[CRON plano-semana] Execução concluída, mas auditoria falhou:",
        auditoriaError,
      );

      return NextResponse.json(
        {
          success: false,
          automatico: true,
          audit_failed: true,
          error:
            "A captura automática foi executada, mas a auditoria não pôde ser registrada.",
          inicio: semana.inicio,
          fim: semana.fim,
          semana: resultado.semana,
          fechamento,
        },
        { status: 500 },
      );
    }

    console.info("[CRON plano-semana]", {
      inicio: semana.inicio,
      fim: semana.fim,
      status: resultado.statusFechamento,
      semanasFechadas: fechamento.quantidade,
      registradoEm: finalizadoEm,
    });

    return NextResponse.json({
      success: true,
      automatico: true,
      auditado: true,
      fechamento,
      inicio: semana.inicio,
      fim: semana.fim,
      semana: resultado.semana,
      message: resultado.message,
    });
  } catch (error) {
    unstable_rethrow(error);

    console.error("[CRON plano-semana]", error);

    /*
     * Tenta registrar também a falha da execução.
     * Essa tentativa não deve mascarar o erro original.
     */
    try {
      const supabase = createAdminClient();

      await supabase.from("plano_semana_execucoes").insert({
        tipo_execucao: "Automatica",
        origem: "/api/cron/plano-semana",
        inicio_semana: inicioSemana,
        fim_semana: fimSemana,
        status_semana: null,
        semanas_fechadas: 0,
        sucesso: false,
        mensagem: null,
        erro:
          error instanceof Error
            ? error.message
            : "Erro desconhecido na captura automática.",
        detalhes: {},
        iniciado_em: iniciadoEm,
        finalizado_em: new Date().toISOString(),
      });
    } catch (auditError) {
      console.error(
        "[CRON plano-semana] Falha ao registrar auditoria do erro:",
        auditError,
      );
    }

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Erro na captura automática da semana.",
      },
      { status: 500 },
    );
  }
}