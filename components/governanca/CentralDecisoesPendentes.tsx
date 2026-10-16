"use client";

import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Gavel,
  Loader2,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type Projeto = {
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
  projetos: Projeto[];
  error?: string;
};

type Severidade = "Crítica" | "Alta" | "Normal";

type DecisaoPendente = {
  id: string;
  projeto: Projeto;
  severidade: Severidade;
  tipo: string;
  motivo: string;
  sugestao: string;
  score: number;
};

type Props = {
  onOpenProjeto?: (projetoId: string) => void;
};

const encerrados = new Set(["Finalizado", "Cancelado"]);

function diasAte(data?: string | null) {
  if (!data) return null;

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const alvo = new Date(`${data}T12:00:00`);
  alvo.setHours(0, 0, 0, 0);

  return Math.ceil((alvo.getTime() - hoje.getTime()) / 86400000);
}

function criarPendencia(projeto: Projeto): DecisaoPendente | null {
  if (encerrados.has(projeto.status)) return null;

  const dias = diasAte(projeto.data_fim);
  const motivos: string[] = [];
  const sugestoes: string[] = [];
  let score = 0;

  if (projeto.saude === "Crítico") {
    score += 45;
    motivos.push("saúde crítica");
  } else if (projeto.saude === "Atenção") {
    score += 20;
    motivos.push("saúde em atenção");
  }

  if (projeto.indicadores.impedimentosCriticos > 0) {
    score += 50;
    motivos.push(
      `${projeto.indicadores.impedimentosCriticos} impedimento(s) crítico(s)`,
    );
    sugestoes.push("Atuar no impedimento e avaliar bloqueio do projeto");
  } else if (projeto.indicadores.impedimentosAbertos > 0) {
    score += 25;
    motivos.push(
      `${projeto.indicadores.impedimentosAbertos} impedimento(s) aberto(s)`,
    );
    sugestoes.push("Revisar impedimentos e plano de desbloqueio");
  }

  if (projeto.indicadores.projetoAtrasado || (dias !== null && dias < 0)) {
    score += 45;
    motivos.push("prazo vencido");
    sugestoes.push("Reprogramar prazo");
  } else if (dias !== null && dias <= 7) {
    score += 30;
    motivos.push("prazo em até 7 dias");
    sugestoes.push("Validar prazo e capacidade de entrega");
  } else if (dias !== null && dias <= 15) {
    score += 15;
    motivos.push("prazo em até 15 dias");
  }

  if (projeto.status === "Bloqueado") {
    score += 40;
    motivos.push("projeto bloqueado");
    sugestoes.push("Avaliar retomada ou plano de desbloqueio");
  }

  if (projeto.status === "Pausado") {
    score += 30;
    motivos.push("projeto pausado");
    sugestoes.push("Avaliar retomada");
  }

  if (projeto.indicadores.pendenciasVencidas > 0) {
    score += Math.min(25, projeto.indicadores.pendenciasVencidas * 8);
    motivos.push(
      `${projeto.indicadores.pendenciasVencidas} pendência(s) vencida(s)`,
    );
    sugestoes.push("Tratar pendências vencidas");
  }

  if (projeto.indicadores.marcosAtrasados > 0) {
    score += Math.min(25, projeto.indicadores.marcosAtrasados * 10);
    motivos.push(
      `${projeto.indicadores.marcosAtrasados} marco(s) atrasado(s)`,
    );
    sugestoes.push("Revisar cronograma e marcos");
  }

  if (projeto.indicadores.acoesVencidas > 0) {
    score += Math.min(25, projeto.indicadores.acoesVencidas * 10);
    motivos.push(
      `${projeto.indicadores.acoesVencidas} ação(ões) vencida(s)`,
    );
    sugestoes.push("Regularizar próximas ações");
  }

  if (!projeto.responsavel?.id) {
    score += 35;
    motivos.push("sem responsável");
    sugestoes.push("Definir responsável");
  }

  if (projeto.prioridade === "Crítica") score += 20;
  else if (projeto.prioridade === "Alta") score += 10;

  // Não cria pendência executiva apenas por prioridade.
  const temExcecao =
    projeto.saude !== "Estável" ||
    projeto.status === "Bloqueado" ||
    projeto.status === "Pausado" ||
    projeto.indicadores.projetoAtrasado ||
    projeto.indicadores.pendenciasVencidas > 0 ||
    projeto.indicadores.impedimentosAbertos > 0 ||
    projeto.indicadores.impedimentosCriticos > 0 ||
    projeto.indicadores.marcosAtrasados > 0 ||
    projeto.indicadores.acoesVencidas > 0 ||
    !projeto.responsavel?.id ||
    (dias !== null && dias <= 7);

  if (!temExcecao) return null;

  const severidade: Severidade =
    score >= 75 ? "Crítica" : score >= 45 ? "Alta" : "Normal";

  const tipo =
    projeto.indicadores.impedimentosCriticos > 0
      ? "Impedimento crítico"
      : projeto.status === "Bloqueado"
        ? "Projeto bloqueado"
        : projeto.indicadores.projetoAtrasado || (dias !== null && dias < 0)
          ? "Prazo vencido"
          : projeto.status === "Pausado"
            ? "Projeto pausado"
            : projeto.indicadores.marcosAtrasados > 0
              ? "Cronograma"
              : projeto.indicadores.acoesVencidas > 0
                ? "Ações vencidas"
                : projeto.indicadores.pendenciasVencidas > 0
                  ? "Pendências vencidas"
                  : !projeto.responsavel?.id
                    ? "Responsabilidade"
                    : "Prazo próximo";

  return {
    id: `decisao-${projeto.id}`,
    projeto,
    severidade,
    tipo,
    motivo: motivos.join(" • "),
    sugestao:
      Array.from(new Set(sugestoes)).slice(0, 2).join(" + ") ||
      "Analisar no Cockpit de Decisão",
    score,
  };
}

function tone(severidade: Severidade) {
  if (severidade === "Crítica") {
    return "border-red-400/20 bg-red-400/[0.08] text-red-300";
  }

  if (severidade === "Alta") {
    return "border-amber-400/20 bg-amber-400/[0.08] text-amber-300";
  }

  return "border-sky-400/20 bg-sky-400/[0.08] text-sky-300";
}

export default function CentralDecisoesPendentes({
  onOpenProjeto,
}: Props) {
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busca, setBusca] = useState("");

  const carregar = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("/api/dashboard/executivo", {
        cache: "no-store",
        credentials: "same-origin",
      });

      const data = (await response.json()) as DashboardResponse;

      if (!response.ok || !data.success) {
        throw new Error(
          data.error || `Erro HTTP ${response.status}`,
        );
      }

      setProjetos(data.projetos ?? []);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Erro ao carregar decisões pendentes.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const pendentes = useMemo(
    () =>
      projetos
        .map(criarPendencia)
        .filter(
          (item): item is DecisaoPendente => item !== null,
        )
        .sort((a, b) => b.score - a.score),
    [projetos],
  );

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();

    if (!q) return pendentes;

    return pendentes.filter((item) =>
      [
        item.projeto.nome,
        item.projeto.cliente?.nome,
        item.projeto.responsavel?.nome,
        item.tipo,
        item.motivo,
        item.sugestao,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [busca, pendentes]);

  const criticas = pendentes.filter(
    (item) => item.severidade === "Crítica",
  ).length;

  const altas = pendentes.filter(
    (item) => item.severidade === "Alta",
  ).length;

  const normais = pendentes.filter(
    (item) => item.severidade === "Normal",
  ).length;

  function abrirCockpit(projetoId: string) {
    window.dispatchEvent(
      new CustomEvent("control-tower:open-cockpit", {
        detail: { projetoId },
      }),
    );

    // O Cockpit é modal/fixed. Não deslocamos a tela até a Matriz.
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-300">
            <Gavel size={14} />
            Governança • Fila executiva
          </div>

          <h2 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-white">
            Decisões Pendentes
          </h2>

          <p className="mt-1 text-xs text-slate-500">
            Situações da carteira que exigem análise ou decisão gerencial.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void carregar()}
          disabled={loading}
          className="flex h-9 items-center gap-2 self-start rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 text-xs text-slate-400 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-50"
        >
          <RefreshCw
            size={14}
            className={loading ? "animate-spin" : ""}
          />
          Atualizar
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          icon={Gavel}
          label="Pendentes"
          value={pendentes.length}
          tone="text-violet-300"
        />
        <Kpi
          icon={ShieldAlert}
          label="Críticas"
          value={criticas}
          tone="text-red-300"
        />
        <Kpi
          icon={AlertTriangle}
          label="Altas"
          value={altas}
          tone="text-amber-300"
        />
        <Kpi
          icon={Clock3}
          label="Normais"
          value={normais}
          tone="text-sky-300"
        />
      </div>

      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-3">
        <div className="relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600"
          />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar projeto, cliente, responsável, motivo ou sugestão..."
            className="h-10 w-full rounded-xl border border-white/[0.06] bg-black/20 pl-9 pr-3 text-xs text-slate-200 outline-none placeholder:text-slate-700 focus:border-amber-400/20"
          />
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-400/15 bg-red-400/[0.05] p-4 text-xs text-red-300">
          <AlertTriangle size={15} className="mr-2 inline" />
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.025]">
        <div className="flex items-center justify-between border-b border-white/[0.05] px-4 py-3">
          <div className="flex items-center gap-2">
            <Sparkles size={13} className="text-amber-300" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">
              Fila para decisão
            </span>
          </div>

          <div className="text-[10px] text-slate-600">
            {filtradas.length} decisão(ões)
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-[180px] items-center justify-center text-xs text-slate-600">
            <Loader2 size={16} className="mr-2 animate-spin" />
            Analisando carteira...
          </div>
        ) : filtradas.length === 0 ? (
          <div className="flex min-h-[180px] flex-col items-center justify-center text-center">
            <CheckCircle2 size={26} className="text-emerald-300" />
            <div className="mt-3 text-sm font-medium text-slate-300">
              Nenhuma decisão pendente
            </div>
            <div className="mt-1 text-[10px] text-slate-600">
              A carteira não possui exceções que exijam decisão gerencial.
            </div>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {filtradas.map((item) => (
              <div
                key={item.id}
                className="grid gap-4 px-4 py-4 lg:grid-cols-[110px_minmax(160px,1fr)_minmax(240px,1.55fr)_minmax(220px,1.35fr)_190px] lg:items-center"
              >
                <div>
                  <span
                    className={`inline-flex rounded-full border px-2 py-1 text-[9px] font-semibold ${tone(
                      item.severidade,
                    )}`}
                  >
                    {item.severidade}
                  </span>
                </div>

                <div className="min-w-0">
                  <div className="truncate text-xs font-semibold text-white">
                    {item.projeto.nome}
                  </div>
                  <div className="mt-1 truncate text-[9px] text-slate-600">
                    {item.projeto.cliente?.nome ?? "Sem cliente"}
                    {" • "}
                    {item.projeto.responsavel?.nome ??
                      "Sem responsável"}
                  </div>
                </div>

                <div className="min-w-0">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                    {item.tipo}
                  </div>
                  <div className="mt-1 text-[10px] leading-4 text-slate-600">
                    {item.motivo}
                  </div>
                </div>

                <div className="min-w-0 rounded-xl border border-amber-400/10 bg-amber-400/[0.04] px-3 py-2.5">
                  <div className="text-[8px] font-semibold uppercase tracking-[0.12em] text-amber-300/70">
                    Sugestão
                  </div>
                  <div className="mt-1 text-[10px] leading-4 text-amber-100/80">
                    {item.sugestao}
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => abrirCockpit(item.projeto.id)}
                    className="flex h-10 w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-sky-400/25 bg-sky-400/[0.09] px-4 text-[10px] font-semibold text-sky-300 shadow-[inset_0_0_0_1px_rgba(56,189,248,0.04)] transition hover:border-sky-300/35 hover:bg-sky-400/[0.14] hover:text-sky-200"
                  >
                    Analisar no Cockpit
                    <ArrowRight size={12} />
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      onOpenProjeto?.(item.projeto.id)
                    }
                    className="h-9 w-full whitespace-nowrap rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 text-[9px] font-medium text-slate-500 transition hover:bg-white/[0.05] hover:text-slate-300"
                  >
                    Projeto 360
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="text-[9px] leading-4 text-slate-700">
        A fila é calculada automaticamente a partir de saúde, prazo,
        bloqueios, pausas, impedimentos, pendências, marcos, ações e
        responsabilidade. Nenhuma decisão é aplicada automaticamente.
      </div>
    </section>
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
