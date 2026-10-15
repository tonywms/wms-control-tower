"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Ban,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Flag,
  ListTodo,
  Loader2,
  RefreshCw,
  ShieldAlert,
  X,
} from "lucide-react";
import type { ReactNode } from "react";

type ProjetoRanking = {
  id: string;
  nome: string;
  status: string;
  prioridade: string;
  percentual: number | null;
  data_fim: string | null;
  saude: "Estável" | "Atenção" | "Crítico";
  score: number;
  cliente?: { id: string; nome: string } | null;
  etapa?: { id: string; nome: string; ordem: number } | null;
  responsavel?: { id: string; nome: string } | null;
  detalhesAlertas?: {
    impedimentos: { id: string; titulo: string; prioridade: string; prazo: string | null }[];
    marcosAtrasados: { id: string; nome: string; data_prevista: string | null }[];
    acoesVencidas: { id: string; titulo: string; prioridade: string; prazo: string | null }[];
  };
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
  atualizadoEm: string;
  resumo: {
    total: number;
    ativos: number;
    estaveis: number;
    atencao: number;
    criticos: number;
    atrasados: number;
    bloqueados: number;
    impedimentos: number;
    marcosAtrasados: number;
    acoesVencidas: number;
  };
  ranking: ProjetoRanking[];
  projetos: ProjetoRanking[];
  porStatus: { nome: string; total: number }[];
  porEtapa: { nome: string; total: number }[];
  error?: string;
};

type DrilldownKey =
  | "estaveis" | "atencao" | "criticos" | "ativos"
  | "atrasados" | "bloqueados" | "impedimentos"
  | "marcosAtrasados" | "acoesVencidas";

type Props = {
  onOpenProjeto?: (projetoId: string) => void;
};

export default function DashboardExecutivo({ onOpenProjeto }: Props) {
  const [dados, setDados] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [drilldown, setDrilldown] = useState<DrilldownKey | null>(null);

  const carregar = useCallback(async () => {
    try {
      setLoading(true);
      setErro("");

      const response = await fetch("/api/dashboard/executivo", {
        cache: "no-store",
      });

      const result = (await response.json()) as DashboardResponse;

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Erro ao carregar dashboard.");
      }

      setDados(result);
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Erro ao carregar dashboard executivo.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  if (loading && !dados) {
    return (
      <div className="mt-5 flex min-h-[240px] items-center justify-center rounded-3xl border border-white/[.06] bg-white/[.025]">
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <Loader2 size={18} className="animate-spin" />
          Calculando saúde da carteira...
        </div>
      </div>
    );
  }

  if (erro && !dados) {
    return (
      <div className="mt-5 rounded-2xl border border-rose-400/20 bg-rose-500/[.06] p-5">
        <div className="flex items-center gap-2 font-semibold text-rose-200">
          <AlertTriangle size={18} />
          Dashboard executivo indisponível
        </div>
        <p className="mt-2 text-sm text-rose-200/60">{erro}</p>
        <button
          onClick={() => void carregar()}
          className="mt-4 rounded-xl border border-rose-300/20 px-4 py-2 text-xs font-semibold text-rose-100"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  if (!dados) return null;

  const cards = [
    {
      key: "estaveis" as DrilldownKey,
      label: "Estáveis",
      value: dados.resumo.estaveis,
      helper: "Operação sem alerta",
      icon: CheckCircle2,
      className: "border-emerald-400/20 bg-emerald-500/[.06] text-emerald-300",
    },
    {
      key: "atencao" as DrilldownKey,
      label: "Atenção",
      value: dados.resumo.atencao,
      helper: "Exigem acompanhamento",
      icon: AlertTriangle,
      className: "border-amber-400/20 bg-amber-500/[.06] text-amber-300",
    },
    {
      key: "criticos" as DrilldownKey,
      label: "Críticos",
      value: dados.resumo.criticos,
      helper: "Atuação prioritária",
      icon: ShieldAlert,
      className: "border-rose-400/20 bg-rose-500/[.06] text-rose-300",
    },
    {
      key: "ativos" as DrilldownKey,
      label: "Projetos ativos",
      value: dados.resumo.ativos,
      helper: `${dados.resumo.total} na carteira`,
      icon: Activity,
      className: "border-sky-400/20 bg-sky-500/[.06] text-sky-300",
    },
  ];

  return (
    <div className="mt-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[.18em] text-sky-400">
            Executive intelligence
          </div>
          <h2 className="mt-1 text-lg font-bold text-white">
            Saúde da carteira
          </h2>
        </div>

        <button
          onClick={() => void carregar()}
          disabled={loading}
          className="flex items-center gap-2 rounded-xl border border-white/[.07] bg-white/[.025] px-3 py-2 text-xs text-slate-400 hover:text-white disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Atualizar
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.label}
              type="button"
              onClick={() => setDrilldown(card.key)}
              className={`rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:bg-white/[.05] ${card.className}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-[.12em] opacity-70">
                  {card.label}
                </span>
                <Icon size={16} />
              </div>
              <div className="mt-3 text-3xl font-bold text-white">
                {card.value}
              </div>
              <div className="mt-1 text-[11px] opacity-60">{card.helper}</div>
            </button>
          );
        })}
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <Mini label="Projetos atrasados" value={dados.resumo.atrasados} icon={Clock3} onClick={() => setDrilldown("atrasados")} />
        <Mini label="Bloqueados" value={dados.resumo.bloqueados} icon={Ban} onClick={() => setDrilldown("bloqueados")} />
        <Mini label="Impedimentos" value={dados.resumo.impedimentos} icon={ShieldAlert} onClick={() => setDrilldown("impedimentos")} />
        <Mini label="Marcos atrasados" value={dados.resumo.marcosAtrasados} icon={Flag} onClick={() => setDrilldown("marcosAtrasados")} />
        <Mini label="Ações vencidas" value={dados.resumo.acoesVencidas} icon={ListTodo} onClick={() => setDrilldown("acoesVencidas")} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.45fr_.75fr]">
        <section className="overflow-hidden rounded-2xl border border-white/[.07] bg-white/[.025]">
          <div className="border-b border-white/[.06] px-5 py-4">
            <div className="text-[10px] font-bold uppercase tracking-[.16em] text-slate-500">
              Priorização
            </div>
            <h3 className="mt-1 font-bold text-white">
              Projetos que exigem atenção
            </h3>
          </div>

          {dados.ranking.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              Nenhum projeto possui alerta ativo.
            </div>
          ) : (
            <div className="divide-y divide-white/[.05]">
              {dados.ranking.map((projeto, index) => (
                <button
                  key={projeto.id}
                  onClick={() => onOpenProjeto?.(projeto.id)}
                  className="flex w-full items-center gap-4 px-5 py-4 text-left transition hover:bg-white/[.025]"
                >
                  <div className="w-6 text-center text-xs font-bold text-slate-600">
                    {index + 1}
                  </div>

                  <div
                    className={[
                      "h-2.5 w-2.5 shrink-0 rounded-full",
                      projeto.saude === "Crítico"
                        ? "bg-rose-400"
                        : projeto.saude === "Atenção"
                          ? "bg-amber-300"
                          : "bg-emerald-400",
                    ].join(" ")}
                  />

                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-white">
                      {projeto.nome}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-500">
                      <span>{projeto.cliente?.nome ?? "Sem cliente"}</span>
                      <span>{projeto.etapa?.nome ?? "Sem etapa"}</span>
                      <span>{projeto.responsavel?.nome ?? "Sem responsável"}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {projeto.indicadores.impedimentosAbertos > 0 && (
                        <Tag>{projeto.indicadores.impedimentosAbertos} imped.</Tag>
                      )}
                      {projeto.indicadores.marcosAtrasados > 0 && (
                        <Tag>{projeto.indicadores.marcosAtrasados} marco(s)</Tag>
                      )}
                      {projeto.indicadores.acoesVencidas > 0 && (
                        <Tag>{projeto.indicadores.acoesVencidas} ação(ões)</Tag>
                      )}
                      {projeto.indicadores.projetoAtrasado && <Tag>Projeto atrasado</Tag>}
                    </div>
                  </div>

                  <div className="text-right">
                    <div
                      className={[
                        "text-xs font-bold",
                        projeto.saude === "Crítico"
                          ? "text-rose-300"
                          : projeto.saude === "Atenção"
                            ? "text-amber-300"
                            : "text-emerald-300",
                      ].join(" ")}
                    >
                      {projeto.saude}
                    </div>
                    <div className="mt-1 text-[10px] text-slate-600">
                      {projeto.percentual ?? 0}% concluído
                    </div>
                  </div>

                  <ChevronRight size={15} className="text-slate-700" />
                </button>
              ))}
            </div>
          )}
        </section>

        <div className="space-y-4">
          <Distribution title="Projetos por status" items={dados.porStatus} />
          <Distribution title="Ativos por etapa" items={dados.porEtapa} />
        </div>
      </div>

      {drilldown && (
        <DrilldownModal
          tipo={drilldown}
          projetos={dados.projetos ?? []}
          onClose={() => setDrilldown(null)}
          onOpenProjeto={(id) => {
            setDrilldown(null);
            onOpenProjeto?.(id);
          }}
        />
      )}
    </div>
  );
}

function Mini({
  label,
  value,
  icon: Icon,
  onClick,
}: {
  label: string;
  value: number;
  icon: typeof Activity;
  onClick?: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className="rounded-2xl border border-white/[.06] bg-white/[.025] p-4 text-left transition hover:-translate-y-0.5 hover:bg-white/[.05]">
      <div className="flex items-center justify-between text-slate-500">
        <span className="text-[10px] font-bold uppercase tracking-[.1em]">
          {label}
        </span>
        <Icon size={15} />
      </div>
      <div className="mt-2 text-2xl font-bold text-white">{value}</div>
    </button>
  );
}

function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-md border border-amber-400/15 bg-amber-400/[.05] px-2 py-1 text-[9px] font-semibold text-amber-200/70">
      {children}
    </span>
  );
}

function formatarData(data: string | null | undefined) {
  if (!data) return "Sem prazo";
  const [ano, mes, dia] = data.split("-");
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : data;
}

function DrilldownModal({ tipo, projetos, onClose, onOpenProjeto }: {
  tipo: DrilldownKey;
  projetos: ProjetoRanking[];
  onClose: () => void;
  onOpenProjeto: (id: string) => void;
}) {
  const config: Record<DrilldownKey, { titulo: string; descricao: string }> = {
    estaveis: { titulo: "Projetos estáveis", descricao: "Operações ativas sem alertas gerenciais." },
    atencao: { titulo: "Projetos em atenção", descricao: "Projetos que exigem acompanhamento gerencial." },
    criticos: { titulo: "Projetos críticos", descricao: "Projetos com impedimentos críticos ou vencidos." },
    ativos: { titulo: "Projetos ativos", descricao: "Carteira ainda não finalizada ou cancelada." },
    atrasados: { titulo: "Projetos atrasados", descricao: "Projetos ativos com prazo final vencido." },
    bloqueados: { titulo: "Projetos bloqueados", descricao: "Projetos atualmente com status Bloqueado." },
    impedimentos: { titulo: "Impedimentos abertos", descricao: "Impedimentos ativos registrados nos projetos." },
    marcosAtrasados: { titulo: "Marcos atrasados", descricao: "Marcos não concluídos com data prevista vencida." },
    acoesVencidas: { titulo: "Ações vencidas", descricao: "Próximas ações abertas com prazo vencido." },
  };

  const filtrados = projetos.filter((p) => {
    if (tipo === "estaveis") return p.saude === "Estável";
    if (tipo === "atencao") return p.saude === "Atenção";
    if (tipo === "criticos") return p.saude === "Crítico";
    if (tipo === "ativos") return true;
    if (tipo === "atrasados") return p.indicadores.projetoAtrasado;
    if (tipo === "bloqueados") return p.status === "Bloqueado";
    if (tipo === "impedimentos") return p.indicadores.impedimentosAbertos > 0;
    if (tipo === "marcosAtrasados") return p.indicadores.marcosAtrasados > 0;
    return p.indicadores.acoesVencidas > 0;
  });

  const quantidade = tipo === "impedimentos"
    ? filtrados.reduce((s, p) => s + p.indicadores.impedimentosAbertos, 0)
    : tipo === "marcosAtrasados"
      ? filtrados.reduce((s, p) => s + p.indicadores.marcosAtrasados, 0)
      : tipo === "acoesVencidas"
        ? filtrados.reduce((s, p) => s + p.indicadores.acoesVencidas, 0)
        : filtrados.length;

  const detalhe = (p: ProjetoRanking) => {
    if (tipo === "atrasados") return `Prazo final: ${formatarData(p.data_fim)}`;
    if (tipo === "impedimentos") return (p.detalhesAlertas?.impedimentos ?? []).map(x => `${x.titulo} · ${x.prioridade}${x.prazo ? ` · ${formatarData(x.prazo)}` : ""}`).join(" | ");
    if (tipo === "marcosAtrasados") return (p.detalhesAlertas?.marcosAtrasados ?? []).map(x => `${x.nome} · previsto ${formatarData(x.data_prevista)}`).join(" | ");
    if (tipo === "acoesVencidas") return (p.detalhesAlertas?.acoesVencidas ?? []).map(x => `${x.titulo} · ${x.prioridade} · ${formatarData(x.prazo)}`).join(" | ");
    if (tipo === "atencao" || tipo === "criticos") {
      const motivos = [];
      if (p.status === "Pausado") motivos.push("Pausado");
      if (p.status === "Bloqueado") motivos.push("Bloqueado");
      if (p.indicadores.projetoAtrasado) motivos.push("Projeto atrasado");
      if (p.indicadores.pendenciasVencidas) motivos.push(`${p.indicadores.pendenciasVencidas} pendência(s) vencida(s)`);
      if (p.indicadores.impedimentosAbertos) motivos.push(`${p.indicadores.impedimentosAbertos} impedimento(s)`);
      if (p.indicadores.marcosAtrasados) motivos.push(`${p.indicadores.marcosAtrasados} marco(s) atrasado(s)`);
      if (p.indicadores.acoesVencidas) motivos.push(`${p.indicadores.acoesVencidas} ação(ões) vencida(s)`);
      return motivos.join(" · ") || "Sem alerta detalhado";
    }
    return `${p.status} · ${p.percentual ?? 0}% concluído`;
  };

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="flex h-[min(720px,calc(100dvh-48px))] w-[min(980px,calc(100vw-48px))] flex-col overflow-hidden rounded-[26px] border border-sky-400/20 bg-[#070d1b] shadow-2xl shadow-black/70">
        <div className="flex items-start justify-between border-b border-white/[.07] px-6 py-5">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[.18em] text-sky-400">Executive drill-down</div>
            <h2 className="mt-1 text-xl font-bold text-white">{config[tipo].titulo}</h2>
            <p className="mt-1 text-xs text-slate-500">{config[tipo].descricao}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full border border-white/[.08] bg-white/[.04] px-3 py-1.5 text-xs font-bold text-slate-300">{quantidade}</span>
            <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[.08] text-slate-500 hover:bg-white/[.05] hover:text-white"><X size={17} /></button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          {filtrados.length === 0 ? (
            <div className="flex h-full min-h-[260px] items-center justify-center text-center"><div><CheckCircle2 size={28} className="mx-auto text-emerald-400"/><div className="mt-3 text-sm font-semibold text-slate-300">Nenhum projeto neste indicador</div><div className="mt-1 text-xs text-slate-600">Não há ocorrências ativas para exibir.</div></div></div>
          ) : (
            <div className="space-y-2">
              {filtrados.map((p, index) => (
                <button key={p.id} type="button" onClick={() => onOpenProjeto(p.id)} className="group flex w-full items-center gap-4 rounded-2xl border border-white/[.06] bg-white/[.025] px-4 py-3.5 text-left transition hover:border-sky-400/20 hover:bg-sky-400/[.04]">
                  <div className="w-6 text-center text-xs font-bold text-slate-700">{index + 1}</div>
                  <div className={`h-2.5 w-2.5 shrink-0 rounded-full ${p.saude === "Crítico" ? "bg-rose-400" : p.saude === "Atenção" ? "bg-amber-300" : "bg-emerald-400"}`} />
                  <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-x-3 gap-y-1"><span className="text-sm font-semibold text-white">{p.nome}</span><span className="text-[10px] text-slate-600">{p.cliente?.nome ?? "Sem cliente"}</span></div><div className="mt-1 text-[10px] text-slate-500">{p.etapa?.nome ?? "Sem etapa"} · {p.responsavel?.nome ?? "Sem responsável"}</div><div className="mt-1.5 text-[10px] text-amber-200/70">{detalhe(p)}</div></div>
                  <div className="hidden text-right sm:block"><div className="text-xs font-semibold text-slate-300">{p.saude}</div><div className="mt-1 text-[9px] text-slate-600">{p.percentual ?? 0}% concluído</div></div>
                  <ChevronRight size={16} className="text-slate-700 transition group-hover:translate-x-0.5 group-hover:text-sky-400" />
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="border-t border-white/[.07] px-6 py-4 text-[10px] text-slate-600">Clique em qualquer projeto para abrir o Projeto 360.</div>
      </div>
    </div>
  );
}

function Distribution({
  title,
  items,
}: {
  title: string;
  items: { nome: string; total: number }[];
}) {
  const max = Math.max(1, ...items.map((x) => x.total));

  return (
    <section className="rounded-2xl border border-white/[.07] bg-white/[.025] p-5">
      <div className="text-[10px] font-bold uppercase tracking-[.16em] text-slate-500">
        Distribuição
      </div>
      <h3 className="mt-1 text-sm font-bold text-white">{title}</h3>

      <div className="mt-4 space-y-3">
        {items.slice(0, 7).map((item) => (
          <div key={item.nome}>
            <div className="mb-1.5 flex justify-between text-[11px]">
              <span className="truncate text-slate-400">{item.nome}</span>
              <span className="font-semibold text-slate-300">{item.total}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/[.05]">
              <div
                className="h-full rounded-full bg-sky-400/70"
                style={{ width: `${Math.max(6, (item.total / max) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
