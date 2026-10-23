import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

const FECHADAS = new Set([
  "Concluída",
  "Concluído",
  "Cancelada",
  "Cancelado",
]);

type RegistrarFotografiaSemanaParams = {
  inicio: string;
  fim: string;
  registradoPor?: string | null;
  registradoPorNome?: string | null;
};

function dataValida(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

export function obterSemanaUtil(dataBase = new Date()) {
  const hoje = new Date(dataBase);
  hoje.setHours(0, 0, 0, 0);

  const dia = hoje.getDay();

  const inicio = new Date(hoje);

  if (dia === 0) {
    inicio.setDate(hoje.getDate() + 1);
  } else if (dia === 6) {
    inicio.setDate(hoje.getDate() + 2);
  } else {
    inicio.setDate(hoje.getDate() - (dia - 1));
  }

  const fim = new Date(inicio);
  fim.setDate(inicio.getDate() + 4);

  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate(),
    ).padStart(2, "0")}`;

  return {
    inicio: iso(inicio),
    fim: iso(fim),
    hoje: iso(hoje),
  };
}

export async function registrarFotografiaSemana({
  inicio,
  fim,
  registradoPor = null,
  registradoPorNome = "Sistema",
}: RegistrarFotografiaSemanaParams) {
  if (!dataValida(inicio) || !dataValida(fim) || inicio > fim) {
    throw new Error("Período semanal inválido.");
  }

  const supabase = createAdminClient();

  const { data: acoes, error: acoesError } = await supabase
    .from("projeto_acoes")
    .select(`
      id,
      projeto_id,
      titulo,
      status,
      prioridade,
      prazo,
      concluida_em,
      responsavel_id,
      responsavel:usuarios!projeto_acoes_responsavel_id_fkey(id,nome)
    `)
    .gte("prazo", inicio)
    .lte("prazo", fim);

  if (acoesError) {
    throw new Error(acoesError.message);
  }

  const itens = (acoes ?? []).filter(
    (acao: any) =>
      acao.status !== "Cancelada" && acao.status !== "Cancelado",
  );

  const hoje = new Date().toISOString().slice(0, 10);

  const concluidas = itens.filter(
    (acao: any) =>
      acao.status === "Concluída" || acao.status === "Concluído",
  );

  const pendentes = itens.filter(
    (acao: any) => !FECHADAS.has(acao.status),
  );

  const atrasadas = pendentes.filter(
    (acao: any) => !!acao.prazo && acao.prazo < hoje,
  );

  const porResponsavel = new Map<
    string,
    {
      nome: string;
      planejadas: number;
      concluidas: number;
      pendentes: number;
      atrasadas: number;
      percentual: number;
    }
  >();

  for (const acao of itens as any[]) {
    const rel = Array.isArray(acao.responsavel)
      ? acao.responsavel[0]
      : acao.responsavel;

    const nome = rel?.nome ?? "Sem responsável";

    const atual = porResponsavel.get(nome) ?? {
      nome,
      planejadas: 0,
      concluidas: 0,
      pendentes: 0,
      atrasadas: 0,
      percentual: 0,
    };

    atual.planejadas += 1;

    if (
      acao.status === "Concluída" ||
      acao.status === "Concluído"
    ) {
      atual.concluidas += 1;
    } else if (!FECHADAS.has(acao.status)) {
      atual.pendentes += 1;

      if (acao.prazo && acao.prazo < hoje) {
        atual.atrasadas += 1;
      }
    }

    porResponsavel.set(nome, atual);
  }

  const responsaveis = [...porResponsavel.values()]
    .map((responsavel) => ({
      ...responsavel,
      percentual: responsavel.planejadas
        ? Math.round(
            (responsavel.concluidas / responsavel.planejadas) * 100,
          )
        : 0,
    }))
    .sort(
      (a, b) =>
        b.planejadas - a.planejadas ||
        b.percentual - a.percentual,
    );

  const planejadas = itens.length;

  const percentualExecucao = planejadas
    ? Math.round((concluidas.length / planejadas) * 100)
    : 0;

  const percentualRisco = planejadas
    ? Math.round((atrasadas.length / planejadas) * 100)
    : 0;

  /*
   * IMPORTANTE:
   * O fechamento definitivo é tratado separadamente pela automação semanal.
   *
   * Esta função registra/atualiza a fotografia da semana.
   * Enquanto a semana ainda está em andamento ela permanece Parcial.
   */
  const statusFechamento = hoje > fim ? "Fechada" : "Parcial";

  const agora = new Date().toISOString();

  const registro = {
    inicio_semana: inicio,
    fim_semana: fim,
    status_fechamento: statusFechamento,
    planejadas,
    concluidas: concluidas.length,
    pendentes: pendentes.length,
    atrasadas: atrasadas.length,
    percentual_execucao: percentualExecucao,
    percentual_risco: percentualRisco,
    responsaveis,
    registrado_por: registradoPor,
    registrado_por_nome: registradoPorNome || "Sistema",
    registrado_em: agora,
    atualizado_em: agora,
  };

  const { data, error } = await supabase
    .from("plano_semana_historico")
    .upsert(registro, {
      onConflict: "inicio_semana,fim_semana",
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return {
    semana: data,
    statusFechamento,
    message:
      statusFechamento === "Fechada"
        ? "Semana fechada e registrada no histórico."
        : "Fotografia parcial da semana registrada no histórico.",
  };
}

export async function fecharSemanasAnterioresPendentes() {
  const supabase = createAdminClient();

  const hoje = new Date().toISOString().slice(0, 10);

  const { data: semanas, error } = await supabase
    .from("plano_semana_historico")
    .select("id,inicio_semana,fim_semana,status_fechamento")
    .eq("status_fechamento", "Parcial")
    .lt("fim_semana", hoje)
    .order("fim_semana", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const resultados = [];

  for (const semana of semanas ?? []) {
    const resultado = await registrarFotografiaSemana({
      inicio: semana.inicio_semana,
      fim: semana.fim_semana,
      registradoPor: null,
      registradoPorNome: "Fechamento automático semanal",
    });

    resultados.push({
      id: resultado.semana.id,
      inicio: semana.inicio_semana,
      fim: semana.fim_semana,
      status: resultado.statusFechamento,
    });
  }

  return {
    quantidade: resultados.length,
    semanas: resultados,
  };
}