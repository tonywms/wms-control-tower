"use client";

import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Gavel,
  History,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
  UserRound,
  ArrowDownRight,
  ArrowUpRight,
  CircleMinus,
  TimerReset,
  AlertTriangle,
  Eye,
  ShieldAlert,
  Activity,
  Target,
  TrendingUp,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type Decisao = {
  id: string;
  projeto_id: string;
  projeto_nome: string;
  cliente_nome: string;
  tipo: string;
  valor_anterior: string | null;
  valor_novo: string | null;
  justificativa: string | null;
  recomendacao: string | null;
  carga_origem: string | null;
  carga_destino: string | null;
  usuario_id: string | null;
  usuario_nome: string;
  created_at: string;
  detalhes: string | null;
  score_antes?: number | null;
  score_depois?: number | null;
  urgencia_antes?: number | null;
  urgencia_depois?: number | null;
  resultado?: "Melhorou" | "Estável" | "Piorou" | "Sem medição";
  resultado_texto?: string;
  horas_desde_decisao?: number;
  score_atual?: number | null;
  urgencia_atual?: number | null;
  quadrante_atual?: Quadrante | null;
  resultado_real?: "Melhorou" | "Estável" | "Piorou" | "Sem medição";
  resultado_real_texto?: string;
  saude_atual?: "Estável" | "Atenção" | "Crítico" | null;
  status_atual?: string | null;
  progresso_atual?: number | null;
  pendencias_vencidas_atual?: number;
  impedimentos_abertos_atual?: number;
  impedimentos_criticos_atual?: number;
  marcos_atrasados_atual?: number;
  acoes_vencidas_atual?: number;
  projeto_atrasado_atual?: boolean;
  efetividade?: "Eficaz" | "Monitorar" | "Revisar" | "Sem medição";
  efetividade_texto?: string;
};

type ProjetoDashboard = {
  id: string;
  nome: string;
  status: string;
  prioridade: string;
  percentual: number;
  data_fim: string | null;
  cliente: { id: string; nome: string } | null;
  etapa: { id: string; nome: string; ordem: number } | null;
  responsavel: { id: string; nome: string } | null;
  saude: "Estável" | "Atenção" | "Crítico";
  indicadores: {
    projetoAtrasado: boolean;
    pendenciasAbertas: number;
    pendenciasVencidas: number;
    impedimentosAbertos: number;
    impedimentosCriticos: number;
    marcosAtrasados: number;
    acoesVencidas: number;
  };
};

type DashboardResponse = {
  success: boolean;
  projetos?: ProjetoDashboard[];
  error?: string;
};

type Quadrante = "Agir agora" | "Proteger" | "Planejar" | "Monitorar";

type LeituraAtual = {
  score: number;
  impacto: number;
  urgencia: number;
  quadrante: Quadrante;
};

type ResponseData = {
  success: boolean;
  atualizado_em?: string;
  resumo?: {
    total: number;
    projetos_impactados: number;
    ultimos_7_dias: number;
    decisores: number;
  };
  decisoes?: Decisao[];
  error?: string;
};

type AcompanhamentoGerencial = {
  decisao_id: string;
  acao: "manter" | "encerrar";
  justificativa: string | null;
  usuario_nome: string;
  created_at: string;
};

type Props = {
  onOpenProjeto?: (projetoId: string) => void;
};

function diasAte(data?: string | null) {
  if (!data) return null;

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const alvo = new Date(`${data}T12:00:00`);
  alvo.setHours(0, 0, 0, 0);

  return Math.ceil((alvo.getTime() - hoje.getTime()) / 86400000);
}

function prioridadePeso(prioridade: string) {
  if (prioridade === "Crítica") return 100;
  if (prioridade === "Alta") return 75;
  if (prioridade === "Normal") return 50;
  return 25;
}

function classificarAtual(projeto: ProjetoDashboard): LeituraAtual {
  const dias = diasAte(projeto.data_fim);

  let impacto = prioridadePeso(projeto.prioridade);

  if (projeto.saude === "Crítico") impacto += 20;
  else if (projeto.saude === "Atenção") impacto += 10;

  if (projeto.indicadores.impedimentosCriticos > 0) impacto += 20;

  if ((projeto.etapa?.nome ?? "").toLowerCase().includes("go-live")) {
    impacto += 10;
  }

  impacto = Math.min(100, impacto);

  let urgencia = 10;

  if (projeto.indicadores.projetoAtrasado || (dias !== null && dias < 0)) {
    urgencia += 55;
  } else if (dias !== null && dias <= 7) {
    urgencia += 40;
  } else if (dias !== null && dias <= 15) {
    urgencia += 25;
  } else if (dias !== null && dias <= 30) {
    urgencia += 15;
  }

  if (projeto.status === "Bloqueado") urgencia += 30;
  if (projeto.status === "Pausado") urgencia += 20;

  if (projeto.indicadores.pendenciasVencidas > 0) {
    urgencia += Math.min(20, projeto.indicadores.pendenciasVencidas * 8);
  }

  if (projeto.indicadores.marcosAtrasados > 0) {
    urgencia += Math.min(20, projeto.indicadores.marcosAtrasados * 8);
  }

  if (projeto.indicadores.acoesVencidas > 0) {
    urgencia += Math.min(20, projeto.indicadores.acoesVencidas * 8);
  }

  if (projeto.indicadores.impedimentosAbertos > 0) {
    urgencia += Math.min(20, projeto.indicadores.impedimentosAbertos * 8);
  }

  urgencia = Math.min(100, urgencia);

  const score = Math.round(impacto * 0.45 + urgencia * 0.55);

  let quadrante: Quadrante;
  if (impacto >= 60 && urgencia >= 60) quadrante = "Agir agora";
  else if (impacto >= 60) quadrante = "Proteger";
  else if (urgencia >= 60) quadrante = "Planejar";
  else quadrante = "Monitorar";

  return { score, impacto, urgencia, quadrante };
}

function resultadoReal(
  scoreReferencia: number | null | undefined,
  scoreAtual: number | null | undefined,
  urgenciaReferencia: number | null | undefined,
  urgenciaAtual: number | null | undefined,
) {
  const deltas: number[] = [];

  if (scoreReferencia != null && scoreAtual != null) {
    deltas.push(scoreAtual - scoreReferencia);
  }

  if (urgenciaReferencia != null && urgenciaAtual != null) {
    deltas.push(urgenciaAtual - urgenciaReferencia);
  }

  if (!deltas.length) {
    return {
      resultado: "Sem medição" as const,
      texto: "A decisão não possui indicadores de referência suficientes para comparar com a situação atual.",
    };
  }

  const soma = deltas.reduce((acc, item) => acc + item, 0);

  if (soma < 0) {
    return {
      resultado: "Melhorou" as const,
      texto: "A situação atual está melhor que o cenário registrado após a decisão.",
    };
  }

  if (soma > 0) {
    return {
      resultado: "Piorou" as const,
      texto: "A situação atual está pior que o cenário registrado após a decisão.",
    };
  }

  return {
    resultado: "Estável" as const,
    texto: "A situação atual permanece equivalente ao cenário registrado após a decisão.",
  };
}

function avaliarEfetividade(
  projeto: ProjetoDashboard | undefined,
  resultado: "Melhorou" | "Estável" | "Piorou" | "Sem medição",
) {
  if (!projeto) {
    return {
      efetividade: "Sem medição" as const,
      texto: "Projeto não localizado na situação atual da carteira.",
    };
  }

  const riscosAtuais =
    projeto.indicadores.pendenciasVencidas +
    projeto.indicadores.impedimentosAbertos +
    projeto.indicadores.marcosAtrasados +
    projeto.indicadores.acoesVencidas;

  const riscoCritico =
    projeto.saude === "Crítico" ||
    projeto.indicadores.impedimentosCriticos > 0;

  const operacaoSaudavel =
    !riscoCritico &&
    !projeto.indicadores.projetoAtrasado &&
    riscosAtuais === 0 &&
    projeto.status !== "Bloqueado";

  if (resultado === "Piorou" || riscoCritico) {
    return {
      efetividade: "Revisar" as const,
      texto:
        resultado === "Piorou"
          ? "Os indicadores executivos deterioraram após a decisão. Recomenda-se nova análise gerencial."
          : "Há risco crítico ativo no projeto. A decisão precisa ser reavaliada.",
    };
  }

  if (resultado === "Melhorou" && operacaoSaudavel) {
    return {
      efetividade: "Eficaz" as const,
      texto: "A decisão melhorou os indicadores e o projeto está operacionalmente saudável.",
    };
  }

  if (resultado === "Melhorou") {
    return {
      efetividade: "Monitorar" as const,
      texto: `A decisão melhorou os indicadores, mas ainda existem ${riscosAtuais} risco(s) operacional(is) ou condição de atenção.`,
    };
  }

  if (resultado === "Estável" && operacaoSaudavel) {
    return {
      efetividade: "Eficaz" as const,
      texto: "Os indicadores permaneceram estáveis e não há risco operacional relevante ativo.",
    };
  }

  return {
    efetividade: "Monitorar" as const,
    texto: "A decisão ainda não demonstrou ganho suficiente ou o projeto mantém pontos de atenção.",
  };
}

function formatarDataHora(value: string) {
  const data = new Date(value);

  if (Number.isNaN(data.getTime())) return value;

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(data);
}

function tempoDesdeDecisao(value: string) {
  const data = new Date(value).getTime();
  if (!Number.isFinite(data)) return "tempo não disponível";

  const diff = Math.max(0, Date.now() - data);
  const horas = Math.floor(diff / 3600000);

  if (horas < 1) return "há menos de 1h";
  if (horas < 24) return `há ${horas}h`;

  const dias = Math.floor(horas / 24);
  return `há ${dias} dia(s)`;
}

export default function CentralDecisoes({ onOpenProjeto }: Props) {
  const [decisoes, setDecisoes] = useState<Decisao[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busca, setBusca] = useState("");
  const [projetosAtuais, setProjetosAtuais] = useState<ProjetoDashboard[]>([]);
  const [acompanhamentos, setAcompanhamentos] = useState<AcompanhamentoGerencial[]>([]);
  const [decisaoReavaliacao, setDecisaoReavaliacao] = useState<Decisao | null>(null);
  const [justificativaReavaliacao, setJustificativaReavaliacao] = useState("");
  const [salvandoReavaliacao, setSalvandoReavaliacao] = useState(false);
  const [erroReavaliacao, setErroReavaliacao] = useState("");

  const carregar = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const [response, dashboardResponse, acompanhamentoResponse] = await Promise.all([
        fetch("/api/governanca/decisoes", {
          cache: "no-store",
          credentials: "same-origin",
        }),
        fetch("/api/dashboard/executivo", {
          cache: "no-store",
          credentials: "same-origin",
        }),
        fetch("/api/governanca/reavaliacoes", {
          cache: "no-store",
          credentials: "same-origin",
        }),
      ]);

      const data = (await response.json()) as ResponseData;
      const dashboard = (await dashboardResponse.json()) as DashboardResponse;
      const acompanhamentoData = await acompanhamentoResponse.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || `Erro HTTP ${response.status}`);
      }

      if (!dashboardResponse.ok || !dashboard.success) {
        throw new Error(
          dashboard.error || `Erro HTTP ${dashboardResponse.status} ao carregar situação atual.`,
        );
      }

      if (!acompanhamentoResponse.ok || !acompanhamentoData.success) {
        throw new Error(
          acompanhamentoData.error ||
            `Erro HTTP ${acompanhamentoResponse.status} ao carregar reavaliações.`,
        );
      }

      setDecisoes(data.decisoes ?? []);
      setProjetosAtuais(dashboard.projetos ?? []);
      setAcompanhamentos(acompanhamentoData.acompanhamentos ?? []);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Erro ao carregar decisões gerenciais.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const decisoesComResultadoReal = useMemo(() => {
    const mapaProjetos = new Map(
      projetosAtuais.map((projeto) => [
        projeto.id,
        {
          projeto,
          leitura: classificarAtual(projeto),
        },
      ]),
    );

    return decisoes.map((item) => {
      const registroAtual = mapaProjetos.get(item.projeto_id);
      const atual = registroAtual?.leitura;
      const projetoAtual = registroAtual?.projeto;

      if (!atual || !projetoAtual) {
        return {
          ...item,
          score_atual: null,
          urgencia_atual: null,
          quadrante_atual: null,
          resultado_real: "Sem medição" as const,
          resultado_real_texto: "Projeto não localizado na situação atual da carteira.",
          efetividade: "Sem medição" as const,
          efetividade_texto: "Projeto não localizado na situação atual da carteira.",
        };
      }

      const leitura = resultadoReal(
        item.score_depois ?? item.score_antes,
        atual.score,
        item.urgencia_depois ?? item.urgencia_antes,
        atual.urgencia,
      );

      const efetividade = avaliarEfetividade(projetoAtual, leitura.resultado);

      return {
        ...item,
        score_atual: atual.score,
        urgencia_atual: atual.urgencia,
        quadrante_atual: atual.quadrante,
        resultado_real: leitura.resultado,
        resultado_real_texto: leitura.texto,
        saude_atual: projetoAtual.saude,
        status_atual: projetoAtual.status,
        progresso_atual: projetoAtual.percentual,
        pendencias_vencidas_atual: projetoAtual.indicadores.pendenciasVencidas,
        impedimentos_abertos_atual: projetoAtual.indicadores.impedimentosAbertos,
        impedimentos_criticos_atual: projetoAtual.indicadores.impedimentosCriticos,
        marcos_atrasados_atual: projetoAtual.indicadores.marcosAtrasados,
        acoes_vencidas_atual: projetoAtual.indicadores.acoesVencidas,
        projeto_atrasado_atual: projetoAtual.indicadores.projetoAtrasado,
        efetividade: efetividade.efetividade,
        efetividade_texto: efetividade.texto,
      };
    });
  }, [decisoes, projetosAtuais]);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();

    if (!q) return decisoesComResultadoReal;

    return decisoesComResultadoReal.filter((item) =>
      [
        item.projeto_nome,
        item.cliente_nome,
        item.tipo,
        item.valor_anterior,
        item.valor_novo,
        item.justificativa,
        item.recomendacao,
        item.usuario_nome,
        item.resultado,
        item.resultado_texto,
        item.resultado_real,
        item.resultado_real_texto,
        item.quadrante_atual,
        item.efetividade,
        item.efetividade_texto,
        item.saude_atual,
        item.status_atual,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [busca, decisoesComResultadoReal]);

  const acompanhamentoPorDecisao = useMemo(() => {
    const mapa = new Map<string, AcompanhamentoGerencial>();

    for (const item of acompanhamentos) {
      if (!mapa.has(item.decisao_id)) {
        mapa.set(item.decisao_id, item);
      }
    }

    return mapa;
  }, [acompanhamentos]);

  const registrarReavaliacao = useCallback(
    async (acao: "manter" | "encerrar") => {
      if (!decisaoReavaliacao) return;

      const justificativa = justificativaReavaliacao.trim();

      if (justificativa.length < 10) {
        setErroReavaliacao("Informe uma justificativa com pelo menos 10 caracteres.");
        return;
      }

      try {
        setSalvandoReavaliacao(true);
        setErroReavaliacao("");

        const response = await fetch("/api/governanca/reavaliacoes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({
            decisao_id: decisaoReavaliacao.id,
            projeto_id: decisaoReavaliacao.projeto_id,
            acao,
            justificativa,
            efetividade: decisaoReavaliacao.efetividade,
            score_atual: decisaoReavaliacao.score_atual,
            urgencia_atual: decisaoReavaliacao.urgencia_atual,
            saude_atual: decisaoReavaliacao.saude_atual,
            progresso_atual: decisaoReavaliacao.progresso_atual,
          }),
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || `Erro HTTP ${response.status}`);
        }

        setDecisaoReavaliacao(null);
        setJustificativaReavaliacao("");
        await carregar();
      } catch (e) {
        setErroReavaliacao(
          e instanceof Error ? e.message : "Erro ao registrar reavaliação gerencial.",
        );
      } finally {
        setSalvandoReavaliacao(false);
      }
    },
    [carregar, decisaoReavaliacao, justificativaReavaliacao],
  );

  const filaRevisao = useMemo(() => {
    const peso = (item: Decisao) => {
      if (item.efetividade === "Revisar") return 0;
      if (item.efetividade === "Monitorar") return 1;
      return 2;
    };

    return decisoesComResultadoReal
      .filter((item) => {
        const acompanhamento = acompanhamentoPorDecisao.get(item.id);

        if (acompanhamento?.acao === "encerrar") {
          return false;
        }

        return (
          item.efetividade === "Revisar" ||
          item.efetividade === "Monitorar"
        );
      })
      .sort((a, b) => {
        const prioridade = peso(a) - peso(b);
        if (prioridade !== 0) return prioridade;

        return (
          new Date(a.created_at).getTime() -
          new Date(b.created_at).getTime()
        );
      });
  }, [acompanhamentoPorDecisao, decisoesComResultadoReal]);

  const acompanhamentoExecutivo = useMemo(() => {
    const medidos = decisoesComResultadoReal.filter(
      (item) => item.efetividade !== "Sem medição",
    );

    const totalRiscos = decisoesComResultadoReal.reduce(
      (total, item) =>
        total +
        (item.pendencias_vencidas_atual ?? 0) +
        (item.impedimentos_abertos_atual ?? 0) +
        (item.marcos_atrasados_atual ?? 0) +
        (item.acoes_vencidas_atual ?? 0),
      0,
    );

    const projetosSaudaveis = new Set(
      decisoesComResultadoReal
        .filter(
          (item) =>
            item.saude_atual === "Estável" &&
            (item.pendencias_vencidas_atual ?? 0) === 0 &&
            (item.impedimentos_abertos_atual ?? 0) === 0 &&
            (item.marcos_atrasados_atual ?? 0) === 0 &&
            (item.acoes_vencidas_atual ?? 0) === 0,
        )
        .map((item) => item.projeto_id),
    ).size;

    const scoreMedioAtual = (() => {
      const valores = decisoesComResultadoReal
        .map((item) => item.score_atual)
        .filter((value): value is number => typeof value === "number");

      if (!valores.length) return 0;
      return Math.round(
        valores.reduce((total, value) => total + value, 0) / valores.length,
      );
    })();

    const urgenciaMediaAtual = (() => {
      const valores = decisoesComResultadoReal
        .map((item) => item.urgencia_atual)
        .filter((value): value is number => typeof value === "number");

      if (!valores.length) return 0;
      return Math.round(
        valores.reduce((total, value) => total + value, 0) / valores.length,
      );
    })();

    const eficacia = medidos.length
      ? Math.round(
          (medidos.filter((item) => item.efetividade === "Eficaz").length /
            medidos.length) *
            100,
        )
      : 0;

    return {
      medidos: medidos.length,
      eficacia,
      totalRiscos,
      projetosSaudaveis,
      scoreMedioAtual,
      urgenciaMediaAtual,
    };
  }, [decisoesComResultadoReal]);

  const resumo = useMemo(() => {
    const agora = Date.now();
    const seteDias = 7 * 24 * 60 * 60 * 1000;

    return {
      total: decisoes.length,
      projetos: new Set(decisoes.map((item) => item.projeto_id)).size,
      ultimos7dias: decisoes.filter((item) => {
        const data = new Date(item.created_at).getTime();
        return Number.isFinite(data) && agora - data <= seteDias;
      }).length,
      decisores: new Set(decisoes.map((item) => item.usuario_nome)).size,
      melhoraram: decisoesComResultadoReal.filter((item) => item.resultado_real === "Melhorou").length,
      pioraram: decisoesComResultadoReal.filter((item) => item.resultado_real === "Piorou").length,
      eficazes: decisoesComResultadoReal.filter((item) => item.efetividade === "Eficaz").length,
      monitorar: decisoesComResultadoReal.filter((item) => item.efetividade === "Monitorar").length,
      revisar: decisoesComResultadoReal.filter((item) => item.efetividade === "Revisar").length,
      taxa_eficacia: (() => {
        const medidos = decisoesComResultadoReal.filter(
          (item) => item.efetividade !== "Sem medição",
        );
        if (!medidos.length) return 0;
        const eficazes = medidos.filter((item) => item.efetividade === "Eficaz").length;
        return Math.round((eficazes / medidos.length) * 100);
      })(),
    };
  }, [decisoes, decisoesComResultadoReal]);

  const resumoAcompanhamento = useMemo(() => {
    const encerrados = acompanhamentos.filter((item) => item.acao === "encerrar");
    const monitoramentos = acompanhamentos.filter((item) => item.acao === "manter");

    return {
      encerrados: encerrados.length,
      monitoramentos: monitoramentos.length,
      projetosEncerrados: new Set(
        encerrados
          .map((item) => {
            const decisao = decisoes.find((d) => d.id === item.decisao_id);
            return decisao?.projeto_id;
          })
          .filter(Boolean),
      ).size,
    };
  }, [acompanhamentos, decisoes]);

  const decisoesEncerradas = useMemo(() => {
    return decisoesComResultadoReal
      .map((decisao) => {
        const acompanhamento = acompanhamentoPorDecisao.get(decisao.id);
        return acompanhamento?.acao === "encerrar"
          ? { decisao, acompanhamento }
          : null;
      })
      .filter(
        (
          item,
        ): item is {
          decisao: Decisao;
          acompanhamento: AcompanhamentoGerencial;
        } => Boolean(item),
      )
      .sort(
        (a, b) =>
          new Date(b.acompanhamento.created_at).getTime() -
          new Date(a.acompanhamento.created_at).getTime(),
      );
  }, [acompanhamentoPorDecisao, decisoesComResultadoReal]);

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-400">
            <Gavel size={13} />
            Governança • Auditoria executiva
          </div>

          <h2 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-white">
            Central de Decisões
          </h2>

          <p className="mt-1 text-xs text-slate-500">
            Histórico consolidado das decisões gerenciais efetivamente aplicadas à carteira.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void carregar()}
          disabled={loading}
          className="flex h-9 items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 text-[10px] font-medium text-slate-400 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-50"
        >
          <RefreshCw
            size={13}
            className={loading ? "animate-spin" : ""}
          />
          Atualizar
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <Kpi
          icon={Gavel}
          label="Decisões aplicadas"
          value={resumo.total}
          tone="text-violet-300"
        />
        <Kpi
          icon={Sparkles}
          label="Projetos impactados"
          value={resumo.projetos}
          tone="text-sky-300"
        />
        <Kpi
          icon={Clock3}
          label="Últimos 7 dias"
          value={resumo.ultimos7dias}
          tone="text-amber-300"
        />
        <Kpi
          icon={UserRound}
          label="Decisores"
          value={resumo.decisores}
          tone="text-emerald-300"
        />
        <Kpi
          icon={ArrowDownRight}
          label="Melhoraram"
          value={resumo.melhoraram}
          tone="text-emerald-300"
        />
        <Kpi
          icon={ArrowUpRight}
          label="Pioraram"
          value={resumo.pioraram}
          tone="text-red-300"
        />
      </div>

      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-3">
        <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-emerald-400/15 bg-emerald-500/[0.05] p-4">
          <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-emerald-400/70">Decisões eficazes</div>
          <div className="mt-2 text-2xl font-semibold text-emerald-300">{resumo.eficazes}</div>
        </div>
        <div className="rounded-2xl border border-amber-400/15 bg-amber-500/[0.05] p-4">
          <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-amber-400/70">Monitorar</div>
          <div className="mt-2 text-2xl font-semibold text-amber-300">{resumo.monitorar}</div>
        </div>
        <div className="rounded-2xl border border-red-400/15 bg-red-500/[0.05] p-4">
          <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-red-400/70">Revisar</div>
          <div className="mt-2 text-2xl font-semibold text-red-300">{resumo.revisar}</div>
        </div>
        <div className="rounded-2xl border border-sky-400/15 bg-sky-500/[0.05] p-4">
          <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-sky-400/70">Taxa de eficácia</div>
          <div className="mt-2 text-2xl font-semibold text-sky-300">{resumo.taxa_eficacia}%</div>
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-sky-400/15 bg-gradient-to-r from-sky-500/[0.055] via-white/[0.02] to-violet-500/[0.045]">
        <div className="flex flex-col gap-3 border-b border-white/[0.06] px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-sky-300">
              <Activity size={14} />
              Resultado da Governança
            </div>
            <p className="mt-1 text-[10px] text-slate-500">
              Leitura consolidada do efeito real das decisões aplicadas à carteira.
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-black/10 px-3 py-2">
            <Target size={13} className="text-emerald-300" />
            <span className="text-[9px] text-slate-500">Efetividade medida</span>
            <span className="text-sm font-bold text-white">
              {acompanhamentoExecutivo.eficacia}%
            </span>
          </div>
        </div>

        <div className="grid gap-3 p-3 sm:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-xl border border-emerald-400/15 bg-emerald-500/[0.045] px-3 py-3">
            <div className="text-[8px] font-bold uppercase tracking-[0.12em] text-emerald-300">
              Projetos saudáveis
            </div>
            <div className="mt-2 text-xl font-bold text-emerald-300">
              {acompanhamentoExecutivo.projetosSaudaveis}
            </div>
            <div className="mt-1 text-[8px] text-slate-600">
              estáveis e sem risco operacional aberto
            </div>
          </div>

          <div className="rounded-xl border border-sky-400/15 bg-sky-500/[0.045] px-3 py-3">
            <div className="text-[8px] font-bold uppercase tracking-[0.12em] text-sky-300">
              Score médio atual
            </div>
            <div className="mt-2 text-xl font-bold text-sky-300">
              {acompanhamentoExecutivo.scoreMedioAtual}
            </div>
            <div className="mt-1 text-[8px] text-slate-600">
              pressão executiva média da carteira decidida
            </div>
          </div>

          <div className="rounded-xl border border-amber-400/15 bg-amber-500/[0.045] px-3 py-3">
            <div className="text-[8px] font-bold uppercase tracking-[0.12em] text-amber-300">
              Urgência média atual
            </div>
            <div className="mt-2 text-xl font-bold text-amber-300">
              {acompanhamentoExecutivo.urgenciaMediaAtual}
            </div>
            <div className="mt-1 text-[8px] text-slate-600">
              urgência após as decisões gerenciais
            </div>
          </div>

          <div className="rounded-xl border border-violet-400/15 bg-violet-500/[0.045] px-3 py-3">
            <div className="text-[8px] font-bold uppercase tracking-[0.12em] text-violet-300">
              Riscos atuais
            </div>
            <div className="mt-2 text-xl font-bold text-violet-300">
              {acompanhamentoExecutivo.totalRiscos}
            </div>
            <div className="mt-1 text-[8px] text-slate-600">
              pendências, impedimentos, marcos e ações
            </div>
          </div>

          <div className="rounded-xl border border-white/[0.07] bg-black/10 px-3 py-3">
            <div className="flex items-center gap-1.5 text-[8px] font-bold uppercase tracking-[0.12em] text-slate-400">
              <TrendingUp size={10} />
              Decisões medidas
            </div>
            <div className="mt-2 text-xl font-bold text-white">
              {acompanhamentoExecutivo.medidos}
            </div>
            <div className="mt-1 text-[8px] text-slate-600">
              com resultado gerencial classificável
            </div>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-amber-400/15 bg-gradient-to-br from-amber-500/[0.045] via-white/[0.02] to-red-500/[0.035]">
        <div className="flex flex-col gap-3 border-b border-white/[0.06] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-amber-300">
              <ShieldAlert size={14} />
              Fila de Revisão Gerencial
            </div>
            <p className="mt-1 text-[10px] text-slate-500">
              Decisões que exigem acompanhamento ou nova análise executiva.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 text-[9px] font-semibold">
            <span className="rounded-full border border-red-400/20 bg-red-500/[0.08] px-2.5 py-1.5 text-red-300">
              {resumo.revisar} revisar agora
            </span>
            <span className="rounded-full border border-amber-400/20 bg-amber-500/[0.08] px-2.5 py-1.5 text-amber-300">
              {resumo.monitorar} em monitoramento
            </span>
          </div>
        </div>

        {filaRevisao.length === 0 ? (
          <div className="flex min-h-[120px] flex-col items-center justify-center px-4 py-6 text-center">
            <CheckCircle2 size={22} className="text-emerald-400" />
            <div className="mt-2 text-sm font-semibold text-slate-300">
              Nenhuma decisão exige revisão
            </div>
            <div className="mt-1 text-[10px] text-slate-600">
              Todas as decisões medidas estão eficazes ou sem necessidade de acompanhamento.
            </div>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.05]">
            {filaRevisao.map((item) => {
              const riscos =
                (item.pendencias_vencidas_atual ?? 0) +
                (item.impedimentos_abertos_atual ?? 0) +
                (item.marcos_atrasados_atual ?? 0) +
                (item.acoes_vencidas_atual ?? 0);

              const revisar = item.efetividade === "Revisar";

              return (
                <div
                  key={`revisao-${item.id}`}
                  className="grid gap-3 px-4 py-4 lg:grid-cols-[1.05fr_1.35fr_0.9fr_auto] lg:items-center"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={[
                          "rounded-full border px-2 py-1 text-[8px] font-bold uppercase tracking-[0.08em]",
                          revisar
                            ? "border-red-400/20 bg-red-500/[0.08] text-red-300"
                            : "border-amber-400/20 bg-amber-500/[0.08] text-amber-300",
                        ].join(" ")}
                      >
                        {item.efetividade}
                      </span>
                      <span className="text-[9px] text-slate-600">
                        {tempoDesdeDecisao(item.created_at)}
                      </span>
                    </div>

                    <div className="mt-2 truncate text-sm font-semibold text-white">
                      {item.projeto_nome}
                    </div>
                    <div className="mt-0.5 truncate text-[9px] text-slate-600">
                      {item.cliente_nome} • {item.tipo}
                    </div>
                  </div>

                  <div className="min-w-0 rounded-xl border border-white/[0.05] bg-black/10 px-3 py-2.5">
                    <div className="flex items-center gap-1.5 text-[8px] font-bold uppercase tracking-[0.12em] text-slate-600">
                      <AlertTriangle size={10} />
                      Motivo da revisão
                    </div>
                    <div className="mt-1.5 text-[10px] leading-4 text-slate-400">
                      {item.efetividade_texto ??
                        "A decisão requer acompanhamento gerencial."}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5 text-[8px]">
                    <div className="rounded-lg border border-white/[0.05] bg-black/10 px-2 py-2 text-slate-600">
                      Saúde
                      <div className="mt-1 font-semibold text-slate-300">
                        {item.saude_atual ?? "—"}
                      </div>
                    </div>
                    <div className="rounded-lg border border-white/[0.05] bg-black/10 px-2 py-2 text-slate-600">
                      Riscos
                      <div className="mt-1 font-semibold text-slate-300">
                        {riscos}
                      </div>
                    </div>
                    <div className="rounded-lg border border-white/[0.05] bg-black/10 px-2 py-2 text-slate-600">
                      Decisor
                      <div className="mt-1 truncate font-semibold text-slate-300">
                        {item.usuario_nome}
                      </div>
                    </div>
                  </div>

                  <div className="flex min-w-[150px] flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setDecisaoReavaliacao(item);
                        setJustificativaReavaliacao("");
                        setErroReavaliacao("");
                      }}
                      className={[
                        "flex h-9 items-center justify-center gap-2 rounded-xl border px-3 text-[9px] font-semibold transition",
                        revisar
                          ? "border-red-400/25 bg-red-500/[0.08] text-red-200 hover:bg-red-500/[0.14]"
                          : "border-amber-400/25 bg-amber-500/[0.08] text-amber-200 hover:bg-amber-500/[0.14]",
                      ].join(" ")}
                    >
                      <Eye size={12} />
                      Reavaliar projeto
                    </button>

                    <button
                      type="button"
                      onClick={() => onOpenProjeto?.(item.projeto_id)}
                      className="flex h-8 items-center justify-center gap-1.5 rounded-lg border border-sky-400/15 bg-sky-500/[0.05] px-3 text-[9px] text-sky-300 transition hover:bg-sky-500/[0.1]"
                    >
                      Projeto 360
                      <ChevronRight size={11} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border border-emerald-400/15 bg-gradient-to-br from-emerald-500/[0.045] via-white/[0.02] to-sky-500/[0.035]">
        <div className="flex flex-col gap-3 border-b border-white/[0.06] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-300">
              <CheckCircle2 size={14} />
              Ciclo de Governança Encerrado
            </div>
            <p className="mt-1 text-[10px] text-slate-500">
              Decisões formalmente reavaliadas e encerradas pela gestão.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 text-[9px] font-semibold">
            <span className="rounded-full border border-emerald-400/20 bg-emerald-500/[0.08] px-2.5 py-1.5 text-emerald-300">
              {resumoAcompanhamento.encerrados} encerrado(s)
            </span>
            <span className="rounded-full border border-sky-400/20 bg-sky-500/[0.08] px-2.5 py-1.5 text-sky-300">
              {resumoAcompanhamento.projetosEncerrados} projeto(s)
            </span>
          </div>
        </div>

        {decisoesEncerradas.length === 0 ? (
          <div className="flex min-h-[90px] flex-col items-center justify-center px-4 py-5 text-center">
            <CheckCircle2 size={20} className="text-slate-600" />
            <div className="mt-2 text-xs font-semibold text-slate-400">
              Nenhum acompanhamento encerrado
            </div>
            <div className="mt-1 text-[9px] text-slate-600">
              Ao encerrar uma reavaliação, o registro aparecerá aqui.
            </div>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.05]">
            {decisoesEncerradas.slice(0, 6).map(({ decisao, acompanhamento }) => (
              <div
                key={`encerrada-${decisao.id}`}
                className="grid gap-3 px-4 py-4 lg:grid-cols-[1fr_1.2fr_0.8fr_auto] lg:items-center"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full border border-emerald-400/20 bg-emerald-500/[0.08] px-2 py-1 text-[8px] font-bold uppercase tracking-[0.08em] text-emerald-300">
                      Encerrado
                    </span>
                    <span className="text-[9px] text-slate-600">
                      {formatarDataHora(acompanhamento.created_at)}
                    </span>
                  </div>
                  <div className="mt-2 truncate text-sm font-semibold text-white">
                    {decisao.projeto_nome}
                  </div>
                  <div className="mt-0.5 truncate text-[9px] text-slate-600">
                    {decisao.cliente_nome} • {decisao.tipo}
                  </div>
                </div>

                <div className="rounded-xl border border-white/[0.05] bg-black/10 px-3 py-2.5">
                  <div className="text-[8px] font-bold uppercase tracking-[0.12em] text-slate-600">
                    Parecer de encerramento
                  </div>
                  <div className="mt-1.5 line-clamp-2 text-[10px] leading-4 text-slate-400">
                    {acompanhamento.justificativa ?? "Encerrado sem parecer informado."}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-1.5 text-[8px]">
                  <div className="rounded-lg border border-white/[0.05] bg-black/10 px-2 py-2 text-slate-600">
                    Saúde
                    <div className="mt-1 font-semibold text-slate-300">
                      {decisao.saude_atual ?? "—"}
                    </div>
                  </div>
                  <div className="rounded-lg border border-white/[0.05] bg-black/10 px-2 py-2 text-slate-600">
                    Efetividade
                    <div className="mt-1 font-semibold text-emerald-300">
                      {decisao.efetividade ?? "—"}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onOpenProjeto?.(decisao.projeto_id)}
                  className="flex h-9 min-w-[135px] items-center justify-center gap-1.5 rounded-xl border border-sky-400/20 bg-sky-500/[0.06] px-3 text-[9px] font-semibold text-sky-300 transition hover:bg-sky-500/[0.11]"
                >
                  Projeto 360
                  <ChevronRight size={11} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600"
          />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar projeto, cliente, responsável, justificativa ou decisor..."
            className="h-9 w-full rounded-xl border border-white/[0.06] bg-black/20 pl-9 pr-3 text-xs text-slate-200 outline-none placeholder:text-slate-700 focus:border-violet-400/20"
          />
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-400/15 bg-red-400/[0.05] p-4 text-xs text-red-300">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.025]">
        <div className="flex items-center justify-between border-b border-white/[0.05] px-4 py-3">
          <div className="flex items-center gap-2">
            <History size={13} className="text-violet-300" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">
              Registro executivo
            </span>
          </div>

          <div className="text-[10px] text-slate-600">
            {filtradas.length} decisão(ões)
          </div>
        </div>

        {loading && decisoes.length === 0 ? (
          <div className="flex min-h-[180px] items-center justify-center text-xs text-slate-600">
            <Loader2 size={15} className="mr-2 animate-spin" />
            Carregando decisões...
          </div>
        ) : filtradas.length === 0 ? (
          <div className="flex min-h-[180px] items-center justify-center text-center">
            <div>
              <CheckCircle2
                size={24}
                className="mx-auto text-emerald-300"
              />
              <div className="mt-2 text-sm font-medium text-slate-300">
                Nenhuma decisão encontrada
              </div>
              <div className="mt-1 text-[10px] text-slate-600">
                As decisões aplicadas pela Governança aparecerão aqui.
              </div>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {filtradas.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onOpenProjeto?.(item.projeto_id)}
                className="grid w-full gap-4 px-4 py-4 text-left transition hover:bg-white/[0.025] xl:grid-cols-[minmax(180px,1.15fr)_minmax(260px,1.7fr)_minmax(170px,1fr)_145px_24px] xl:items-center"
              >
                <div className="min-w-0">
                  <div className="truncate text-xs font-semibold text-white">
                    {item.projeto_nome}
                  </div>
                  <div className="mt-1 truncate text-[9px] text-slate-600">
                    {item.cliente_nome}
                  </div>
                </div>

                <div className="min-w-0">
                  <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-violet-300">
                    {item.tipo}
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="rounded-lg border border-white/[0.06] bg-white/[0.035] px-2.5 py-1 text-[10px] text-slate-400">
                      {item.valor_anterior ?? "Não informado"}
                    </span>

                    <ArrowRight size={12} className="text-slate-700" />

                    <span className="rounded-lg border border-emerald-400/15 bg-emerald-400/[0.06] px-2.5 py-1 text-[10px] font-medium text-emerald-300">
                      {item.valor_novo ?? "Não informado"}
                    </span>
                  </div>

                  {item.justificativa && (
                    <div className="mt-2 line-clamp-2 text-[10px] leading-4 text-slate-500">
                      <span className="font-semibold text-slate-400">
                        Justificativa:
                      </span>{" "}
                      {item.justificativa}
                    </div>
                  )}
                </div>

                <div className="min-w-0">
                  <div className="truncate text-[10px] font-medium text-slate-300">
                    {item.usuario_nome}
                  </div>

                  {item.recomendacao && (
                    <div className="mt-1 text-[9px] text-sky-300">
                      {item.recomendacao}
                    </div>
                  )}

                  {(item.carga_origem || item.carga_destino) && (
                    <div className="mt-1 text-[9px] text-slate-600">
                      {item.carga_origem ? `Origem ${item.carga_origem}` : ""}
                      {item.carga_origem && item.carga_destino ? " • " : ""}
                      {item.carga_destino ? `Destino ${item.carga_destino}` : ""}
                    </div>
                  )}

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <ResultadoBadge resultado={item.resultado_real ?? "Sem medição"} />
                  </div>

                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <div className="rounded-lg border border-white/[0.05] bg-black/10 px-2 py-1.5">
                      <div className="text-[8px] uppercase tracking-[0.1em] text-slate-700">
                        Score decisão → atual
                      </div>
                      <div className="mt-1 text-[10px] text-slate-400">
                        {item.score_depois ?? item.score_antes ?? "—"} →{" "}
                        <span className="font-semibold text-sky-300">
                          {item.score_atual ?? "—"}
                        </span>
                      </div>
                    </div>

                    <div className="rounded-lg border border-white/[0.05] bg-black/10 px-2 py-1.5">
                      <div className="text-[8px] uppercase tracking-[0.1em] text-slate-700">
                        Urgência decisão → atual
                      </div>
                      <div className="mt-1 text-[10px] text-slate-400">
                        {item.urgencia_depois ?? item.urgencia_antes ?? "—"} →{" "}
                        <span className="font-semibold text-amber-300">
                          {item.urgencia_atual ?? "—"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-2 text-[9px] text-violet-300">
                    Quadrante atual: {item.quadrante_atual ?? "Sem medição"}
                  </div>

                  <div className="mt-2 rounded-xl border border-white/[0.06] bg-black/10 p-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[8px] font-bold uppercase tracking-[0.12em] text-slate-600">
                        Efetividade gerencial
                      </span>
                      <span
                        className={[
                          "rounded-full border px-2 py-1 text-[8px] font-bold uppercase tracking-[0.08em]",
                          item.efetividade === "Eficaz"
                            ? "border-emerald-400/20 bg-emerald-500/[0.08] text-emerald-300"
                            : item.efetividade === "Revisar"
                              ? "border-red-400/20 bg-red-500/[0.08] text-red-300"
                              : item.efetividade === "Monitorar"
                                ? "border-amber-400/20 bg-amber-500/[0.08] text-amber-300"
                                : "border-white/[0.08] bg-white/[0.03] text-slate-500",
                        ].join(" ")}
                      >
                        {item.efetividade ?? "Sem medição"}
                      </span>
                    </div>

                    <div className="mt-2 grid grid-cols-3 gap-1.5 text-[8px]">
                      <div className="rounded-md bg-white/[0.025] px-2 py-1.5 text-slate-500">
                        Saúde
                        <div className="mt-0.5 font-semibold text-slate-300">
                          {item.saude_atual ?? "—"}
                        </div>
                      </div>
                      <div className="rounded-md bg-white/[0.025] px-2 py-1.5 text-slate-500">
                        Progresso
                        <div className="mt-0.5 font-semibold text-slate-300">
                          {item.progresso_atual != null ? `${item.progresso_atual}%` : "—"}
                        </div>
                      </div>
                      <div className="rounded-md bg-white/[0.025] px-2 py-1.5 text-slate-500">
                        Riscos atuais
                        <div className="mt-0.5 font-semibold text-slate-300">
                          {(item.pendencias_vencidas_atual ?? 0) +
                            (item.impedimentos_abertos_atual ?? 0) +
                            (item.marcos_atrasados_atual ?? 0) +
                            (item.acoes_vencidas_atual ?? 0)}
                        </div>
                      </div>
                    </div>

                    {item.efetividade_texto && (
                      <div className="mt-2 text-[8px] leading-4 text-slate-600">
                        {item.efetividade_texto}
                      </div>
                    )}
                  </div>

                  {item.resultado_real_texto && (
                    <div className="mt-1 line-clamp-2 text-[9px] leading-4 text-slate-600">
                      {item.resultado_real_texto}
                    </div>
                  )}
                </div>

                <div className="text-[9px] text-slate-600">
                  {formatarDataHora(item.created_at)}
                  {typeof item.horas_desde_decisao === "number" && (
                    <div className="mt-1 flex items-center gap-1">
                      <TimerReset size={10} />
                      {item.horas_desde_decisao < 24
                        ? `há ${Math.max(1, Math.floor(item.horas_desde_decisao))}h`
                        : `há ${Math.floor(item.horas_desde_decisao / 24)} dia(s)`}
                    </div>
                  )}
                </div>

                <ChevronRight
                  size={15}
                  className="hidden text-slate-700 xl:block"
                />
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between border-t border-white/[0.05] px-4 py-3 text-[9px] text-slate-600">
          <span>Fonte: histórico de governança do Control Tower</span>
          <span>Clique em uma decisão para abrir o Projeto 360</span>
        </div>
      </div>

      {decisaoReavaliacao && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="flex max-h-[calc(100dvh-32px)] w-[min(860px,calc(100vw-32px))] flex-col overflow-hidden rounded-[24px] border border-sky-400/25 bg-[#070d1b] shadow-2xl shadow-black/70">
            <div className="flex items-start justify-between gap-4 border-b border-white/[0.07] bg-gradient-to-r from-sky-500/[0.08] via-indigo-500/[0.05] to-violet-500/[0.08] px-6 py-5">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-sky-300">
                  Governança • Reavaliação Gerencial
                </div>
                <h3 className="mt-1 text-xl font-semibold text-white">
                  {decisaoReavaliacao.projeto_nome}
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Compare a decisão aplicada com o cenário real atual antes de encerrar o acompanhamento.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setDecisaoReavaliacao(null)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-slate-400 transition hover:bg-white/[0.07] hover:text-white"
              >
                <X size={17} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-6">
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-violet-400/15 bg-violet-500/[0.045] p-4">
                  <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-violet-300">
                    Decisão original
                  </div>
                  <div className="mt-3 text-sm font-semibold text-white">
                    {decisaoReavaliacao.tipo}
                  </div>

                  <div className="mt-3 flex items-center gap-2 text-xs">
                    <span className="rounded-lg border border-white/[0.07] bg-black/15 px-3 py-2 text-slate-400">
                      {decisaoReavaliacao.valor_anterior ?? "Não informado"}
                    </span>
                    <ArrowRight size={13} className="text-violet-300" />
                    <span className="rounded-lg border border-violet-400/20 bg-violet-500/[0.08] px-3 py-2 text-violet-200">
                      {decisaoReavaliacao.valor_novo ?? "Não informado"}
                    </span>
                  </div>

                  <div className="mt-4 rounded-xl border border-white/[0.05] bg-black/10 p-3">
                    <div className="text-[8px] font-bold uppercase tracking-[0.12em] text-slate-600">
                      Justificativa original
                    </div>
                    <div className="mt-1.5 text-[11px] leading-5 text-slate-300">
                      {decisaoReavaliacao.justificativa ?? "Sem justificativa registrada."}
                    </div>
                  </div>

                  <div className="mt-3 text-[9px] text-slate-600">
                    Decidido por {decisaoReavaliacao.usuario_nome} •{" "}
                    {formatarDataHora(decisaoReavaliacao.created_at)}
                  </div>
                </div>

                <div className="rounded-2xl border border-sky-400/15 bg-sky-500/[0.045] p-4">
                  <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-sky-300">
                    Resultado atual
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="rounded-xl border border-white/[0.06] bg-black/10 p-3">
                      <div className="text-[8px] uppercase tracking-[0.1em] text-slate-600">Saúde</div>
                      <div className="mt-1 text-sm font-semibold text-white">
                        {decisaoReavaliacao.saude_atual ?? "—"}
                      </div>
                    </div>
                    <div className="rounded-xl border border-white/[0.06] bg-black/10 p-3">
                      <div className="text-[8px] uppercase tracking-[0.1em] text-slate-600">Progresso</div>
                      <div className="mt-1 text-sm font-semibold text-white">
                        {decisaoReavaliacao.progresso_atual ?? 0}%
                      </div>
                    </div>
                    <div className="rounded-xl border border-white/[0.06] bg-black/10 p-3">
                      <div className="text-[8px] uppercase tracking-[0.1em] text-slate-600">Score atual</div>
                      <div className="mt-1 text-sm font-semibold text-sky-300">
                        {decisaoReavaliacao.score_atual ?? "—"}
                      </div>
                    </div>
                    <div className="rounded-xl border border-white/[0.06] bg-black/10 p-3">
                      <div className="text-[8px] uppercase tracking-[0.1em] text-slate-600">Urgência atual</div>
                      <div className="mt-1 text-sm font-semibold text-amber-300">
                        {decisaoReavaliacao.urgencia_atual ?? "—"}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 rounded-xl border border-white/[0.05] bg-black/10 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-[8px] font-bold uppercase tracking-[0.12em] text-slate-600">
                        Diagnóstico
                      </div>
                      <span
                        className={[
                          "rounded-full border px-2.5 py-1 text-[8px] font-bold uppercase",
                          decisaoReavaliacao.efetividade === "Revisar"
                            ? "border-red-400/25 bg-red-500/[0.08] text-red-300"
                            : "border-amber-400/25 bg-amber-500/[0.08] text-amber-300",
                        ].join(" ")}
                      >
                        {decisaoReavaliacao.efetividade}
                      </span>
                    </div>
                    <div className="mt-2 text-[11px] leading-5 text-slate-300">
                      {decisaoReavaliacao.efetividade_texto ??
                        "A decisão permanece em acompanhamento gerencial."}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-white/[0.07] bg-black/10 p-4">
                <label className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400">
                  Parecer da reavaliação
                </label>
                <textarea
                  value={justificativaReavaliacao}
                  onChange={(event) => setJustificativaReavaliacao(event.target.value)}
                  maxLength={500}
                  placeholder="Ex.: Cenário estabilizado após a decisão. Manter acompanhamento por mais um ciclo."
                  className="mt-2 min-h-[105px] w-full resize-none rounded-xl border border-white/[0.08] bg-[#060b18] px-4 py-3 text-sm text-slate-200 outline-none placeholder:text-slate-700 focus:border-sky-400/35"
                />
                <div className="mt-1 text-right text-[9px] text-slate-600">
                  {justificativaReavaliacao.length}/500
                </div>

                {erroReavaliacao && (
                  <div className="mt-2 rounded-lg border border-red-400/15 bg-red-500/[0.06] px-3 py-2 text-[10px] text-red-300">
                    {erroReavaliacao}
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-2 border-t border-white/[0.07] bg-[#050a17] px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={() => onOpenProjeto?.(decisaoReavaliacao.projeto_id)}
                className="h-10 rounded-xl border border-sky-400/20 bg-sky-500/[0.06] px-4 text-sm font-semibold text-sky-300 transition hover:bg-sky-500/[0.11]"
              >
                Abrir Projeto 360
              </button>

              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  disabled={salvandoReavaliacao}
                  onClick={() => void registrarReavaliacao("manter")}
                  className="h-10 rounded-xl border border-amber-400/25 bg-amber-500/[0.07] px-4 text-sm font-semibold text-amber-200 transition hover:bg-amber-500/[0.12] disabled:opacity-50"
                >
                  {salvandoReavaliacao ? "Registrando..." : "Manter monitoramento"}
                </button>

                <button
                  type="button"
                  disabled={salvandoReavaliacao}
                  onClick={() => void registrarReavaliacao("encerrar")}
                  className="h-10 rounded-xl border border-emerald-400/25 bg-emerald-500/[0.08] px-4 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/[0.14] disabled:opacity-50"
                >
                  {salvandoReavaliacao ? "Registrando..." : "Encerrar acompanhamento"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </section>
  );
}

function ResultadoBadge({
  resultado,
}: {
  resultado: "Melhorou" | "Estável" | "Piorou" | "Sem medição";
}) {
  const config =
    resultado === "Melhorou"
      ? { Icon: ArrowDownRight, cls: "border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-300" }
      : resultado === "Piorou"
        ? { Icon: ArrowUpRight, cls: "border-red-400/20 bg-red-400/[0.08] text-red-300" }
        : resultado === "Estável"
          ? { Icon: CircleMinus, cls: "border-amber-400/20 bg-amber-400/[0.08] text-amber-300" }
          : { Icon: Clock3, cls: "border-white/[0.08] bg-white/[0.03] text-slate-500" };

  const Icon = config.Icon;

  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[9px] font-semibold ${config.cls}`}>
      <Icon size={10} />
      {resultado}
    </span>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Gavel;
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4">
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-600">
          {label}
        </span>
        <Icon size={14} className={tone} />
      </div>
      <div className="mt-3 text-2xl font-semibold text-white">
        {value}
      </div>
    </div>
  );
}
