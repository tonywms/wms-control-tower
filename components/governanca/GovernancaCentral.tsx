"use client";

import {
  AlertTriangle,
  Ban,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Filter,
  Flag,
  RefreshCw,
  Search,
  ShieldAlert,
  Timer,
  TrendingUp,
  UserRoundX,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import CapacidadeEquipe from "./CapacidadeEquipe";
import MatrizPriorizacao from "./MatrizPriorizacao";
import CentralDecisoes from "./CentralDecisoes";

type ProjetoRisco = {
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
  score: number;
  detalhesAlertas: {
    impedimentos: Array<{ id: string; titulo: string; prioridade: string; prazo: string | null }>;
    marcosAtrasados: Array<{ id: string; nome: string; data_prevista: string | null }>;
    acoesVencidas: Array<{ id: string; titulo: string; prioridade: string; prazo: string | null }>;
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
  projetos: ProjetoRisco[];
  error?: string;
};

type Severidade = "Crítica" | "Alta" | "Média";
type TipoRisco = "Impedimento" | "Projeto atrasado" | "Bloqueado" | "Pausado" | "Marco atrasado" | "Ação vencida" | "Pendência vencida";

type Risco = {
  id: string;
  projetoId: string;
  projeto: string;
  cliente: string;
  responsavel: string;
  tipo: TipoRisco;
  ocorrencia: string;
  severidade: Severidade;
  prazo: string | null;
  dias: number | null;
  score: number;
};

type Props = { onOpenProjeto?: (projetoId: string) => void };

function diasAtraso(data: string | null) {
  if (!data) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const alvo = new Date(`${data}T00:00:00`);
  alvo.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((hoje.getTime() - alvo.getTime()) / 86400000));
}

function formatarData(data: string | null) {
  if (!data) return "Sem prazo";
  const [ano, mes, dia] = data.split("-");
  return `${dia}/${mes}/${ano}`;
}

function badgeSeveridade(severidade: Severidade) {
  if (severidade === "Crítica") return "border-red-400/20 bg-red-400/[0.08] text-red-300";
  if (severidade === "Alta") return "border-amber-400/20 bg-amber-400/[0.08] text-amber-300";
  return "border-sky-400/20 bg-sky-400/[0.08] text-sky-300";
}

function montarRiscos(projetos: ProjetoRisco[]): Risco[] {
  const riscos: Risco[] = [];
  const add = (projeto: ProjetoRisco, risco: Omit<Risco, "projetoId" | "projeto" | "cliente" | "responsavel">) => {
    riscos.push({
      ...risco,
      projetoId: projeto.id,
      projeto: projeto.nome,
      cliente: projeto.cliente?.nome ?? "Sem cliente",
      responsavel: projeto.responsavel?.nome ?? "Sem responsável",
    });
  };

  projetos.forEach((p) => {
    if (p.status === "Bloqueado") add(p, { id: `bloq-${p.id}`, tipo: "Bloqueado", ocorrencia: "Projeto bloqueado e aguardando desbloqueio", severidade: "Crítica", prazo: p.data_fim, dias: diasAtraso(p.data_fim), score: 90 });
    if (p.status === "Pausado") add(p, { id: `pausa-${p.id}`, tipo: "Pausado", ocorrencia: "Projeto pausado fora do fluxo ativo", severidade: "Alta", prazo: p.data_fim, dias: diasAtraso(p.data_fim), score: 65 });
    if (p.indicadores.projetoAtrasado) add(p, { id: `atraso-${p.id}`, tipo: "Projeto atrasado", ocorrencia: "Prazo final do projeto ultrapassado", severidade: p.prioridade === "Crítica" ? "Crítica" : "Alta", prazo: p.data_fim, dias: diasAtraso(p.data_fim), score: p.prioridade === "Crítica" ? 95 : 70 });

    p.detalhesAlertas.impedimentos.forEach((x) => add(p, {
      id: `imp-${x.id}`, tipo: "Impedimento", ocorrencia: x.titulo,
      severidade: x.prioridade === "Crítica" || (x.prazo ? (diasAtraso(x.prazo) ?? 0) > 0 : false) ? "Crítica" : "Alta",
      prazo: x.prazo, dias: diasAtraso(x.prazo), score: x.prioridade === "Crítica" ? 100 : 85,
    }));

    p.detalhesAlertas.marcosAtrasados.forEach((x) => add(p, {
      id: `marco-${x.id}`, tipo: "Marco atrasado", ocorrencia: x.nome,
      severidade: "Alta", prazo: x.data_prevista, dias: diasAtraso(x.data_prevista), score: 75,
    }));

    p.detalhesAlertas.acoesVencidas.forEach((x) => add(p, {
      id: `acao-${x.id}`, tipo: "Ação vencida", ocorrencia: x.titulo,
      severidade: x.prioridade === "Crítica" ? "Crítica" : "Alta", prazo: x.prazo, dias: diasAtraso(x.prazo), score: x.prioridade === "Crítica" ? 95 : 72,
    }));

    if (p.indicadores.pendenciasVencidas > 0) add(p, {
      id: `pend-${p.id}`, tipo: "Pendência vencida", ocorrencia: `${p.indicadores.pendenciasVencidas} pendência(s) com prazo vencido`,
      severidade: "Média", prazo: null, dias: null, score: 55,
    });
  });

  return riscos.sort((a, b) => b.score - a.score || (b.dias ?? 0) - (a.dias ?? 0));
}

function faixaAging(dias: number | null) {
  const valor = dias ?? 0;
  if (valor <= 3) return "0–3 dias";
  if (valor <= 7) return "4–7 dias";
  if (valor <= 15) return "8–15 dias";
  return ">15 dias";
}

const faixasAging = ["0–3 dias", "4–7 dias", "8–15 dias", ">15 dias"] as const;
const severidadesMatriz: Severidade[] = ["Média", "Alta", "Crítica"];

export default function GovernancaCentral({ onOpenProjeto }: Props) {
  const [projetos, setProjetos] = useState<ProjetoRisco[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busca, setBusca] = useState("");
  const [severidade, setSeveridade] = useState("Todas");
  const [tipo, setTipo] = useState("Todos");
  const [responsavel, setResponsavel] = useState("Todos");
  const [drilldown, setDrilldown] = useState<{ titulo: string; subtitulo: string; riscos: Risco[] } | null>(null);

  const carregar = useCallback(async () => {
    try {
      setLoading(true); setError("");
      const response = await fetch("/api/dashboard/executivo", { cache: "no-store" });
      const data = (await response.json()) as DashboardResponse;
      if (!response.ok || !data.success) throw new Error(data.error || `Erro HTTP ${response.status}`);
      setProjetos(data.projetos ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar governança.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const riscos = useMemo(() => montarRiscos(projetos), [projetos]);
  const responsaveis = useMemo(() => Array.from(new Set(riscos.map((x) => x.responsavel))).sort(), [riscos]);
  const tipos = useMemo(() => Array.from(new Set(riscos.map((x) => x.tipo))).sort(), [riscos]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return riscos.filter((r) => {
      if (severidade !== "Todas" && r.severidade !== severidade) return false;
      if (tipo !== "Todos" && r.tipo !== tipo) return false;
      if (responsavel !== "Todos" && r.responsavel !== responsavel) return false;
      if (!q) return true;
      return [r.projeto, r.cliente, r.responsavel, r.tipo, r.ocorrencia].join(" ").toLowerCase().includes(q);
    });
  }, [riscos, busca, severidade, tipo, responsavel]);

  const criticos = riscos.filter((x) => x.severidade === "Crítica").length;
  const atrasados = riscos.filter((x) => x.dias !== null && x.dias > 0).length;
  const semResponsavel = riscos.filter((x) => x.responsavel === "Sem responsável").length;
  const projetosImpactados = new Set(riscos.map((x) => x.projetoId)).size;
  const riscosComPrazo = riscos.filter((x) => x.dias !== null);
  const idadeMedia = riscosComPrazo.length > 0
    ? Math.round(riscosComPrazo.reduce((acc, x) => acc + (x.dias ?? 0), 0) / riscosComPrazo.length)
    : 0;
  const riscoMaisAntigo = riscosComPrazo.reduce<Risco | null>((maisAntigo, atual) => {
    if (!maisAntigo) return atual;
    return (atual.dias ?? 0) > (maisAntigo.dias ?? 0) ? atual : maisAntigo;
  }, null);
  const envelhecidos = riscos.filter((x) => (x.dias ?? 0) > 7).length;
  const aging = faixasAging.map((faixa) => ({
    faixa,
    total: riscos.filter((x) => faixaAging(x.dias) === faixa).length,
  }));
  const maxAging = Math.max(...aging.map((x) => x.total), 1);
  const matriz = faixasAging.map((faixa) => ({
    faixa,
    valores: severidadesMatriz.map((sev) => riscos.filter((x) => faixaAging(x.dias) === faixa && x.severidade === sev).length),
  }));


  const abrirDrilldown = useCallback((titulo: string, subtitulo: string, itens: Risco[]) => {
    if (itens.length === 0) return;
    setDrilldown({ titulo, subtitulo, riscos: itens });
  }, []);

  const abrirFaixaAging = useCallback((faixa: string) => {
    const itens = riscos.filter((r) => faixaAging(r.dias) === faixa);
    abrirDrilldown(`Aging • ${faixa}`, `${itens.length} ocorrência(s) nessa faixa de envelhecimento`, itens);
  }, [riscos, abrirDrilldown]);

  const abrirCelulaMatriz = useCallback((faixa: string, sev: Severidade) => {
    const itens = riscos.filter((r) => faixaAging(r.dias) === faixa && r.severidade === sev);
    abrirDrilldown(`${sev} • ${faixa}`, `${itens.length} risco(s) com severidade ${sev.toLowerCase()} e aging ${faixa}`, itens);
  }, [riscos, abrirDrilldown]);


  return (
    <section className="mt-5 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-400">Governança executiva</div>
          <h2 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-white">Central de Riscos</h2>
          <p className="mt-1 text-xs text-slate-500">Exceções consolidadas da carteira, ordenadas por severidade e urgência.</p>
        </div>
        <button onClick={carregar} disabled={loading} className="flex h-9 items-center gap-2 self-start rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 text-xs text-slate-400 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-50">
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Atualizar
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi icon={ShieldAlert} label="Riscos abertos" value={riscos.length} tone="text-amber-300" />
        <Kpi icon={CircleAlert} label="Críticos" value={criticos} tone="text-red-300" />
        <Kpi icon={Timer} label="Atrasados" value={atrasados} tone="text-orange-300" />
        <Kpi icon={UserRoundX} label="Sem responsável" value={semResponsavel} tone="text-violet-300" />
        <Kpi icon={Flag} label="Projetos impactados" value={projetosImpactados} tone="text-sky-300" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4 sm:p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2"><Timer size={14} className="text-amber-300" /><span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">Aging dos riscos</span></div>
              <div className="mt-1 text-xs text-slate-600">Tempo de exposição das ocorrências abertas.</div>
            </div>
            <div className="text-right"><div className="text-2xl font-semibold text-white">{idadeMedia}d</div><div className="text-[9px] text-slate-600">idade média</div></div>
          </div>

          <div className="mt-5 space-y-4">
            {aging.map((item) => (
              <button key={item.faixa} type="button" onClick={() => abrirFaixaAging(item.faixa)} disabled={item.total === 0} className="block w-full rounded-xl p-2 text-left transition hover:bg-white/[0.035] disabled:cursor-default disabled:hover:bg-transparent">
                <div className="flex items-center justify-between text-[10px]"><span className="text-slate-500">{item.faixa}</span><span className="font-medium text-slate-300">{item.total}</span></div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.05]"><div className="h-full rounded-full bg-sky-400/70" style={{ width: `${Math.max(item.total > 0 ? 8 : 0, (item.total / maxAging) * 100)}%` }} /></div>
              </button>
            ))}
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-white/[0.05] bg-black/20 p-3"><div className="text-[9px] uppercase tracking-[0.12em] text-slate-600">Mais antigo</div><div className="mt-1 truncate text-xs font-semibold text-white">{riscoMaisAntigo?.projeto ?? "—"}</div><div className="mt-1 text-[9px] text-red-300">{riscoMaisAntigo?.dias ? `${riscoMaisAntigo.dias} dias aberto` : "Sem aging calculável"}</div></div>
            <div className="rounded-xl border border-white/[0.05] bg-black/20 p-3"><div className="text-[9px] uppercase tracking-[0.12em] text-slate-600">Envelhecidos</div><div className="mt-1 text-xl font-semibold text-white">{envelhecidos}</div><div className="mt-1 text-[9px] text-amber-300">acima de 7 dias</div></div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4 sm:p-5">
          <div className="flex items-start justify-between gap-4">
            <div><div className="flex items-center gap-2"><TrendingUp size={14} className="text-sky-300" /><span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">Matriz severidade × tempo</span></div><div className="mt-1 text-xs text-slate-600">Concentração dos riscos por criticidade e envelhecimento.</div></div>
            <span className="rounded-full border border-red-400/10 bg-red-400/[0.05] px-2.5 py-1 text-[9px] text-red-300">Priorizar canto inferior direito</span>
          </div>

          <div className="mt-5 overflow-x-auto">
            <div className="min-w-[520px] grid grid-cols-[100px_repeat(3,1fr)] gap-2">
              <div />
              {severidadesMatriz.map((sev) => <div key={sev} className="px-2 pb-1 text-center text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-600">{sev}</div>)}
              {matriz.map((linha, rowIndex) => (
                <div key={linha.faixa} className="contents">
                  <div className="flex items-center text-[10px] text-slate-500">{linha.faixa}</div>
                  {linha.valores.map((valor, colIndex) => {
                    const quente = rowIndex >= 2 && colIndex >= 1;
                    const critico = rowIndex === 3 && colIndex === 2;
                    return <button type="button" key={`${linha.faixa}-${colIndex}`} onClick={() => abrirCelulaMatriz(linha.faixa, severidadesMatriz[colIndex])} disabled={valor === 0} title={valor > 0 ? `Ver ${valor} ocorrência(s): ${severidadesMatriz[colIndex]} • ${linha.faixa}` : "Nenhuma ocorrência"} className={`flex h-14 items-center justify-center rounded-xl border text-lg font-semibold transition ${valor > 0 ? "cursor-pointer hover:-translate-y-0.5 hover:brightness-125" : "cursor-default"} ${critico ? "border-red-400/25 bg-red-400/[0.10] text-red-200" : quente ? "border-amber-400/15 bg-amber-400/[0.06] text-amber-200" : "border-white/[0.05] bg-black/20 text-slate-300"}`}>{valor}</button>;
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-3">
        <div className="flex flex-col gap-2 xl:flex-row xl:items-center">
          <div className="relative min-w-0 flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar projeto, cliente, ocorrência..." className="h-9 w-full rounded-xl border border-white/[0.06] bg-black/20 pl-9 pr-3 text-xs text-slate-200 outline-none placeholder:text-slate-700 focus:border-sky-400/20" />
          </div>
          <div className="flex items-center gap-2 text-[10px] text-slate-600"><Filter size={13} /> Filtros</div>
          <Select value={severidade} onChange={setSeveridade} options={["Todas", "Crítica", "Alta", "Média"]} />
          <Select value={tipo} onChange={setTipo} options={["Todos", ...tipos]} />
          <Select value={responsavel} onChange={setResponsavel} options={["Todos", ...responsaveis]} />
        </div>
      </div>

      {error && <div className="rounded-2xl border border-red-400/15 bg-red-400/[0.05] p-4 text-xs text-red-300"><AlertTriangle size={15} className="mr-2 inline" />{error}</div>}

      <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.025]">
        <div className="flex items-center justify-between border-b border-white/[0.05] px-4 py-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">Fila priorizada</div>
          <div className="text-[10px] text-slate-600">{filtrados.length} ocorrência(s)</div>
        </div>

        {loading ? (
          <div className="p-10 text-center text-xs text-slate-600">Consolidando riscos da carteira...</div>
        ) : filtrados.length === 0 ? (
          <div className="flex min-h-[180px] items-center justify-center text-center"><div><CheckCircle2 size={24} className="mx-auto text-emerald-300" /><div className="mt-2 text-sm font-medium text-slate-300">Nenhum risco encontrado</div><div className="mt-1 text-[10px] text-slate-600">Não há ocorrências para os filtros selecionados.</div></div></div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {filtrados.map((r) => (
              <button key={r.id} onClick={() => onOpenProjeto?.(r.projetoId)} className="grid w-full grid-cols-[minmax(0,1.4fr)_minmax(0,2fr)] gap-3 px-4 py-4 text-left transition hover:bg-white/[0.025] lg:grid-cols-[120px_minmax(0,1.1fr)_minmax(0,1.6fr)_160px_130px_28px] lg:items-center">
                <div><span className={`inline-flex rounded-full border px-2 py-1 text-[9px] font-semibold ${badgeSeveridade(r.severidade)}`}>{r.severidade}</span></div>
                <div className="min-w-0"><div className="truncate text-xs font-semibold text-white">{r.projeto}</div><div className="mt-1 truncate text-[9px] text-slate-600">{r.cliente}</div></div>
                <div className="min-w-0"><div className="text-[10px] font-medium text-slate-300">{r.tipo}</div><div className="mt-1 truncate text-[9px] text-slate-600">{r.ocorrencia}</div></div>
                <div className="min-w-0"><div className="truncate text-[10px] text-slate-400">{r.responsavel}</div></div>
                <div><div className="text-[10px] text-slate-400">{formatarData(r.prazo)}</div>{r.dias !== null && r.dias > 0 && <div className="mt-1 text-[9px] text-red-300">{r.dias}d em atraso</div>}</div>
                <ChevronRight size={15} className="hidden text-slate-700 lg:block" />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="my-8 h-px bg-gradient-to-r from-transparent via-sky-400/20 to-transparent" />

      <CapacidadeEquipe onOpenProjeto={onOpenProjeto} />

      <div className="my-8 h-px bg-gradient-to-r from-transparent via-violet-400/20 to-transparent" />

      <MatrizPriorizacao onOpenProjeto={onOpenProjeto} />

      <div className="my-8 h-px bg-gradient-to-r from-transparent via-fuchsia-400/20 to-transparent" />

      <CentralDecisoes onOpenProjeto={onOpenProjeto} />

      {drilldown && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) setDrilldown(null); }}>
          <div className="flex h-[min(720px,calc(100dvh-48px))] w-[min(1050px,calc(100vw-48px))] flex-col overflow-hidden rounded-[24px] border border-sky-400/20 bg-[#070d1b] shadow-2xl shadow-black/70">
            <div className="flex items-start justify-between gap-4 border-b border-white/[0.06] px-5 py-4">
              <div>
                <div className="text-[9px] font-semibold uppercase tracking-[0.18em] text-sky-400">Drill-down executivo</div>
                <h3 className="mt-1 text-lg font-semibold text-white">{drilldown.titulo}</h3>
                <p className="mt-1 text-[10px] text-slate-500">{drilldown.subtitulo}</p>
              </div>
              <button type="button" onClick={() => setDrilldown(null)} className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2 text-xs text-slate-400 transition hover:bg-white/[0.07] hover:text-white">Fechar</button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="grid grid-cols-[minmax(150px,1fr)_minmax(220px,1.5fr)_150px_110px_70px_24px] gap-3 border-b border-white/[0.05] px-5 py-3 text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-600">
                <div>Projeto</div><div>Ocorrência</div><div>Responsável</div><div>Prazo</div><div>Aging</div><div />
              </div>
              <div className="divide-y divide-white/[0.04]">
                {drilldown.riscos.map((r) => (
                  <button key={r.id} type="button" onClick={() => { setDrilldown(null); onOpenProjeto?.(r.projetoId); }} className="grid w-full grid-cols-[minmax(150px,1fr)_minmax(220px,1.5fr)_150px_110px_70px_24px] gap-3 px-5 py-4 text-left transition hover:bg-white/[0.03]">
                    <div className="min-w-0"><div className="truncate text-xs font-semibold text-white">{r.projeto}</div><div className="mt-1 truncate text-[9px] text-slate-600">{r.cliente}</div></div>
                    <div className="min-w-0"><div className="flex items-center gap-2"><span className={`inline-flex rounded-full border px-2 py-0.5 text-[8px] font-semibold ${badgeSeveridade(r.severidade)}`}>{r.severidade}</span><span className="text-[10px] font-medium text-slate-300">{r.tipo}</span></div><div className="mt-1 truncate text-[9px] text-slate-600">{r.ocorrencia}</div></div>
                    <div className="truncate text-[10px] text-slate-400">{r.responsavel}</div>
                    <div className="text-[10px] text-slate-400">{formatarData(r.prazo)}</div>
                    <div className={`text-[10px] font-semibold ${(r.dias ?? 0) > 7 ? "text-red-300" : (r.dias ?? 0) > 3 ? "text-amber-300" : "text-slate-400"}`}>{r.dias !== null ? `${r.dias}d` : "—"}</div>
                    <ChevronRight size={15} className="text-slate-700" />
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-white/[0.06] px-5 py-3 text-[9px] text-slate-600">
              <span>{drilldown.riscos.length} ocorrência(s)</span>
              <span>Clique em uma linha para abrir o Projeto 360</span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function Kpi({ icon: Icon, label, value, tone }: { icon: typeof ShieldAlert; label: string; value: number; tone: string }) {
  return <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4"><div className="flex items-center justify-between"><span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-600">{label}</span><Icon size={14} className={tone} /></div><div className="mt-3 text-2xl font-semibold text-white">{value}</div></div>;
}

function Select({ value, onChange, options }: { value: string; onChange: (value: string) => void; options: string[] }) {
  return <select value={value} onChange={(e) => onChange(e.target.value)} className="h-9 min-w-[150px] rounded-xl border border-white/[0.06] bg-[#0a1020] px-3 text-[10px] text-slate-400 outline-none focus:border-sky-400/20">{options.map((x) => <option key={x} value={x}>{x}</option>)}</select>;
}