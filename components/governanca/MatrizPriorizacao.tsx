"use client";

import {
  ArrowUpRight,
  ChevronRight,
  Crosshair,
  Gauge,
  ShieldAlert,
  Sparkles,
  Target,
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

type Props = {
  onOpenProjeto?: (projetoId: string) => void;
};

type Quadrante = "Agir agora" | "Proteger" | "Planejar" | "Monitorar";

type ProjetoPriorizado = {
  projeto: Projeto;
  impacto: number;
  urgencia: number;
  score: number;
  quadrante: Quadrante;
  motivos: string[];
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

function prioridadePeso(prioridade: string) {
  if (prioridade === "Crítica") return 100;
  if (prioridade === "Alta") return 75;
  if (prioridade === "Normal") return 50;
  return 25;
}

function quadranteTone(quadrante: Quadrante) {
  if (quadrante === "Agir agora")
    return "border-red-400/20 bg-red-400/[0.08] text-red-300";
  if (quadrante === "Proteger")
    return "border-amber-400/20 bg-amber-400/[0.08] text-amber-300";
  if (quadrante === "Planejar")
    return "border-violet-400/20 bg-violet-400/[0.08] text-violet-300";
  return "border-sky-400/20 bg-sky-400/[0.08] text-sky-300";
}

function classificar(projeto: Projeto): ProjetoPriorizado {
  const motivos: string[] = [];
  const dias = diasAte(projeto.data_fim);

  let impacto = prioridadePeso(projeto.prioridade);

  if (projeto.saude === "Crítico") {
    impacto += 20;
    motivos.push("saúde crítica");
  } else if (projeto.saude === "Atenção") {
    impacto += 10;
  }

  if (projeto.indicadores.impedimentosCriticos > 0) {
    impacto += 20;
    motivos.push("impedimento crítico");
  }

  if ((projeto.etapa?.nome ?? "").toLowerCase().includes("go-live")) {
    impacto += 10;
    motivos.push("etapa Go-Live");
  }

  impacto = Math.min(100, impacto);

  let urgencia = 10;

  if (projeto.indicadores.projetoAtrasado || (dias !== null && dias < 0)) {
    urgencia += 55;
    motivos.push("prazo vencido");
  } else if (dias !== null && dias <= 7) {
    urgencia += 40;
    motivos.push("prazo em até 7 dias");
  } else if (dias !== null && dias <= 15) {
    urgencia += 25;
    motivos.push("prazo em até 15 dias");
  } else if (dias !== null && dias <= 30) {
    urgencia += 15;
  }

  if (projeto.status === "Bloqueado") {
    urgencia += 30;
    motivos.push("projeto bloqueado");
  }

  if (projeto.status === "Pausado") {
    urgencia += 20;
    motivos.push("projeto pausado");
  }

  if (projeto.indicadores.pendenciasVencidas > 0) {
    urgencia += Math.min(20, projeto.indicadores.pendenciasVencidas * 8);
    motivos.push(`${projeto.indicadores.pendenciasVencidas} pendência(s) vencida(s)`);
  }

  if (projeto.indicadores.marcosAtrasados > 0) {
    urgencia += Math.min(20, projeto.indicadores.marcosAtrasados * 8);
    motivos.push(`${projeto.indicadores.marcosAtrasados} marco(s) atrasado(s)`);
  }

  if (projeto.indicadores.acoesVencidas > 0) {
    urgencia += Math.min(20, projeto.indicadores.acoesVencidas * 8);
    motivos.push(`${projeto.indicadores.acoesVencidas} ação(ões) vencida(s)`);
  }

  if (projeto.indicadores.impedimentosAbertos > 0) {
    urgencia += Math.min(20, projeto.indicadores.impedimentosAbertos * 8);
    motivos.push(`${projeto.indicadores.impedimentosAbertos} impedimento(s) aberto(s)`);
  }

  urgencia = Math.min(100, urgencia);

  const score = Math.round(impacto * 0.45 + urgencia * 0.55);

  let quadrante: Quadrante;
  if (impacto >= 60 && urgencia >= 60) quadrante = "Agir agora";
  else if (impacto >= 60) quadrante = "Proteger";
  else if (urgencia >= 60) quadrante = "Planejar";
  else quadrante = "Monitorar";

  if (motivos.length === 0) motivos.push("acompanhamento regular");

  return { projeto, impacto, urgencia, score, quadrante, motivos };
}

export default function MatrizPriorizacao({ onOpenProjeto }: Props) {
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cockpit, setCockpit] = useState<ProjetoPriorizado | null>(null);
  const [simPrazo, setSimPrazo] = useState("");
  const [simResolverRiscos, setSimResolverRiscos] = useState(false);

  const carregar = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const response = await fetch("/api/dashboard/executivo", { cache: "no-store" });
      const data = (await response.json()) as DashboardResponse;
      if (!response.ok || !data.success) {
        throw new Error(data.error || `Erro HTTP ${response.status}`);
      }
      setProjetos(data.projetos ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar priorização.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const priorizados = useMemo(
    () =>
      projetos
        .filter((p) => !encerrados.has(p.status))
        .map(classificar)
        .sort((a, b) => b.score - a.score),
    [projetos],
  );

  const grupos = useMemo(() => {
    const mapa: Record<Quadrante, ProjetoPriorizado[]> = {
      "Agir agora": [],
      Proteger: [],
      Planejar: [],
      Monitorar: [],
    };
    priorizados.forEach((item) => mapa[item.quadrante].push(item));
    return mapa;
  }, [priorizados]);

  const top = priorizados.slice(0, 8);
  const scoreMedio = priorizados.length
    ? Math.round(priorizados.reduce((acc, item) => acc + item.score, 0) / priorizados.length)
    : 0;

  const abrirCockpit = (item: ProjetoPriorizado) => {
    setCockpit(item);
    setSimPrazo(item.projeto.data_fim ?? "");
    setSimResolverRiscos(false);
  };

  const simulacao = useMemo(() => {
    if (!cockpit) return null;

    const projetoSimulado: Projeto = {
      ...cockpit.projeto,
      data_fim: simPrazo || cockpit.projeto.data_fim,
      indicadores: {
        ...cockpit.projeto.indicadores,
        projetoAtrasado: simPrazo
          ? (() => {
              const dias = diasAte(simPrazo);
              return dias !== null && dias < 0;
            })()
          : cockpit.projeto.indicadores.projetoAtrasado,
        pendenciasVencidas: simResolverRiscos
          ? 0
          : cockpit.projeto.indicadores.pendenciasVencidas,
        impedimentosAbertos: simResolverRiscos
          ? 0
          : cockpit.projeto.indicadores.impedimentosAbertos,
        impedimentosCriticos: simResolverRiscos
          ? 0
          : cockpit.projeto.indicadores.impedimentosCriticos,
        marcosAtrasados: simResolverRiscos
          ? 0
          : cockpit.projeto.indicadores.marcosAtrasados,
        acoesVencidas: simResolverRiscos
          ? 0
          : cockpit.projeto.indicadores.acoesVencidas,
      },
    };

    return classificar(projetoSimulado);
  }, [cockpit, simPrazo, simResolverRiscos]);

  const houveMudancaSimulacao =
    !!cockpit &&
    !!simulacao &&
    ((simPrazo || "") !== (cockpit.projeto.data_fim || "") ||
      simResolverRiscos);

  const resetarSimulacao = () => {
    if (!cockpit) return;
    setSimPrazo(cockpit.projeto.data_fim ?? "");
    setSimResolverRiscos(false);
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Crosshair size={14} className="text-sky-300" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-400">
              Governança executiva
            </span>
          </div>
          <h2 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-white">
            Matriz de Priorização
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Impacto × urgência para orientar onde a gestão deve atuar primeiro.
          </p>
        </div>

        <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-2 text-right">
          <div className="text-[8px] uppercase tracking-[0.12em] text-slate-600">Score médio</div>
          <div className="mt-1 text-xl font-semibold text-sky-300">{scoreMedio}</div>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-400/15 bg-red-400/[0.05] p-4 text-xs text-red-300">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {(["Agir agora", "Proteger", "Planejar", "Monitorar"] as Quadrante[]).map((quadrante) => (
          <div
            key={quadrante}
            className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4"
          >
            <div className="flex items-center justify-between">
              <span className={`rounded-full border px-2 py-1 text-[9px] font-semibold ${quadranteTone(quadrante)}`}>
                {quadrante}
              </span>
              <span className="text-2xl font-semibold text-white">{grupos[quadrante].length}</span>
            </div>
            <div className="mt-3 text-[9px] text-slate-600">
              {quadrante === "Agir agora"
                ? "Alto impacto + alta urgência"
                : quadrante === "Proteger"
                  ? "Alto impacto + urgência controlada"
                  : quadrante === "Planejar"
                    ? "Urgente, com impacto relativo menor"
                    : "Acompanhamento regular"}
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4">
          <div className="flex items-center gap-2">
            <Target size={14} className="text-violet-300" />
            <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">
              Impacto × urgência
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            {(["Proteger", "Agir agora", "Monitorar", "Planejar"] as Quadrante[]).map((quadrante) => (
              <div
                key={quadrante}
                className={`min-h-[150px] rounded-2xl border p-3 ${quadranteTone(quadrante)}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.12em]">
                    {quadrante}
                  </span>
                  <span className="text-lg font-semibold">{grupos[quadrante].length}</span>
                </div>

                <div className="mt-3 space-y-1.5">
                  {grupos[quadrante].slice(0, 4).map((item) => (
                    <button
                      key={item.projeto.id}
                      type="button"
                      onClick={() => abrirCockpit(item)}
                      className="flex w-full items-center justify-between gap-2 rounded-lg bg-black/15 px-2.5 py-2 text-left transition hover:bg-black/25"
                    >
                      <span className="truncate text-[9px] font-medium">{item.projeto.nome}</span>
                      <span className="shrink-0 text-[9px] font-semibold">{item.score}</span>
                    </button>
                  ))}

                  {grupos[quadrante].length === 0 && (
                    <div className="pt-4 text-center text-[9px] opacity-50">Sem projetos</div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 flex items-center justify-between text-[8px] uppercase tracking-[0.12em] text-slate-600">
            <span>← menor impacto</span>
            <span>maior impacto →</span>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.025]">
          <div className="flex items-center justify-between border-b border-white/[0.05] px-4 py-3">
            <div>
              <div className="flex items-center gap-2">
                <Gauge size={14} className="text-amber-300" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">
                  Ranking executivo
                </span>
              </div>
              <div className="mt-1 text-[9px] text-slate-600">
                Score 0–100 calculado por impacto e urgência.
              </div>
            </div>
            <Sparkles size={15} className="text-violet-300" />
          </div>

          {loading ? (
            <div className="p-10 text-center text-xs text-slate-600">
              Calculando priorização da carteira...
            </div>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {top.map((item, index) => (
                <button
                  key={item.projeto.id}
                  type="button"
                  onClick={() => abrirCockpit(item)}
                  className="grid w-full grid-cols-[28px_minmax(0,1fr)_80px_58px_22px] items-center gap-3 px-4 py-3 text-left transition hover:bg-white/[0.025]"
                >
                  <div className="text-[10px] font-semibold text-slate-600">{index + 1}</div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-xs font-semibold text-white">
                        {item.projeto.nome}
                      </span>
                      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[8px] font-semibold ${quadranteTone(item.quadrante)}`}>
                        {item.quadrante}
                      </span>
                    </div>
                    <div className="mt-1 truncate text-[9px] text-slate-600">
                      {item.motivos.slice(0, 3).join(" • ")}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[9px] text-slate-600">I {item.impacto}</div>
                    <div className="text-[9px] text-slate-600">U {item.urgencia}</div>
                  </div>
                  <div className="text-right text-lg font-semibold text-sky-300">{item.score}</div>
                  <ChevronRight size={14} className="text-slate-700" />
                </button>
              ))}
            </div>
          )}

          <div className="flex items-start gap-2 border-t border-white/[0.05] px-4 py-3 text-[9px] leading-4 text-slate-600">
            <ShieldAlert size={12} className="mt-0.5 shrink-0 text-amber-300" />
            <span>
              O score é gerencial: usa prioridade, saúde, prazo, bloqueios, impedimentos, marcos,
              pendências e ações. Não altera automaticamente a prioridade cadastrada.
            </span>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-sky-400/10 bg-sky-400/[0.025] px-4 py-3">
        <div className="flex items-center gap-2 text-[9px] text-slate-500">
          <ArrowUpRight size={12} className="text-sky-300" />
          Clique em qualquer projeto para abrir o Cockpit de Decisão; de lá você pode acessar o Projeto 360.
        </div>
      </div>

      {cockpit && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setCockpit(null);
          }}
        >
          <div className="flex h-[calc(100dvh-64px)] w-[min(1040px,calc(100vw-40px))] flex-col overflow-hidden rounded-[26px] border border-sky-400/25 bg-[#070d1b] shadow-2xl shadow-black/70">
            <div className="flex items-start justify-between gap-4 border-b border-white/[0.06] bg-gradient-to-r from-sky-400/[0.08] via-indigo-400/[0.06] to-violet-400/[0.08] p-5">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-400">
                  Cockpit de decisão • Governança
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <h3 className="text-2xl font-semibold text-white">{cockpit.projeto.nome}</h3>
                  <span className={`rounded-full border px-2 py-1 text-[9px] font-semibold ${quadranteTone(cockpit.quadrante)}`}>
                    {cockpit.quadrante}
                  </span>
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {cockpit.projeto.cliente?.nome ?? "Cliente não informado"} •{" "}
                  {cockpit.projeto.etapa?.nome ?? "Sem etapa"} •{" "}
                  {cockpit.projeto.responsavel?.nome ?? "Sem responsável"}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setCockpit(null)}
                className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2 text-sm text-slate-300 hover:bg-white/[0.08]"
              >
                Fechar
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              <div className="grid gap-3 sm:grid-cols-4">
                {[
                  ["Score executivo", cockpit.score, "text-sky-300"],
                  ["Impacto", cockpit.impacto, "text-violet-300"],
                  ["Urgência", cockpit.urgencia, "text-amber-300"],
                  ["Progresso", `${cockpit.projeto.percentual}%`, "text-emerald-300"],
                ].map(([label, value, tone]) => (
                  <div key={String(label)} className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4">
                    <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-600">
                      {label}
                    </div>
                    <div className={`mt-2 text-2xl font-semibold ${tone}`}>{value}</div>
                  </div>
                ))}
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1fr]">
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Por que exige atenção
                  </div>
                  <div className="mt-3 space-y-2">
                    {cockpit.motivos.map((motivo) => (
                      <div key={motivo} className="flex items-center gap-2 rounded-xl bg-black/20 px-3 py-2 text-xs text-slate-300">
                        <ShieldAlert size={13} className="shrink-0 text-amber-300" />
                        {motivo}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Leitura executiva
                  </div>
                  <div className="mt-3 rounded-xl border border-sky-400/10 bg-sky-400/[0.035] p-3 text-xs leading-5 text-slate-300">
                    {cockpit.quadrante === "Agir agora"
                      ? "Projeto combina impacto relevante e alta urgência. Recomenda-se decisão gerencial imediata sobre prazo, bloqueios, riscos e capacidade do responsável."
                      : cockpit.quadrante === "Proteger"
                        ? "Projeto tem impacto elevado, mas a urgência ainda está controlável. A prioridade é evitar deterioração e proteger a entrega."
                        : cockpit.quadrante === "Planejar"
                          ? "Existe pressão temporal relevante. Recomenda-se replanejar execução e remover causas de atraso antes que o impacto aumente."
                          : "Projeto pode permanecer em acompanhamento regular, preservando capacidade para itens de maior pressão."}
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
                    <div className="rounded-xl bg-black/20 p-3">
                      <div className="text-slate-600">Status</div>
                      <div className="mt-1 font-semibold text-white">{cockpit.projeto.status}</div>
                    </div>
                    <div className="rounded-xl bg-black/20 p-3">
                      <div className="text-slate-600">Prioridade</div>
                      <div className="mt-1 font-semibold text-white">{cockpit.projeto.prioridade}</div>
                    </div>
                    <div className="rounded-xl bg-black/20 p-3">
                      <div className="text-slate-600">Prazo</div>
                      <div className="mt-1 font-semibold text-white">
                        {cockpit.projeto.data_fim
                          ? new Intl.DateTimeFormat("pt-BR").format(new Date(`${cockpit.projeto.data_fim}T12:00:00`))
                          : "Não informado"}
                      </div>
                    </div>
                    <div className="rounded-xl bg-black/20 p-3">
                      <div className="text-slate-600">Saúde</div>
                      <div className="mt-1 font-semibold text-white">{cockpit.projeto.saude}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4">
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Decisões recomendadas
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    ["Resolver riscos", "Revisar impedimentos, pendências e ações vencidas."],
                    ["Replanejar prazo", "Validar se a data final ainda é executável."],
                    ["Revisar capacidade", "Avaliar concentração e responsável atual."],
                    ["Abrir Projeto 360", "Acessar histórico, marcos, ações e edição."],
                  ].map(([titulo, descricao], index) => (
                    <button
                      key={titulo}
                      type="button"
                      onClick={() => {
                        if (index === 3) {
                          setCockpit(null);
                          onOpenProjeto?.(cockpit.projeto.id);
                        }
                      }}
                      className={`rounded-xl border p-3 text-left transition ${
                        index === 3
                          ? "border-sky-400/25 bg-sky-400/[0.07] hover:bg-sky-400/[0.12]"
                          : "cursor-default border-white/[0.06] bg-black/20"
                      }`}
                    >
                      <div className="text-xs font-semibold text-white">{titulo}</div>
                      <div className="mt-1 text-[9px] leading-4 text-slate-600">{descricao}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-violet-400/15 bg-violet-400/[0.03] p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-violet-300">
                      Simulação gerencial • E se?
                    </div>
                    <div className="mt-1 text-[10px] text-slate-500">
                      Teste cenários sem alterar nenhum dado do projeto.
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={resetarSimulacao}
                    disabled={!houveMudancaSimulacao}
                    className="rounded-xl border border-white/[0.08] bg-white/[0.035] px-3 py-2 text-[10px] font-semibold text-slate-300 transition hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    Restaurar cenário
                  </button>
                </div>

                <div className="mt-4 grid gap-3 lg:grid-cols-[0.8fr_0.8fr_1.4fr]">
                  <label className="rounded-xl border border-white/[0.06] bg-black/20 p-3">
                    <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-600">
                      Simular novo prazo
                    </div>
                    <input
                      type="date"
                      value={simPrazo}
                      onChange={(e) => setSimPrazo(e.target.value)}
                      className="mt-2 w-full rounded-lg border border-white/[0.08] bg-[#090f26] px-3 py-2 text-xs text-white outline-none focus:border-sky-400/40"
                    />
                  </label>

                  <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-black/20 p-3">
                    <div>
                      <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-600">
                        Resolver riscos
                      </div>
                      <div className="mt-1 text-[9px] leading-4 text-slate-500">
                        Zera, apenas na simulação, riscos vencidos/abertos.
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={simResolverRiscos}
                      onChange={(e) => setSimResolverRiscos(e.target.checked)}
                      className="h-4 w-4 accent-cyan-400"
                    />
                  </label>

                  <div className="rounded-xl border border-sky-400/10 bg-sky-400/[0.035] p-3">
                    <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-sky-300">
                      Efeito projetado
                    </div>

                    {simulacao && (
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        <div>
                          <div className="text-[8px] uppercase text-slate-600">Score</div>
                          <div className="mt-1 flex items-center gap-1.5">
                            <span className="text-sm text-slate-500">{cockpit.score}</span>
                            <span className="text-slate-700">→</span>
                            <span className={`text-lg font-semibold ${
                              simulacao.score < cockpit.score
                                ? "text-emerald-300"
                                : simulacao.score > cockpit.score
                                  ? "text-red-300"
                                  : "text-sky-300"
                            }`}>
                              {simulacao.score}
                            </span>
                          </div>
                        </div>

                        <div>
                          <div className="text-[8px] uppercase text-slate-600">Urgência</div>
                          <div className="mt-1 flex items-center gap-1.5">
                            <span className="text-sm text-slate-500">{cockpit.urgencia}</span>
                            <span className="text-slate-700">→</span>
                            <span className="text-lg font-semibold text-amber-300">
                              {simulacao.urgencia}
                            </span>
                          </div>
                        </div>

                        <div>
                          <div className="text-[8px] uppercase text-slate-600">Quadrante</div>
                          <div className="mt-1">
                            <span className={`inline-flex rounded-full border px-2 py-1 text-[8px] font-semibold ${quadranteTone(simulacao.quadrante)}`}>
                              {simulacao.quadrante}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {simulacao && houveMudancaSimulacao && (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <div className="rounded-xl border border-white/[0.05] bg-black/15 px-3 py-2 text-[9px] text-slate-500">
                      <span className="font-semibold text-slate-300">Cenário atual:</span>{" "}
                      {cockpit.motivos.slice(0, 4).join(" • ")}
                    </div>
                    <div className="rounded-xl border border-emerald-400/10 bg-emerald-400/[0.025] px-3 py-2 text-[9px] text-slate-500">
                      <span className="font-semibold text-emerald-300">Cenário simulado:</span>{" "}
                      {simulacao.motivos.slice(0, 4).join(" • ")}
                    </div>
                  </div>
                )}

                <div className="mt-3 text-[8px] leading-4 text-slate-600">
                  Simulação local: alterar prazo ou marcar riscos como resolvidos aqui não grava no banco,
                  não muda status e não cria histórico.
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-white/[0.06] bg-[#080c20] px-5 py-3">
              <div className="text-[9px] text-slate-600">
                Nenhuma decisão é aplicada automaticamente.
              </div>
              <button
                type="button"
                onClick={() => {
                  const id = cockpit.projeto.id;
                  setCockpit(null);
                  onOpenProjeto?.(id);
                }}
                className="rounded-xl border border-sky-400/30 bg-sky-400/[0.09] px-4 py-2 text-xs font-semibold text-sky-200 hover:bg-sky-400/[0.15]"
              >
                Abrir Projeto 360
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
