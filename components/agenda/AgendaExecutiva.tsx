"use client";

import { AlertTriangle, CalendarDays, Check, CheckCircle2, ChevronRight, Clock3, Filter, RefreshCw, Search, UserRoundX } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type Acao = {
  id: string; projeto_id: string; titulo: string; descricao: string | null;
  prioridade: string; status: string; responsavel_id: string | null; prazo: string | null;
  responsavel: { id: string; nome: string } | null;
  projeto: { id: string; nome: string; setor: string | null; status: string; prioridade: string } | null;
};

type Props = { onOpenProjeto: (projetoId: string) => void | Promise<void> };
const encerradas = new Set(["Concluída", "Cancelada"]);

function diffDias(data: string | null) {
  if (!data) return null;
  const [a, m, d] = data.split("-").map(Number);
  const alvo = new Date(a, m - 1, d);
  const agora = new Date();
  const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  return Math.round((alvo.getTime() - hoje.getTime()) / 86400000);
}
function dataBR(data: string | null) {
  if (!data) return "Sem prazo";
  const [a, m, d] = data.split("-"); return `${d}/${m}/${a}`;
}
function pClass(p: string) {
  if (p === "Crítica") return "border-red-400/20 bg-red-400/[0.08] text-red-300";
  if (p === "Alta") return "border-amber-400/20 bg-amber-400/[0.08] text-amber-300";
  if (p === "Baixa") return "border-slate-400/15 bg-slate-400/[0.05] text-slate-400";
  return "border-sky-400/15 bg-sky-400/[0.06] text-sky-300";
}

export default function AgendaExecutiva({ onOpenProjeto }: Props) {
  const [acoes, setAcoes] = useState<Acao[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [busca, setBusca] = useState("");
  const [responsavel, setResponsavel] = useState("Todos");
  const [prioridade, setPrioridade] = useState("Todas");
  const [situacao, setSituacao] = useState("Abertas");
  const [concluindo, setConcluindo] = useState<string | null>(null);

  const carregar = useCallback(async (silencioso = false) => {
    try {
      silencioso ? setRefreshing(true) : setLoading(true); setError("");
      const r = await fetch("/api/agenda/executiva", { cache: "no-store" });
      const j = await r.json();
      if (!r.ok || !j?.success) throw new Error(j?.error || "Não foi possível carregar a agenda.");
      setAcoes(j.acoes ?? []);
    } catch (e) { setError(e instanceof Error ? e.message : "Erro ao carregar Agenda Executiva."); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);
  const abertas = useMemo(() => acoes.filter(a => !encerradas.has(a.status)), [acoes]);
  const metricas = useMemo(() => ({
    abertas: abertas.length,
    vencidas: abertas.filter(a => (diffDias(a.prazo) ?? 0) < 0).length,
    hoje: abertas.filter(a => diffDias(a.prazo) === 0).length,
    proximos7: abertas.filter(a => { const d=diffDias(a.prazo); return d!==null && d>0 && d<=7; }).length,
    semPrazo: abertas.filter(a => !a.prazo).length,
    criticas: abertas.filter(a => a.prioridade === "Crítica").length,
    semResponsavel: abertas.filter(a => !a.responsavel_id).length,
  }), [abertas]);

  const responsaveis = useMemo(() => Array.from(new Set(acoes.map(a => a.responsavel?.nome).filter(Boolean) as string[])).sort(), [acoes]);
  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return acoes.filter(a => {
      if (situacao === "Abertas" && encerradas.has(a.status)) return false;
      if (situacao === "Concluídas" && a.status !== "Concluída") return false;
      if (responsavel !== "Todos") {
        if (responsavel === "Sem responsável" ? !!a.responsavel_id : a.responsavel?.nome !== responsavel) return false;
      }
      if (prioridade !== "Todas" && a.prioridade !== prioridade) return false;
      if (q && ![a.titulo,a.descricao,a.projeto?.nome,a.projeto?.setor,a.responsavel?.nome].filter(Boolean).join(" ").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [acoes,busca,responsavel,prioridade,situacao]);

  const grupos = useMemo(() => {
    if (situacao === "Concluídas") return [{ titulo:"Concluídas", sub:"Ações encerradas", tone:"slate", acoes:filtradas }].filter(g=>g.acoes.length);
    return [
      { titulo:"Vencidas", sub:"Intervenção imediata", tone:"red", acoes:filtradas.filter(a => (diffDias(a.prazo) ?? 0) < 0) },
      { titulo:"Hoje", sub:"Compromissos do dia", tone:"amber", acoes:filtradas.filter(a => diffDias(a.prazo) === 0) },
      { titulo:"Próximos 7 dias", sub:"Janela operacional", tone:"sky", acoes:filtradas.filter(a => {const d=diffDias(a.prazo); return d!==null&&d>0&&d<=7;}) },
      { titulo:"Próximas entregas", sub:"Após a janela de 7 dias", tone:"slate", acoes:filtradas.filter(a => {const d=diffDias(a.prazo); return d!==null&&d>7;}) },
      { titulo:"Sem prazo", sub:"Exigem definição gerencial", tone:"slate", acoes:filtradas.filter(a => !a.prazo) },
    ].filter(g => g.acoes.length);
  }, [filtradas,situacao]);

  async function concluir(a: Acao) {
    try {
      setConcluindo(a.id); setError("");
      const r = await fetch(`/api/projetos/${a.projeto_id}/acoes/${a.id}`, { method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify({status:"Concluída"}) });
      const j = await r.json(); if (!r.ok || !j?.success) throw new Error(j?.error || "Não foi possível concluir a ação.");
      await carregar(true);
    } catch(e) { setError(e instanceof Error ? e.message : "Erro ao concluir ação."); }
    finally { setConcluindo(null); }
  }

  return <section className="mt-5">
    <div className="relative overflow-hidden rounded-3xl border border-white/[0.07] bg-gradient-to-br from-sky-400/[0.055] via-white/[0.025] to-transparent p-5 sm:p-6">
      <div className="relative flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div><div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300"><CalendarDays size={14}/> Gestão de compromissos</div><h2 className="mt-2 text-2xl font-semibold text-white">Agenda Executiva</h2><p className="mt-2 text-xs text-slate-500">Prazos, responsáveis e próximas ações da carteira em uma única visão operacional.</p></div>
        <button onClick={()=>carregar(true)} disabled={refreshing} className="flex h-10 items-center gap-2 rounded-xl border border-sky-400/15 bg-sky-400/[0.07] px-4 text-xs text-sky-200"><RefreshCw size={14} className={refreshing?"animate-spin":""}/>Atualizar</button>
      </div>
    </div>

    <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
      <Kpi l="Abertas" v={metricas.abertas}/><Kpi l="Vencidas" v={metricas.vencidas} t="red"/><Kpi l="Hoje" v={metricas.hoje} t="amber"/><Kpi l="Próx. 7 dias" v={metricas.proximos7}/><Kpi l="Sem prazo" v={metricas.semPrazo} t="slate"/><Kpi l="Críticas" v={metricas.criticas} t="red"/><Kpi l="Sem owner" v={metricas.semResponsavel} t="amber"/>
    </div>

    <div className="mt-4 rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4"><div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.15em] text-slate-500"><Filter size={13}/>Filtros</div><div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-[1.6fr_1fr_1fr_1fr]">
      <label className="relative"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600"/><input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Buscar ação, projeto, setor..." className="h-10 w-full rounded-xl border border-white/[0.07] bg-black/20 pl-9 pr-3 text-xs text-slate-200 outline-none"/></label>
      <Sel v={responsavel} set={setResponsavel} opts={["Todos","Sem responsável",...responsaveis]}/><Sel v={prioridade} set={setPrioridade} opts={["Todas","Crítica","Alta","Normal","Baixa"]}/><Sel v={situacao} set={setSituacao} opts={["Abertas","Concluídas","Todas"]}/>
    </div></div>

    {error && <div className="mt-4 flex gap-3 rounded-2xl border border-red-400/15 bg-red-400/[0.05] p-4 text-xs text-red-200"><AlertTriangle size={16}/>{error}</div>}
    {loading ? <div className="mt-4 rounded-2xl border border-white/[0.06] p-8 text-center text-xs text-slate-500">Sincronizando plano de ação...</div> : grupos.length===0 ? <div className="mt-4 rounded-2xl border border-white/[0.06] p-10 text-center"><CheckCircle2 size={24} className="mx-auto text-emerald-300"/><div className="mt-3 text-sm text-slate-300">Nenhuma ação encontrada</div></div> : <div className="mt-4 space-y-4">{grupos.map(g=><div key={g.titulo} className="overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.02]"><div className="flex items-center gap-2 border-b border-white/[0.05] px-5 py-3.5"><Clock3 size={14} className={g.tone==="red"?"text-red-300":g.tone==="amber"?"text-amber-300":"text-sky-300"}/><span className="text-xs font-semibold text-slate-200">{g.titulo}</span><span className="rounded-full bg-white/[0.05] px-2 py-0.5 text-[9px] text-slate-400">{g.acoes.length}</span><span className="ml-auto text-[9px] text-slate-600">{g.sub}</span></div><div className="divide-y divide-white/[0.04]">{g.acoes.map(a=>{const d=diffDias(a.prazo); return <div key={a.id} className="grid gap-3 px-5 py-4 xl:grid-cols-[1.1fr_1.7fr_0.9fr_0.8fr_auto]"><button onClick={()=>onOpenProjeto(a.projeto_id)} className="text-left"><div className="truncate text-xs font-semibold text-white hover:text-sky-300">{a.projeto?.nome??"Projeto"}</div><div className="mt-1 text-[9px] text-slate-600">{a.projeto?.setor??"Sem setor"}</div></button><div><div className="flex flex-wrap items-center gap-2"><span className="text-xs text-slate-300">{a.titulo}</span><span className={`rounded-full border px-2 py-0.5 text-[8px] ${pClass(a.prioridade)}`}>{a.prioridade}</span></div><div className="mt-1 line-clamp-1 text-[9px] text-slate-600">{a.descricao}</div></div><div className={`flex items-center gap-1.5 text-[10px] ${a.responsavel_id?"text-slate-400":"text-amber-300"}`}>{!a.responsavel_id&&<UserRoundX size={12}/>} {a.responsavel?.nome??"Sem responsável"}</div><div><div className={`text-[10px] ${d!==null&&d<0?"text-red-300":d===0?"text-amber-300":"text-slate-400"}`}>{dataBR(a.prazo)}</div><div className="mt-1 text-[8px] text-slate-700">{d===null?"Definir prazo":d<0?`${Math.abs(d)}d atrasada`:d===0?"Vence hoje":d===1?"Amanhã":`Em ${d} dias`}</div></div><div className="flex justify-end gap-2">{a.status!=="Concluída"&&<button title="Concluir" disabled={concluindo===a.id} onClick={()=>concluir(a)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-400/15 bg-emerald-400/[0.05] text-emerald-300"><Check size={13}/></button>}<button onClick={()=>onOpenProjeto(a.projeto_id)} className="flex h-8 items-center gap-1 rounded-lg border border-sky-400/15 bg-sky-400/[0.05] px-2.5 text-[9px] text-sky-300">360<ChevronRight size={11}/></button></div></div>})}</div></div>)}</div>}
  </section>;
}

function Kpi({l,v,t="sky"}:{l:string;v:number;t?:"sky"|"red"|"amber"|"slate"}) { const c=t==="red"?"text-red-300 border-red-400/12":t==="amber"?"text-amber-300 border-amber-400/12":t==="slate"?"text-slate-300 border-white/[0.06]":"text-sky-300 border-sky-400/12"; return <div className={`rounded-2xl border bg-white/[0.025] p-4 ${c}`}><div className="text-2xl font-semibold">{v}</div><div className="mt-1 text-[9px] uppercase tracking-[0.12em] opacity-60">{l}</div></div> }
function Sel({v,set,opts}:{v:string;set:(x:string)=>void;opts:string[]}) { return <select value={v} onChange={e=>set(e.target.value)} className="h-10 rounded-xl border border-white/[0.07] bg-[#0b1019] px-3 text-xs text-slate-300 outline-none">{opts.map(o=><option key={o}>{o}</option>)}</select> }
