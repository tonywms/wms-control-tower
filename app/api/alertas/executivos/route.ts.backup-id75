import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePermission } from "@/lib/auth/permissions";

type Severidade = "Crítico" | "Atenção";
type Alerta = { id:string; projeto_id:string; projeto_nome:string; tipo:string; severidade:Severidade; titulo:string; descricao:string; prazo:string|null; responsavel_nome:string|null; prioridade:string|null };

async function db(){ return process.env.NODE_ENV !== "production" ? createAdminClient() : await createClient(); }
function aberto(s:string){ return !["Concluída","Concluído","Cancelada","Cancelado"].includes(s); }
function dias(data:string|null){ if(!data)return null; const [a,m,d]=data.split("-").map(Number); const x=new Date(a,m-1,d); const n=new Date(); const h=new Date(n.getFullYear(),n.getMonth(),n.getDate()); return Math.round((x.getTime()-h.getTime())/86400000); }

export async function GET(){
  try{
    const perm=await requirePermission("visualizar");
    if(!perm.ok) return NextResponse.json({success:false,error:perm.error},{status:perm.status});
    const supabase=await db();
    const [pr,ar,pe,mr]=await Promise.all([
      supabase.from("projetos").select(`id,nome,status,prioridade,data_fim,responsavel_id,responsavel:usuarios!projetos_responsavel_id_fkey(id,nome)`),
      supabase.from("projeto_acoes").select(`id,projeto_id,titulo,prioridade,status,responsavel_id,prazo,responsavel:usuarios!projeto_acoes_responsavel_id_fkey(id,nome)`),
      supabase.from("projeto_pendencias").select(`id,projeto_id,titulo,tipo,prioridade,status,responsavel_id,prazo,responsavel:usuarios!projeto_pendencias_responsavel_id_fkey(id,nome)`),
      supabase.from("projeto_marcos").select(`id,projeto_id,nome,status,data_prevista`),
    ]);
    const erro=pr.error||ar.error||pe.error||mr.error;
    if(erro) return NextResponse.json({success:false,error:erro.message},{status:500});
    const projetos:any[]=pr.data??[], acoes:any[]=ar.data??[], pendencias:any[]=pe.data??[], marcos:any[]=mr.data??[];
    const map=new Map(projetos.map(p=>[p.id,p])); const alertas:Alerta[]=[];
    const add=(x:Alerta)=>alertas.push(x);

    for(const a of acoes){
      if(!aberto(a.status))continue; const p:any=map.get(a.projeto_id); if(!p)continue; const d=dias(a.prazo); const resp=a.responsavel?.nome??null;
      if(d!==null&&d<0) add({id:`av-${a.id}`,projeto_id:p.id,projeto_nome:p.nome,tipo:"Ação vencida",severidade:"Crítico",titulo:a.titulo,descricao:`Vencida há ${Math.abs(d)} dia(s).`,prazo:a.prazo,responsavel_nome:resp,prioridade:a.prioridade});
      else if(a.prioridade==="Crítica") add({id:`ac-${a.id}`,projeto_id:p.id,projeto_nome:p.nome,tipo:"Ação crítica",severidade:"Crítico",titulo:a.titulo,descricao:d===null?"Ação crítica sem prazo.":d===0?"Ação crítica vence hoje.":`Ação crítica vence em ${d} dia(s).`,prazo:a.prazo,responsavel_nome:resp,prioridade:a.prioridade});
      else if(d!==null&&d>=0&&d<=3) add({id:`ap-${a.id}`,projeto_id:p.id,projeto_nome:p.nome,tipo:"Prazo próximo",severidade:"Atenção",titulo:a.titulo,descricao:d===0?"Vence hoje.":`Vence em ${d} dia(s).`,prazo:a.prazo,responsavel_nome:resp,prioridade:a.prioridade});
      if(!a.prazo) add({id:`asp-${a.id}`,projeto_id:p.id,projeto_nome:p.nome,tipo:"Sem prazo",severidade:"Atenção",titulo:a.titulo,descricao:"Ação aberta sem prazo definido.",prazo:null,responsavel_nome:resp,prioridade:a.prioridade});
      if(!a.responsavel_id) add({id:`asr-${a.id}`,projeto_id:p.id,projeto_nome:p.nome,tipo:"Sem responsável",severidade:"Atenção",titulo:a.titulo,descricao:"Ação aberta sem responsável definido.",prazo:a.prazo,responsavel_nome:null,prioridade:a.prioridade});
    }
    for(const x of pendencias){
      if(!aberto(x.status)||x.tipo!=="Impedimento")continue; const p:any=map.get(x.projeto_id); if(!p)continue; const d=dias(x.prazo);
      if(x.prioridade==="Crítica"||(d!==null&&d<0)) add({id:`imp-${x.id}`,projeto_id:p.id,projeto_nome:p.nome,tipo:"Impedimento crítico",severidade:"Crítico",titulo:x.titulo,descricao:d!==null&&d<0?`Vencido há ${Math.abs(d)} dia(s).`:"Impedimento crítico aberto.",prazo:x.prazo,responsavel_nome:x.responsavel?.nome??null,prioridade:x.prioridade});
    }
    for(const m of marcos){
      if(!aberto(m.status))continue; const p:any=map.get(m.projeto_id); if(!p)continue; const d=dias(m.data_prevista);
      if(d!==null&&d<0) add({id:`mv-${m.id}`,projeto_id:p.id,projeto_nome:p.nome,tipo:"Marco vencido",severidade:"Crítico",titulo:m.nome,descricao:`Marco vencido há ${Math.abs(d)} dia(s).`,prazo:m.data_prevista,responsavel_nome:p.responsavel?.nome??null,prioridade:p.prioridade});
    }
    for(const p of projetos){
      const aa=acoes.filter(a=>a.projeto_id===p.id&&aberto(a.status)); const d=dias(p.data_fim);
      if(p.status==="Finalizado"&&aa.length) add({id:`fa-${p.id}`,projeto_id:p.id,projeto_nome:p.nome,tipo:"Inconsistência",severidade:"Crítico",titulo:"Projeto finalizado com ações abertas",descricao:`${aa.length} ação(ões) ainda abertas.`,prazo:p.data_fim,responsavel_nome:p.responsavel?.nome??null,prioridade:p.prioridade});
      if(["Pausado","Bloqueado"].includes(p.status)&&aa.length) add({id:`pa-${p.id}`,projeto_id:p.id,projeto_nome:p.nome,tipo:p.status,severidade:p.status==="Bloqueado"?"Crítico":"Atenção",titulo:`${p.status} com ações abertas`,descricao:`${aa.length} ação(ões) exigem acompanhamento.`,prazo:p.data_fim,responsavel_nome:p.responsavel?.nome??null,prioridade:p.prioridade});
      if(!["Finalizado","Cancelado"].includes(p.status)&&d!==null&&d<0) add({id:`pv-${p.id}`,projeto_id:p.id,projeto_nome:p.nome,tipo:"Projeto atrasado",severidade:"Crítico",titulo:"Prazo do projeto vencido",descricao:`Vencido há ${Math.abs(d)} dia(s).`,prazo:p.data_fim,responsavel_nome:p.responsavel?.nome??null,prioridade:p.prioridade});
    }
    alertas.sort((a,b)=>(a.severidade==="Crítico"?0:1)-(b.severidade==="Crítico"?0:1)||(a.prazo??"9999").localeCompare(b.prazo??"9999"));
    const criticos=alertas.filter(a=>a.severidade==="Crítico").length;
    return NextResponse.json({success:true,atualizado_em:new Date().toISOString(),resumo:{total:alertas.length,criticos,atencao:alertas.length-criticos},alertas});
  }catch(error){ return NextResponse.json({success:false,error:error instanceof Error?error.message:"Erro ao carregar alertas."},{status:500}); }
}
