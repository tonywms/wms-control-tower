"use client";

import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Gauge,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Target,
  Timer,
  TrendingUp,
  Wrench,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import DashboardExecutivo from "@/components/dashboard/DashboardExecutivo";

type Acao = { id:string; projeto_id:string; titulo:string; status:string; prazo:string|null; projeto?:{nome:string}|null };
type Alerta = { id:string; projeto_id:string; projeto_nome:string; tipo:string; severidade:"Crítico"|"Atenção"; titulo:string; prazo:string|null };
type Consistencia = { total:number; criticos:number; atencao:number; projetosAfetados:number; projetosAnalisados:number };
type HistoricoResumo = { total:number; criticos:number; atencao:number; projetos:number };
type Saneamento = { id:string; projeto_id:string; projeto_nome:string; categoria:string; severidade:string; titulo:string; operacao:string; campo_alterado:string; valor_anterior:string|null; valor_novo:string|null; usuario_nome:string; saneado_em:string };
type Props = { onOpenProjeto:(id:string)=>void|Promise<void>; onOpenInconsistencias?:()=>void };

const fechadas = new Set(["Concluída", "Cancelada"]);
function dias(v:string|null){ if(!v)return null; const[a,m,d]=v.split("-").map(Number),x=new Date(a,m-1,d),n=new Date(),h=new Date(n.getFullYear(),n.getMonth(),n.getDate()); return Math.round((x.getTime()-h.getTime())/86400000); }
function br(v:string|null){ if(!v)return "Sem prazo"; const[a,m,d]=v.split("-"); return `${d}/${m}/${a}`; }
function clamp(v:number){ return Math.max(0,Math.min(100,Math.round(v))); }

export default function OverviewExecutivo2({onOpenProjeto,onOpenInconsistencias}:Props){
  const [acoes,setAcoes]=useState<Acao[]>([]);
  const [alertas,setAlertas]=useState<Alerta[]>([]);
  const [resumo,setResumo]=useState({total:0,criticos:0,atencao:0});
  const [consistencia,setConsistencia]=useState<Consistencia>({total:0,criticos:0,atencao:0,projetosAfetados:0,projetosAnalisados:0});
  const [historicoResumo,setHistoricoResumo]=useState<HistoricoResumo>({total:0,criticos:0,atencao:0,projetos:0});
  const [saneamentos,setSaneamentos]=useState<Saneamento[]>([]);
  const [loading,setLoading]=useState(false);
  const [erro,setErro]=useState("");

  const carregar=useCallback(async()=>{
    try{
      setLoading(true); setErro("");
      const [a,r,c,h]=await Promise.all([
        fetch("/api/agenda/executiva",{cache:"no-store"}),
        fetch("/api/alertas/executivos",{cache:"no-store"}),
        fetch("/api/inconsistencias",{cache:"no-store"}),
        fetch("/api/inconsistencias/historico",{cache:"no-store"}),
      ]);
      const [aj,rj,cj,hj]=await Promise.all([a.json(),r.json(),c.json(),h.json()]);
      if(!a.ok||!aj?.success) throw new Error(aj?.error||"Erro na agenda.");
      if(!r.ok||!rj?.success) throw new Error(rj?.error||"Erro nos alertas.");
      if(!c.ok||!cj?.success) throw new Error(cj?.error||"Erro no índice de consistência.");
      if(!h.ok||!hj?.success) throw new Error(hj?.error||"Erro no histórico de saneamentos.");
      setAcoes(aj.acoes??[]); setAlertas(rj.alertas??[]); setResumo(rj.resumo??{total:0,criticos:0,atencao:0});
      setConsistencia(cj.resumo??{total:0,criticos:0,atencao:0,projetosAfetados:0,projetosAnalisados:0});
      setHistoricoResumo(hj.resumo??{total:0,criticos:0,atencao:0,projetos:0}); setSaneamentos(hj.itens??[]);
    }catch(e){ setErro(e instanceof Error?e.message:"Erro no Overview Executivo 3.0."); }
    finally{ setLoading(false); }
  },[]);
  useEffect(()=>{void carregar()},[carregar]);

  const agenda=useMemo(()=>{const x=acoes.filter(a=>!fechadas.has(a.status));return{
    abertas:x.length,
    vencidas:x.filter(a=>(dias(a.prazo)??0)<0).length,
    hoje:x.filter(a=>dias(a.prazo)===0).length,
    prox7:x.filter(a=>{const d=dias(a.prazo);return d!==null&&d>0&&d<=7}).length,
    prox15:x.filter(a=>{const d=dias(a.prazo);return d!==null&&d>0&&d<=15}).length,
    prox30:x.filter(a=>{const d=dias(a.prazo);return d!==null&&d>0&&d<=30}).length,
    sem:x.filter(a=>!a.prazo).length,
  }},[acoes]);
  const prioridades=useMemo(()=>{const m=new Map<string,Alerta>();alertas.forEach(a=>{const x=m.get(a.projeto_id);if(!x||(x.severidade!=="Crítico"&&a.severidade==="Crítico"))m.set(a.projeto_id,a)});return[...m.values()].sort((a,b)=>a.severidade!==b.severidade?(a.severidade==="Crítico"?-1:1):(a.prazo??"9999").localeCompare(b.prazo??"9999")).slice(0,5)},[alertas]);
  const entregas=useMemo(()=>acoes.filter(a=>!fechadas.has(a.status)&&a.prazo&&(dias(a.prazo)??-1)>=0).sort((a,b)=>(a.prazo??"").localeCompare(b.prazo??"")).slice(0,6),[acoes]);
  const indiceConsistencia=consistencia.projetosAnalisados?clamp(((consistencia.projetosAnalisados-consistencia.projetosAfetados)/consistencia.projetosAnalisados)*100):100;
  const faixaConsistencia=indiceConsistencia>=85?{label:"Excelente",tone:"emerald"}:indiceConsistencia>=70?{label:"Saudável",tone:"sky"}:indiceConsistencia>=50?{label:"Atenção",tone:"amber"}:{label:"Crítico",tone:"red"};
  const eficienciaSaneamento=(consistencia.total+historicoResumo.total)>0?clamp((historicoResumo.total/(consistencia.total+historicoResumo.total))*100):0;
  const saneados7=useMemo(()=>{const limite=Date.now()-7*86400000;return saneamentos.filter(s=>new Date(s.saneado_em).getTime()>=limite).length},[saneamentos]);
  const pressao=clamp((consistencia.criticos*12)+(agenda.vencidas*10)+(agenda.sem*4)+(resumo.criticos*5));
  const faixaPressao=pressao>=70?"Crítica":pressao>=40?"Alta":pressao>=20?"Moderada":"Controlada";

  return <div className="mt-5 space-y-4">
    <section className="relative overflow-hidden rounded-3xl border border-sky-400/15 bg-gradient-to-br from-sky-400/[.07] via-white/[.025] to-violet-500/[.045] p-5 sm:p-6">
      <div className="absolute right-[-90px] top-[-120px] h-[320px] w-[320px] rounded-full bg-sky-400/[.07] blur-[100px]"/>
      <div className="relative flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between"><div><div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.18em] text-sky-300"><Activity size={14}/>Executive cockpit · live</div><h2 className="mt-2 text-2xl font-semibold tracking-[-.04em] text-white">Overview Executivo 3.0</h2><p className="mt-2 text-xs text-slate-500">Governança, saneamento, pressão executiva, riscos e horizonte operacional em uma única leitura.</p></div><button onClick={()=>void carregar()} disabled={loading} className="flex h-10 items-center gap-2 rounded-xl border border-sky-400/15 bg-sky-400/[.07] px-4 text-xs text-sky-200"><RefreshCw size={14} className={loading?"animate-spin":""}/>Atualizar cockpit</button></div>
    </section>
    {erro&&<div className="flex items-center gap-2 rounded-xl border border-red-400/15 bg-red-400/[.05] p-3 text-[10px] text-red-200"><AlertTriangle size={14}/>{erro}</div>}

    <section className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8"><K l="Ações abertas" v={agenda.abertas} t="sky"/><K l="Vencidas" v={agenda.vencidas} t="red"/><K l="Hoje" v={agenda.hoje} t="amber"/><K l="Próx. 7 dias" v={agenda.prox7} t="sky"/><K l="Sem prazo" v={agenda.sem} t="slate"/><K l="Alertas" v={resumo.total} t="sky"/><K l="Críticos" v={resumo.criticos} t="red"/><K l="Atenção" v={resumo.atencao} t="amber"/></section>

    <section className="grid gap-4 xl:grid-cols-3">
      <ExecutiveGauge icon={<CheckCircle2 size={14}/>} eyebrow="QUALIDADE DA CARTEIRA" title="Índice de consistência" value={indiceConsistencia} label={faixaConsistencia.label} tone={faixaConsistencia.tone as Tone} detail={`${consistencia.projetosAnalisados-consistencia.projetosAfetados} de ${consistencia.projetosAnalisados} projetos sem inconsistências`} />
      <ExecutiveGauge icon={<Wrench size={14}/>} eyebrow="COMPLIANCE" title="Eficiência de saneamento" value={eficienciaSaneamento} label={`${historicoResumo.total} resolvida(s)`} tone={eficienciaSaneamento>=70?"emerald":eficienciaSaneamento>=40?"sky":"amber"} detail={`${consistencia.total} ativa(s) · ${saneados7} saneada(s) nos últimos 7 dias`} />
      <ExecutiveGauge icon={<Gauge size={14}/>} eyebrow="PRESSÃO EXECUTIVA" title="Pressão da carteira" value={pressao} label={faixaPressao} tone={pressao>=70?"red":pressao>=40?"amber":pressao>=20?"sky":"emerald"} detail={`${consistencia.criticos} inconsistência(s) crítica(s) · ${agenda.vencidas} ação(ões) vencida(s)`} />
    </section>

    <section className="grid gap-4 xl:grid-cols-[1.15fr_.85fr]"><Box title="Prioridades executivas" eye="GESTÃO POR EXCEÇÃO" icon={<Target size={14}/>}><div className="divide-y divide-white/[.04]">{prioridades.map((a,i)=><button key={a.id} onClick={()=>onOpenProjeto(a.projeto_id)} className="grid w-full grid-cols-[28px_1fr_auto] items-center gap-3 py-3 text-left hover:bg-white/[.018]"><span className="text-[10px] text-slate-700">{String(i+1).padStart(2,"0")}</span><span className="min-w-0"><span className="flex gap-2"><b className="truncate text-[11px] text-slate-200">{a.projeto_nome}</b><span className={a.severidade==="Crítico"?"text-[8px] text-red-300":"text-[8px] text-amber-300"}>{a.tipo}</span></span><span className="mt-1 block truncate text-[9px] text-slate-600">{a.titulo}</span></span><ChevronRight size={13} className="text-sky-400"/></button>)}</div></Box><Box title="Próximas entregas" eye="AGENDA DA CARTEIRA" icon={<Timer size={14}/>}><div className="divide-y divide-white/[.04]">{entregas.map(a=><button key={a.id} onClick={()=>onOpenProjeto(a.projeto_id)} className="grid w-full grid-cols-[72px_1fr_auto] items-center gap-3 py-3 text-left"><span className="text-[10px] font-semibold text-sky-300">{br(a.prazo)}</span><span className="min-w-0"><b className="block truncate text-[10px] text-slate-300">{a.projeto?.nome??"Projeto"}</b><span className="block truncate text-[8px] text-slate-700">{a.titulo}</span></span><ChevronRight size={12}/></button>)}</div></Box></section>

    <section className="grid gap-4 xl:grid-cols-[.9fr_1.1fr]">
      <Box title="Horizonte executivo" eye="7 · 15 · 30 DIAS" icon={<CalendarClock size={14}/>}><div className="grid grid-cols-3 gap-3"><M l="Até 7 dias" v={agenda.prox7} t="red"/><M l="Até 15 dias" v={agenda.prox15} t="amber"/><M l="Até 30 dias" v={agenda.prox30} t="sky"/></div><p className="mt-3 text-[9px] leading-4 text-slate-600">Contagem acumulada de ações abertas com prazo futuro dentro de cada horizonte.</p></Box>
      <Box title="Tendência de governança" eye="SANEAMENTO CONTÍNUO" icon={<TrendingUp size={14}/>}><div className="grid grid-cols-2 gap-3 md:grid-cols-4"><M l="Resolvidas" v={historicoResumo.total} t="sky"/><M l="Críticas resolvidas" v={historicoResumo.criticos} t="red"/><M l="Últimos 7 dias" v={saneados7} t="emerald"/><M l="Projetos saneados" v={historicoResumo.projetos} t="sky"/></div></Box>
    </section>

    <section className="relative overflow-hidden rounded-2xl border border-white/[.06] bg-white/[.025] p-5"><div className="absolute right-[-80px] top-[-100px] h-[260px] w-[260px] rounded-full bg-violet-500/[.06] blur-[90px]"/><div className="relative grid gap-5 xl:grid-cols-[.8fr_1.2fr] xl:items-center"><div><div className="flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[.15em] text-violet-300"><Sparkles size={14}/>Saúde de governança</div><div className="mt-3 flex items-end gap-3"><span className={`text-5xl font-semibold tracking-[-.06em] ${toneText(faixaConsistencia.tone as Tone)}`}>{indiceConsistencia}%</span><span className="mb-1 rounded-full border border-white/[.07] bg-black/20 px-2.5 py-1 text-[9px] font-semibold text-slate-400">{faixaConsistencia.label}</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[.05]"><div className={`h-full rounded-full transition-all ${toneBg(faixaConsistencia.tone as Tone)}`} style={{width:`${indiceConsistencia}%`}}/></div><p className="mt-3 text-[10px] leading-4 text-slate-600">Índice calculado pela proporção de projetos sem inconsistências na auditoria automática.</p></div><div className="grid grid-cols-2 gap-3 md:grid-cols-4"><M l="Auditados" v={consistencia.projetosAnalisados} t="sky"/><M l="Afetados" v={consistencia.projetosAfetados} t="amber"/><M l="Críticas" v={consistencia.criticos} t="red"/><M l="Atenção" v={consistencia.atencao} t="amber"/><button type="button" onClick={onOpenInconsistencias} disabled={!onOpenInconsistencias} className="col-span-2 flex h-11 items-center justify-center gap-2 rounded-xl border border-violet-400/15 bg-violet-400/[.06] text-[10px] font-semibold text-violet-200 transition hover:bg-violet-400/[.11] disabled:cursor-default disabled:opacity-50 md:col-span-4">Ver inconsistências<ArrowRight size={13}/></button></div></div></section>

    <section className="grid gap-4 xl:grid-cols-2"><Box title="Agenda operacional" eye="COMPROMISSOS" icon={<CalendarClock size={14}/>}><div className="grid grid-cols-2 gap-3"><M l="Hoje" v={agenda.hoje} t="amber"/><M l="Próx. 7 dias" v={agenda.prox7} t="sky"/><M l="Vencidas" v={agenda.vencidas} t="red"/><M l="Sem prazo" v={agenda.sem} t="slate"/></div></Box><Box title="Risco executivo" eye="ALERTAS CONSOLIDADOS" icon={<ShieldAlert size={14}/>}><div className="grid grid-cols-3 gap-3"><M l="Total" v={resumo.total} t="sky"/><M l="Críticos" v={resumo.criticos} t="red"/><M l="Atenção" v={resumo.atencao} t="amber"/></div></Box></section>
    <DashboardExecutivo onOpenProjeto={onOpenProjeto}/>
  </div>;
}

type Tone="sky"|"red"|"amber"|"slate"|"emerald";
function toneText(t:Tone){return t==="red"?"text-red-300":t==="amber"?"text-amber-300":t==="sky"?"text-sky-300":t==="emerald"?"text-emerald-300":"text-slate-300"}
function toneBg(t:Tone){return t==="red"?"bg-red-400":t==="amber"?"bg-amber-400":t==="sky"?"bg-sky-400":t==="emerald"?"bg-emerald-400":"bg-slate-400"}
function ExecutiveGauge({icon,eyebrow,title,value,label,tone,detail}:{icon:React.ReactNode;eyebrow:string;title:string;value:number;label:string;tone:Tone;detail:string}){return <div className="relative overflow-hidden rounded-2xl border border-white/[.06] bg-white/[.025] p-5"><div className="flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[.15em] text-sky-400/80">{icon}{eyebrow}</div><div className="mt-2 flex items-end justify-between gap-3"><div><h3 className="text-sm font-semibold text-slate-200">{title}</h3><div className={`mt-2 text-4xl font-semibold tracking-[-.05em] ${toneText(tone)}`}>{value}%</div></div><span className="mb-1 rounded-full border border-white/[.07] bg-black/20 px-2.5 py-1 text-[9px] font-semibold text-slate-400">{label}</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[.05]"><div className={`h-full rounded-full ${toneBg(tone)}`} style={{width:`${value}%`}}/></div><p className="mt-3 text-[9px] leading-4 text-slate-600">{detail}</p></div>}
function Box({title,eye,icon,children}:{title:string;eye:string;icon:React.ReactNode;children:React.ReactNode}){return <div className="rounded-2xl border border-white/[.06] bg-white/[.025] p-5"><div className="mb-4"><div className="flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[.15em] text-sky-400/80">{icon}{eye}</div><h3 className="mt-1.5 text-sm font-semibold text-slate-200">{title}</h3></div>{children}</div>}
function K({l,v,t}:{l:string;v:number;t:Tone}){return <div className="rounded-2xl border border-white/[.06] bg-white/[.025] p-3.5"><div className={`text-2xl font-semibold ${toneText(t)}`}>{v}</div><div className="mt-1 text-[8px] uppercase tracking-[.12em] text-slate-600">{l}</div></div>}
function M({l,v,t}:{l:string;v:number;t:Tone}){return <div className="rounded-xl border border-white/[.05] bg-black/15 p-3.5"><div className={`text-xl font-semibold ${toneText(t)}`}>{v}</div><div className="mt-1 text-[8px] uppercase text-slate-600">{l}</div></div>}
