"use client";

import {
  AlertTriangle,
  ChevronRight,
  ArrowRight,
  Gauge,
  RefreshCw,
  Scale,
  Search,
  Sparkles,
  Users,
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

type LinhaEquipe = {
  id: string;
  nome: string;
  projetos: Projeto[];
  ativos: number;
  atencao: number;
  criticos: number;
  atrasados: number;
  bloqueados: number;
  riscos: number;
  score: number;
  carga: "Baixa" | "Normal" | "Alta" | "Crítica";
};

type ForecastEquipe = {
  responsavel: LinhaEquipe;
  hoje: number;
  d7: number;
  d15: number;
  d30: number;
  liberacoes7: number;
  liberacoes15: number;
  liberacoes30: number;
  capacidadeFutura: "Disponível" | "Moderada" | "Restrita" | "Não recomendada";
};

const statusEncerrados = new Set(["Finalizado", "Cancelado"]);

function calcularCarga(projetos: Projeto[]): Omit<LinhaEquipe, "id" | "nome" | "projetos"> {
  const ativos = projetos.filter((p) => !statusEncerrados.has(p.status)).length;
  const atencao = projetos.filter((p) => p.saude === "Atenção").length;
  const criticos = projetos.filter((p) => p.saude === "Crítico").length;
  const atrasados = projetos.filter((p) => p.indicadores.projetoAtrasado).length;
  const bloqueados = projetos.filter((p) => p.status === "Bloqueado").length;
  const riscos = projetos.reduce(
    (acc, p) =>
      acc +
      (p.indicadores.projetoAtrasado ? 1 : 0) +
      (p.status === "Bloqueado" ? 1 : 0) +
      (p.status === "Pausado" ? 1 : 0) +
      p.indicadores.pendenciasVencidas +
      p.indicadores.impedimentosAbertos +
      p.indicadores.marcosAtrasados +
      p.indicadores.acoesVencidas,
    0,
  );

  const score =
    ativos * 8 +
    atencao * 12 +
    criticos * 30 +
    atrasados * 14 +
    bloqueados * 20 +
    riscos * 6;

  const carga: LinhaEquipe["carga"] =
    score >= 150 ? "Crítica" : score >= 90 ? "Alta" : score >= 40 ? "Normal" : "Baixa";

  return { ativos, atencao, criticos, atrasados, bloqueados, riscos, score, carga };
}

function badgeCarga(carga: LinhaEquipe["carga"]) {
  if (carga === "Crítica") return "border-red-400/20 bg-red-400/[0.08] text-red-300";
  if (carga === "Alta") return "border-amber-400/20 bg-amber-400/[0.08] text-amber-300";
  if (carga === "Normal") return "border-sky-400/20 bg-sky-400/[0.08] text-sky-300";
  return "border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-300";
}


function diasAte(data?: string | null) {
  if (!data) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const fim = new Date(`${data}T12:00:00`);
  fim.setHours(0, 0, 0, 0);
  return Math.ceil((fim.getTime() - hoje.getTime()) / 86400000);
}

function cargaProjetada(valor: number) {
  if (valor >= 9) return "Crítica";
  if (valor >= 6) return "Alta";
  if (valor >= 3) return "Normal";
  return "Baixa";
}

function cargaTone(carga: string) {
  if (carga === "Crítica") return "text-red-300";
  if (carga === "Alta") return "text-amber-300";
  if (carga === "Normal") return "text-sky-300";
  return "text-emerald-300";
}

export default function CapacidadeEquipe({ onOpenProjeto }: Props) {
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busca, setBusca] = useState("");
  const [selecionado, setSelecionado] = useState<LinhaEquipe | null>(null);

  const carregar = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const response = await fetch("/api/dashboard/executivo", { cache: "no-store" });
      const data = (await response.json()) as DashboardResponse;
      if (!response.ok || !data.success) throw new Error(data.error || `Erro HTTP ${response.status}`);
      setProjetos(data.projetos ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar capacidade da equipe.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const equipe = useMemo(() => {
    const grupos = new Map<string, { id: string; nome: string; projetos: Projeto[] }>();

    projetos
      .filter((p) => !statusEncerrados.has(p.status))
      .forEach((p) => {
        const id = p.responsavel?.id ?? "__sem_responsavel__";
        const nome = p.responsavel?.nome ?? "Sem responsável";
        const atual = grupos.get(id) ?? { id, nome, projetos: [] };
        atual.projetos.push(p);
        grupos.set(id, atual);
      });

    return Array.from(grupos.values())
      .map((g): LinhaEquipe => ({ ...g, ...calcularCarga(g.projetos) }))
      .sort((a, b) => b.score - a.score || b.ativos - a.ativos);
  }, [projetos]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return equipe;
    return equipe.filter((x) => x.nome.toLowerCase().includes(q));
  }, [equipe, busca]);

  const totalAtivos = equipe.reduce((a, x) => a + x.ativos, 0);
  const totalRiscos = equipe.reduce((a, x) => a + x.riscos, 0);
  const sobrecarregados = equipe.filter((x) => x.carga === "Alta" || x.carga === "Crítica").length;
  const maior = equipe[0] ?? null;

  const concentracaoMaior = maior && totalAtivos > 0
    ? Math.round((maior.ativos / totalAtivos) * 100)
    : 0;

  const mediaProjetos = equipe.length > 0
    ? totalAtivos / equipe.length
    : 0;

  const desvioCarga = equipe.length > 0
    ? Math.sqrt(
        equipe.reduce(
          (acc, item) => acc + Math.pow(item.ativos - mediaProjetos, 2),
          0,
        ) / equipe.length,
      )
    : 0;

  const indiceDesequilibrio = mediaProjetos > 0
    ? Math.round((desvioCarga / mediaProjetos) * 100)
    : 0;

  const nivelEquilibrio =
    indiceDesequilibrio >= 100
      ? "Muito concentrada"
      : indiceDesequilibrio >= 60
        ? "Concentrada"
        : indiceDesequilibrio >= 30
          ? "Moderada"
          : "Equilibrada";

  const oportunidades = useMemo(() => {
    const origens = equipe.filter(
      (item) => item.carga === "Crítica" || item.carga === "Alta",
    );

    const destinos = equipe
      .filter(
        (item) =>
          item.id !== "__sem_responsavel__" &&
          item.carga !== "Crítica" &&
          item.carga !== "Alta",
      )
      .sort((a, b) => a.score - b.score || a.ativos - b.ativos);

    const sugestoes: Array<{
      origem: LinhaEquipe;
      destino: LinhaEquipe;
      projeto: Projeto;
      motivo: string;
    }> = [];

    origens.forEach((origem) => {
      const candidatos = origem.projetos
        .filter(
          (projeto) =>
            projeto.saude === "Estável" &&
            projeto.status !== "Bloqueado" &&
            projeto.status !== "Pausado",
        )
        .sort((a, b) => a.percentual - b.percentual);

      candidatos.slice(0, 2).forEach((projeto, index) => {
        const destino = destinos[index % Math.max(destinos.length, 1)];
        if (!destino) return;

        sugestoes.push({
          origem,
          destino,
          projeto,
          motivo:
            "Projeto estável em responsável com carga elevada; candidato para avaliação de redistribuição.",
        });
      });
    });

    return sugestoes.slice(0, 4);
  }, [equipe]);

  const forecastEquipe = useMemo(() => {
    return equipe
      .filter((item) => item.id !== "__sem_responsavel__")
      .map((item): ForecastEquipe => {
        const ativos = item.projetos.filter(
          (p) => !statusEncerrados.has(p.status),
        );

        const liberacoesAte = (limite: number) =>
          ativos.filter((p) => {
            const dias = diasAte(p.data_fim);
            return dias !== null && dias >= 0 && dias <= limite;
          }).length;

        const liberacoes7 = liberacoesAte(7);
        const liberacoes15 = liberacoesAte(15);
        const liberacoes30 = liberacoesAte(30);

        const hoje = ativos.length;
        const d7 = Math.max(0, hoje - liberacoes7);
        const d15 = Math.max(0, hoje - liberacoes15);
        const d30 = Math.max(0, hoje - liberacoes30);

        let capacidadeFutura: ForecastEquipe["capacidadeFutura"];

        if (d30 <= 2 && item.riscos <= 1) {
          capacidadeFutura = "Disponível";
        } else if (d30 <= 4 && item.riscos <= 3) {
          capacidadeFutura = "Moderada";
        } else if (d30 <= 6) {
          capacidadeFutura = "Restrita";
        } else {
          capacidadeFutura = "Não recomendada";
        }

        return {
          responsavel: item,
          hoje,
          d7,
          d15,
          d30,
          liberacoes7,
          liberacoes15,
          liberacoes30,
          capacidadeFutura,
        };
      })
      .sort(
        (a, b) =>
          b.hoje - a.hoje ||
          b.responsavel.riscos - a.responsavel.riscos,
      );
  }, [equipe]);

  const capacidadeDisponivel30 = forecastEquipe.filter(
    (item) =>
      item.capacidadeFutura === "Disponível" ||
      item.capacidadeFutura === "Moderada",
  ).length;

  const liberacoes30Total = forecastEquipe.reduce(
    (acc, item) => acc + item.liberacoes30,
    0,
  );

  return (
    <section className="mt-5 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-400">
            Governança executiva
          </div>
          <h2 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-white">
            Capacidade da Equipe
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Concentração operacional por responsável, considerando carteira, atrasos e riscos.
          </p>
        </div>
        <button onClick={carregar} disabled={loading} className="flex h-9 items-center gap-2 self-start rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 text-xs text-slate-400 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-50">
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Atualizar
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Responsáveis ativos" value={equipe.length} />
        <Kpi label="Projetos ativos" value={totalAtivos} />
        <Kpi label="Riscos concentrados" value={totalRiscos} />
        <Kpi label="Carga alta/crítica" value={sobrecarregados} />
        <Kpi label="Maior concentração" value={`${concentracaoMaior}%`} />
        <Kpi label="Desequilíbrio" value={`${indiceDesequilibrio}%`} />
      </div>

      {maior && (
        <div className="rounded-2xl border border-amber-400/10 bg-amber-400/[0.04] p-4">
          <div className="flex items-start gap-3">
            <Gauge size={18} className="mt-0.5 text-amber-300" />
            <div>
              <div className="text-xs font-semibold text-white">Maior concentração operacional</div>
              <div className="mt-1 text-[10px] text-slate-400">
                {maior.nome}: {maior.ativos} projeto(s) ativo(s), {maior.atrasados} atrasado(s) e {maior.riscos} ocorrência(s) de risco.
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-3 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Scale size={15} className="text-sky-300" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Distribuição da carteira
                </span>
              </div>
              <div className="mt-2 text-sm font-semibold text-white">
                {nivelEquilibrio}
              </div>
              <div className="mt-1 text-[10px] text-slate-500">
                Média de {mediaProjetos.toFixed(1)} projeto(s) ativo(s) por responsável.
              </div>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2 text-right">
              <div className="text-[9px] uppercase tracking-[0.12em] text-slate-600">
                Índice
              </div>
              <div className="mt-1 text-lg font-semibold text-sky-300">
                {indiceDesequilibrio}%
              </div>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {equipe.slice(0, 8).map((item) => {
              const largura =
                maior && maior.ativos > 0
                  ? Math.max(4, Math.round((item.ativos / maior.ativos) * 100))
                  : 0;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelecionado(item)}
                  className="block w-full text-left"
                >
                  <div className="mb-1.5 flex items-center justify-between gap-3">
                    <span className="truncate text-[10px] font-medium text-slate-300">
                      {item.nome}
                    </span>
                    <span className="text-[9px] text-slate-600">
                      {item.ativos} ativo(s) • {item.riscos} risco(s)
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-black/30">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-sky-400 to-violet-400"
                      style={{ width: `${largura}%` }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-violet-400/10 bg-violet-400/[0.035] p-4">
          <div className="flex items-center gap-2">
            <Sparkles size={15} className="text-violet-300" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-violet-300">
              Apoio à redistribuição
            </span>
          </div>

          <div className="mt-2 text-xs text-slate-400">
            Sugestões para análise gerencial; nenhuma mudança é aplicada automaticamente.
          </div>

          <div className="mt-4 space-y-2">
            {oportunidades.length === 0 ? (
              <div className="rounded-xl border border-emerald-400/10 bg-emerald-400/[0.04] p-3 text-[10px] text-emerald-300">
                Nenhuma oportunidade clara de redistribuição foi identificada.
              </div>
            ) : (
              oportunidades.map((item) => (
                <button
                  key={`${item.origem.id}-${item.projeto.id}-${item.destino.id}`}
                  type="button"
                  onClick={() => onOpenProjeto?.(item.projeto.id)}
                  className="w-full rounded-xl border border-white/[0.06] bg-black/15 p-3 text-left transition hover:bg-white/[0.035]"
                >
                  <div className="flex items-center gap-2 text-[10px] font-semibold text-white">
                    <span className="truncate">{item.origem.nome}</span>
                    <ArrowRight size={12} className="shrink-0 text-violet-300" />
                    <span className="truncate">{item.destino.nome}</span>
                  </div>
                  <div className="mt-1 text-[10px] text-slate-400">
                    {item.projeto.nome} • {item.projeto.percentual}% concluído
                  </div>
                  <div className="mt-1 text-[9px] leading-4 text-slate-600">
                    {item.motivo}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025]">
        <div className="flex flex-col gap-3 border-b border-white/[0.05] p-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-sky-400">
              Capacidade & Forecast
            </div>
            <div className="mt-1 text-sm font-semibold text-white">
              Projeção de disponibilidade da equipe
            </div>
            <div className="mt-1 text-[10px] text-slate-500">
              Projeta a carteira atual em 7, 15 e 30 dias usando os prazos cadastrados dos projetos.
            </div>
          </div>

          <div className="flex gap-2">
            <div className="rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2">
              <div className="text-[8px] uppercase tracking-[0.12em] text-slate-600">
                Liberações 30d
              </div>
              <div className="mt-1 text-lg font-semibold text-emerald-300">
                {liberacoes30Total}
              </div>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2">
              <div className="text-[8px] uppercase tracking-[0.12em] text-slate-600">
                Capacidade 30d
              </div>
              <div className="mt-1 text-lg font-semibold text-sky-300">
                {capacidadeDisponivel30}
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[900px]">
            <div className="grid grid-cols-[1.4fr_repeat(4,0.65fr)_0.8fr_1fr] gap-3 border-b border-white/[0.05] px-4 py-3 text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-600">
              <div>Responsável</div>
              <div>Hoje</div>
              <div>7 dias</div>
              <div>15 dias</div>
              <div>30 dias</div>
              <div>Libera 30d</div>
              <div>Capacidade futura</div>
            </div>

            <div className="divide-y divide-white/[0.04]">
              {forecastEquipe.map((item) => (
                <button
                  key={item.responsavel.id}
                  type="button"
                  onClick={() => setSelecionado(item.responsavel)}
                  className="grid w-full grid-cols-[1.4fr_repeat(4,0.65fr)_0.8fr_1fr] items-center gap-3 px-4 py-3 text-left transition hover:bg-white/[0.025]"
                >
                  <div>
                    <div className="text-xs font-semibold text-white">
                      {item.responsavel.nome}
                    </div>
                    <div className="mt-1 text-[9px] text-slate-600">
                      {item.responsavel.riscos} risco(s)
                    </div>
                  </div>

                  {[item.hoje, item.d7, item.d15, item.d30].map((valor, index) => {
                    const carga = cargaProjetada(valor);
                    return (
                      <div key={index}>
                        <div className={`text-sm font-semibold ${cargaTone(carga)}`}>
                          {valor}
                        </div>
                        <div className="mt-0.5 text-[8px] text-slate-600">
                          {carga}
                        </div>
                      </div>
                    );
                  })}

                  <div className="text-sm font-semibold text-emerald-300">
                    {item.liberacoes30}
                  </div>

                  <div>
                    <span
                      className={`rounded-full border px-2 py-1 text-[9px] font-semibold ${
                        item.capacidadeFutura === "Disponível"
                          ? "border-emerald-400/20 bg-emerald-400/[0.07] text-emerald-300"
                          : item.capacidadeFutura === "Moderada"
                            ? "border-sky-400/20 bg-sky-400/[0.07] text-sky-300"
                            : item.capacidadeFutura === "Restrita"
                              ? "border-amber-400/20 bg-amber-400/[0.07] text-amber-300"
                              : "border-red-400/20 bg-red-400/[0.07] text-red-300"
                      }`}
                    >
                      {item.capacidadeFutura}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="border-t border-white/[0.05] px-4 py-3 text-[9px] leading-4 text-slate-600">
          Forecast considera que projetos com prazo nos próximos 7/15/30 dias podem liberar capacidade.
          É uma projeção gerencial e não altera alocação ou status automaticamente.
        </div>
      </div>

      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar responsável..." className="h-9 w-full rounded-xl border border-white/[0.06] bg-black/20 pl-9 pr-3 text-xs text-slate-200 outline-none placeholder:text-slate-700 focus:border-sky-400/20" />
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-400/15 bg-red-400/[0.05] p-4 text-xs text-red-300">
          <AlertTriangle size={15} className="mr-2 inline" />{error}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.025]">
        <div className="grid grid-cols-[minmax(160px,1.4fr)_repeat(6,minmax(80px,0.7fr))_90px_28px] gap-3 border-b border-white/[0.05] px-4 py-3 text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-600">
          <div>Responsável</div><div>Ativos</div><div>Atenção</div><div>Críticos</div><div>Atrasados</div><div>Riscos</div><div>Score</div><div>Carga</div><div />
        </div>
        {loading ? (
          <div className="p-10 text-center text-xs text-slate-600">Calculando capacidade...</div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {filtrados.map((x) => (
              <button key={x.id} onClick={() => setSelecionado(x)} className="grid w-full grid-cols-[minmax(160px,1.4fr)_repeat(6,minmax(80px,0.7fr))_90px_28px] gap-3 px-4 py-4 text-left text-xs transition hover:bg-white/[0.025]">
                <div className="font-semibold text-white">{x.nome}</div>
                <div className="text-slate-300">{x.ativos}</div>
                <div className="text-amber-300">{x.atencao}</div>
                <div className="text-red-300">{x.criticos}</div>
                <div className="text-orange-300">{x.atrasados}</div>
                <div className="text-violet-300">{x.riscos}</div>
                <div className="text-slate-300">{x.score}</div>
                <div><span className={`rounded-full border px-2 py-1 text-[9px] font-semibold ${badgeCarga(x.carga)}`}>{x.carga}</span></div>
                <ChevronRight size={15} className="text-slate-700" />
              </button>
            ))}
          </div>
        )}
      </div>

      {selecionado && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="flex h-[min(720px,calc(100dvh-48px))] w-[min(1050px,calc(100vw-48px))] flex-col overflow-hidden rounded-[24px] border border-sky-400/25 bg-[#070d1b] shadow-2xl">
            <div className="flex items-start justify-between border-b border-white/[0.06] p-5">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-400">Capacidade • Drill-down</div>
                <h3 className="mt-1 text-xl font-semibold text-white">{selecionado.nome}</h3>
                <div className="mt-1 text-[10px] text-slate-500">{selecionado.ativos} projeto(s) ativo(s) • {selecionado.riscos} risco(s)</div>
              </div>
              <button onClick={() => setSelecionado(null)} className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2 text-xs text-slate-300 hover:bg-white/[0.08]">Fechar</button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="divide-y divide-white/[0.05]">
                {selecionado.projetos
                  .slice()
                  .sort((a, b) => Number(b.indicadores.projetoAtrasado) - Number(a.indicadores.projetoAtrasado))
                  .map((p) => (
                    <button key={p.id} onClick={() => { setSelecionado(null); onOpenProjeto?.(p.id); }} className="grid w-full grid-cols-[minmax(180px,1.5fr)_1fr_1fr_100px_28px] gap-3 px-5 py-4 text-left transition hover:bg-white/[0.025]">
                      <div><div className="text-xs font-semibold text-white">{p.nome}</div><div className="mt-1 text-[9px] text-slate-600">{p.cliente?.nome ?? "Sem cliente"}</div></div>
                      <div className="text-[10px] text-slate-400">{p.etapa?.nome ?? "Sem etapa"}</div>
                      <div className={p.saude === "Crítico" ? "text-[10px] text-red-300" : p.saude === "Atenção" ? "text-[10px] text-amber-300" : "text-[10px] text-emerald-300"}>{p.saude}</div>
                      <div className="text-[10px] text-slate-400">{p.percentual}%</div>
                      <ChevronRight size={15} className="text-slate-700" />
                    </button>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function Kpi({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4">
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-600">{label}</span>
        <Users size={14} className="text-sky-300" />
      </div>
      <div className="mt-3 text-2xl font-semibold text-white">{value}</div>
    </div>
  );
}
