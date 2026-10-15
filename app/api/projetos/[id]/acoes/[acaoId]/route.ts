import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/permissions";

const PRIORIDADES = ["Baixa","Normal","Alta","Crítica"] as const;
const STATUS = ["Pendente","Em andamento","Concluída","Cancelada"] as const;
type Ctx = { params: Promise<{ id:string; acaoId:string }> };
const txt=(v:unknown)=>typeof v==="string"?v.trim():"";
const nullable=(v:unknown)=>txt(v)||null;

export async function PUT(req:NextRequest,{params}:Ctx){
  try{
    const p=await requirePermission("editar");
    if(!p.ok)return NextResponse.json({success:false,error:p.error},{status:p.status});
    const {id,acaoId}=await params;
    const supabase=await createClient();
    const {data:atual,error:findError}=await supabase.from("projeto_acoes").select("*").eq("id",acaoId).eq("projeto_id",id).maybeSingle();
    if(findError)return NextResponse.json({success:false,error:findError.message},{status:500});
    if(!atual)return NextResponse.json({success:false,error:"Ação não encontrada."},{status:404});
    const body=await req.json();
    const titulo=body.titulo!==undefined?txt(body.titulo):atual.titulo;
    const prioridade=body.prioridade!==undefined?txt(body.prioridade):atual.prioridade;
    const status=body.status!==undefined?txt(body.status):atual.status;
    if(!titulo)return NextResponse.json({success:false,error:"Informe o título da ação."},{status:400});
    if(!PRIORIDADES.includes(prioridade as typeof PRIORIDADES[number]))return NextResponse.json({success:false,error:"Prioridade inválida."},{status:400});
    if(!STATUS.includes(status as typeof STATUS[number]))return NextResponse.json({success:false,error:"Status inválido."},{status:400});
    let prazo=atual.prazo;
    if(body.prazo!==undefined){
      prazo=nullable(body.prazo);
      if(prazo&&!/^\d{4}-\d{2}-\d{2}$/.test(prazo))return NextResponse.json({success:false,error:"Prazo inválido."},{status:400});
    }
    let concluida_em=atual.concluida_em;
    if(status==="Concluída"&&!concluida_em)concluida_em=new Date().toISOString();
    if(status!=="Concluída")concluida_em=null;
    const {data,error}=await supabase.from("projeto_acoes").update({
      titulo,descricao:body.descricao!==undefined?nullable(body.descricao):atual.descricao,
      prioridade,status,responsavel_id:body.responsavel_id!==undefined?nullable(body.responsavel_id):atual.responsavel_id,
      prazo,concluida_em,
      ordem:body.ordem!==undefined&&Number.isInteger(Number(body.ordem))?Number(body.ordem):atual.ordem,
      updated_at:new Date().toISOString()
    }).eq("id",acaoId).eq("projeto_id",id).select("*").single();
    if(error)return NextResponse.json({success:false,error:error.message},{status:500});
    return NextResponse.json({success:true,acao:data});
  }catch(e){return NextResponse.json({success:false,error:e instanceof Error?e.message:"Erro ao atualizar ação."},{status:500});}
}

export async function DELETE(_req:NextRequest,{params}:Ctx){
  try{
    const p=await requirePermission("editar");
    if(!p.ok)return NextResponse.json({success:false,error:p.error},{status:p.status});
    const {id,acaoId}=await params;
    const supabase=await createClient();
    const {data,error}=await supabase.from("projeto_acoes").delete().eq("id",acaoId).eq("projeto_id",id).select("id").maybeSingle();
    if(error)return NextResponse.json({success:false,error:error.message},{status:500});
    if(!data)return NextResponse.json({success:false,error:"Ação não encontrada."},{status:404});
    return NextResponse.json({success:true});
  }catch(e){return NextResponse.json({success:false,error:e instanceof Error?e.message:"Erro ao excluir ação."},{status:500});}
}
