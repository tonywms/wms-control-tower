"use client";
import { useEffect,useState } from "react";
import { AlertTriangle,Loader2,Save,X } from "lucide-react";

export type AcaoProjeto={
 id:string;projeto_id:string;titulo:string;descricao?:string|null;
 prioridade:"Baixa"|"Normal"|"Alta"|"Crítica";
 status:"Pendente"|"Em andamento"|"Concluída"|"Cancelada";
 responsavel_id?:string|null;prazo?:string|null;concluida_em?:string|null;
 ordem:number;criado_por?:string|null;created_at:string;updated_at:string;
 responsavel?:{id:string;nome:string}|null;
};
type Props={projetoId:string;acao:AcaoProjeto|null;open:boolean;responsaveis:{id:string;nome:string}[];proximaOrdem:number;onClose:()=>void;onSaved:()=>void|Promise<void>};

export default function AcaoModal({projetoId,acao,open,responsaveis,proximaOrdem,onClose,onSaved}:Props){
 const [form,setForm]=useState({titulo:"",descricao:"",prioridade:"Normal",status:"Pendente",responsavel_id:"",prazo:"",ordem:"1"});
 const [loading,setLoading]=useState(false);const [erro,setErro]=useState("");
 useEffect(()=>{if(!open)return;setErro("");setForm({titulo:acao?.titulo??"",descricao:acao?.descricao??"",prioridade:acao?.prioridade??"Normal",status:acao?.status??"Pendente",responsavel_id:acao?.responsavel_id??"",prazo:acao?.prazo??"",ordem:String(acao?.ordem??proximaOrdem)});},[open,acao,proximaOrdem]);
 if(!open)return null;
 async function salvar(){
  if(!form.titulo.trim()){setErro("Informe o título da ação.");return;}
  try{setLoading(true);setErro("");
   const url=acao?`/api/projetos/${projetoId}/acoes/${acao.id}`:`/api/projetos/${projetoId}/acoes`;
   const r=await fetch(url,{method:acao?"PUT":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...form,responsavel_id:form.responsavel_id||null,prazo:form.prazo||null,ordem:Number(form.ordem||0)})});
   const j=await r.json();if(!r.ok||!j.success)throw new Error(j.error||"Não foi possível salvar a ação.");
   await onSaved();onClose();
  }catch(e){setErro(e instanceof Error?e.message:"Erro ao salvar ação.");}finally{setLoading(false);}
 }
 const field="w-full rounded-xl border border-white/[0.08] bg-[#0b1426] px-4 py-3 text-sm text-white outline-none focus:border-sky-400/50";
 return <div className="fixed inset-0 z-[125] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
  <div className="w-full max-w-2xl overflow-hidden rounded-[24px] border border-sky-400/20 bg-[#080f1f] shadow-2xl">
   <header className="flex items-center justify-between border-b border-white/[.07] px-6 py-5">
    <div><div className="text-[11px] font-bold uppercase tracking-[.18em] text-sky-400">Control Tower • Projeto 360</div><h2 className="mt-1 text-xl font-bold text-white">{acao?"Editar próxima ação":"Nova próxima ação"}</h2></div>
    <button onClick={onClose} className="rounded-xl border border-white/[.08] p-2 text-slate-400"><X size={18}/></button>
   </header>
   <div className="max-h-[calc(100dvh-190px)] space-y-5 overflow-y-auto p-6">
    {erro&&<div className="flex gap-2 rounded-xl border border-rose-400/20 bg-rose-500/10 p-3 text-sm text-rose-200"><AlertTriangle size={17}/>{erro}</div>}
    <label className="block"><span className="mb-2 block text-xs font-semibold uppercase text-slate-400">Título *</span><input maxLength={200} className={field} value={form.titulo} onChange={e=>setForm({...form,titulo:e.target.value})}/></label>
    <div className="grid gap-4 md:grid-cols-2">
     <label><span className="mb-2 block text-xs font-semibold uppercase text-slate-400">Prioridade</span><select className={field} value={form.prioridade} onChange={e=>setForm({...form,prioridade:e.target.value})}>{["Baixa","Normal","Alta","Crítica"].map(x=><option key={x}>{x}</option>)}</select></label>
     <label><span className="mb-2 block text-xs font-semibold uppercase text-slate-400">Status</span><select className={field} value={form.status} onChange={e=>setForm({...form,status:e.target.value})}>{["Pendente","Em andamento","Concluída","Cancelada"].map(x=><option key={x}>{x}</option>)}</select></label>
     <label><span className="mb-2 block text-xs font-semibold uppercase text-slate-400">Responsável</span><select className={field} value={form.responsavel_id} onChange={e=>setForm({...form,responsavel_id:e.target.value})}><option value="">Não definido</option>{responsaveis.map(r=><option key={r.id} value={r.id}>{r.nome}</option>)}</select></label>
     <label><span className="mb-2 block text-xs font-semibold uppercase text-slate-400">Prazo</span><input type="date" className={field} value={form.prazo} onChange={e=>setForm({...form,prazo:e.target.value})}/></label>
    </div>
    <label className="block"><span className="mb-2 block text-xs font-semibold uppercase text-slate-400">Ordem</span><input type="number" className={field} value={form.ordem} onChange={e=>setForm({...form,ordem:e.target.value})}/></label>
    <label className="block"><span className="mb-2 block text-xs font-semibold uppercase text-slate-400">Descrição</span><textarea rows={4} className={field} value={form.descricao} onChange={e=>setForm({...form,descricao:e.target.value})}/></label>
   </div>
   <footer className="flex justify-end gap-3 border-t border-white/[.07] px-6 py-4"><button onClick={onClose} className="rounded-xl border border-white/[.08] px-4 py-2.5 text-sm text-slate-300">Cancelar</button><button disabled={loading} onClick={()=>void salvar()} className="flex items-center gap-2 rounded-xl bg-sky-400 px-4 py-2.5 text-sm font-bold text-slate-950 disabled:opacity-50">{loading?<Loader2 size={17} className="animate-spin"/>:<Save size={17}/>}Salvar</button></footer>
  </div>
 </div>;
}
