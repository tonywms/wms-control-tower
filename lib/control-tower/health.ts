export const CONTROL_TOWER_HEALTH_RULE_VERSION =
  "CT-HEALTH-1.0";

export type OperationalHealth =
  | "Crítico"
  | "Atenção"
  | "Estável";

export type OperationalHealthInput = {
  status?: string | null;
  prioridade?: string | null;

  lateDays: number;

  hasOwner: boolean;
  hasDeadline: boolean;

  pendenciasVencidas?: number;
  impedimentosAbertos?: number;
  impedimentosCriticos?: number;
  marcosAtrasados?: number;
  acoesVencidas?: number;
};

export type OperationalHealthResult = {
  saude: OperationalHealth;
  score: number;
  motivos: string[];

  regra: {
    versao: string;
    bloqueado: boolean;
    pausado: boolean;
    prioridadeCritica: boolean;
    prioridadeAlta: boolean;
    atrasoDias: number;
    semResponsavel: boolean;
    semPrazo: boolean;
    pendenciasVencidas: number;
    impedimentosAbertos: number;
    impedimentosCriticos: number;
    marcosAtrasados: number;
    acoesVencidas: number;
  };
};

function normalize(value?: string | null) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function calculateOperationalHealth(
  input: OperationalHealthInput
): OperationalHealthResult {
  const status =
    normalize(input.status);

  const prioridade =
    normalize(input.prioridade);

  const lateDays =
    Math.max(
      0,
      Number(input.lateDays || 0)
    );

  const pendenciasVencidas =
    Math.max(
      0,
      Number(
        input.pendenciasVencidas || 0
      )
    );

  const impedimentosAbertos =
    Math.max(
      0,
      Number(
        input.impedimentosAbertos || 0
      )
    );

  const impedimentosCriticos =
    Math.max(
      0,
      Number(
        input.impedimentosCriticos || 0
      )
    );

  const marcosAtrasados =
    Math.max(
      0,
      Number(
        input.marcosAtrasados || 0
      )
    );

  const acoesVencidas =
    Math.max(
      0,
      Number(
        input.acoesVencidas || 0
      )
    );

  const bloqueado =
    status === "bloqueado";

  const pausado =
    status === "pausado";

  const prioridadeCritica =
    prioridade === "critica";

  const prioridadeAlta =
    prioridade === "alta";

  const semResponsavel =
    !input.hasOwner;

  const semPrazo =
    !input.hasDeadline;

  const motivos: string[] = [];

  if (bloqueado) {
    motivos.push("Bloqueado");
  }

  if (pausado) {
    motivos.push("Pausado");
  }

  if (lateDays > 0) {
    motivos.push(
      `${lateDays}d de atraso`
    );
  }

  if (prioridadeCritica) {
    motivos.push(
      "Prioridade crítica"
    );
  } else if (prioridadeAlta) {
    motivos.push(
      "Prioridade alta"
    );
  }

  if (semResponsavel) {
    motivos.push(
      "Sem responsável"
    );
  }

  if (semPrazo) {
    motivos.push(
      "Sem prazo"
    );
  }

  if (pendenciasVencidas > 0) {
    motivos.push(
      `${pendenciasVencidas} pendência(s) vencida(s)`
    );
  }

  if (impedimentosAbertos > 0) {
    motivos.push(
      `${impedimentosAbertos} impedimento(s)`
    );
  }

  if (marcosAtrasados > 0) {
    motivos.push(
      `${marcosAtrasados} marco(s) atrasado(s)`
    );
  }

  if (acoesVencidas > 0) {
    motivos.push(
      `${acoesVencidas} ação(ões) vencida(s)`
    );
  }

  // CRÍTICO
  // ----------------------------------------------------------
  // - impedimento crítico
  // - status bloqueado
  // - atraso >= 15 dias
  // - atraso >= 7 dias + prioridade alta/crítica
  // - pausado e atrasado

  const critico =
    impedimentosCriticos > 0 ||
    bloqueado ||
    lateDays >= 15 ||
    (
      lateDays >= 7 &&
      (
        prioridadeCritica ||
        prioridadeAlta
      )
    ) ||
    (
      pausado &&
      lateDays > 0
    );

  // ATENÇÃO
  // ----------------------------------------------------------
  // Se não for crítico e possuir qualquer pressão operacional.

  const atencao =
    !critico &&
    (
      lateDays > 0 ||
      prioridadeCritica ||
      pausado ||
      semResponsavel ||
      (
        semPrazo &&
        (
          prioridadeAlta ||
          prioridadeCritica
        )
      ) ||
      pendenciasVencidas > 0 ||
      impedimentosAbertos > 0 ||
      marcosAtrasados > 0 ||
      acoesVencidas > 0
    );

  const saude: OperationalHealth =
    critico
      ? "Crítico"
      : atencao
        ? "Atenção"
        : "Estável";

  // SCORE serve para ordenar pressão.
  // NÃO muda sozinho a classificação.

  let score =
    critico
      ? 100
      : atencao
        ? 50
        : 0;

  if (bloqueado) {
    score += 40;
  }

  if (lateDays > 0) {
    score += Math.min(
      30,
      lateDays
    );
  }

  if (prioridadeCritica) {
    score += 20;
  } else if (prioridadeAlta) {
    score += 10;
  }

  if (pausado) {
    score += 8;
  }

  if (semResponsavel) {
    score += 5;
  }

  if (
    semPrazo &&
    (
      prioridadeAlta ||
      prioridadeCritica
    )
  ) {
    score += 3;
  }

  score +=
    impedimentosCriticos * 40;

  score +=
    pendenciasVencidas * 20;

  score +=
    impedimentosAbertos * 20;

  score +=
    marcosAtrasados * 15;

  score +=
    acoesVencidas * 15;

  return {
    saude,
    score,
    motivos,

    regra: {
      versao:
        CONTROL_TOWER_HEALTH_RULE_VERSION,

      bloqueado,
      pausado,

      prioridadeCritica,
      prioridadeAlta,

      atrasoDias:
        lateDays,

      semResponsavel,
      semPrazo,

      pendenciasVencidas,
      impedimentosAbertos,
      impedimentosCriticos,
      marcosAtrasados,
      acoesVencidas,
    },
  };
}
