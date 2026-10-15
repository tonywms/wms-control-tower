import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/permissions";

const PRIORIDADES = ["Baixa","Normal","Alta","Crítica"] as const;
const STATUS = ["Pendente","Em andamento","Concluída","Cancelada"] as const;
type Ctx = { params: Promise<{ id: string }> };
const txt = (v: unknown) => typeof v === "string" ? v.trim() : "";
const nullable = (v: unknown) => txt(v) || null;

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const p = await requirePermission("visualizar");
    if (!p.ok) return NextResponse.json({success:false,error:p.error},{status:p.status});
    const { id } = await params;
    const supabase = await createClient();
    const { data, error } = await supabase.from("projeto_acoes").select(`
      id,projeto_id,titulo,descricao,prioridade,status,responsavel_id,prazo,
      concluida_em,ordem,criado_por,created_at,updated_at,
      responsavel:usuarios!projeto_acoes_responsavel_id_fkey(id,nome),
      criador:usuarios!projeto_acoes_criado_por_fkey(id,nome)
    `).eq("projeto_id",id)
      .order("ordem",{ascending:true})
      .order("prazo",{ascending:true,nullsFirst:false})
      .order("created_at",{ascending:true});
    if (error) return NextResponse.json({success:false,error:error.message},{status:500});
    return NextResponse.json({success:true,acoes:data??[]});
  } catch(e) {
    return NextResponse.json({success:false,error:e instanceof Error?e.message:"Erro ao carregar ações."},{status:500});
  }
}

export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const p = await requirePermission("editar");
    if (!p.ok) return NextResponse.json({success:false,error:p.error},{status:p.status});
    const { id } = await params;
    const body = await req.json();
    const titulo = txt(body.titulo);
    const prioridade = txt(body.prioridade)||"Normal";
    const status = txt(body.status)||"Pendente";
    if (!titulo) return NextResponse.json({success:false,error:"Informe o título da ação."},{status:400});
    if (!PRIORIDADES.includes(prioridade as typeof PRIORIDADES[number])) return NextResponse.json({success:false,error:"Prioridade inválida."},{status:400});
    if (!STATUS.includes(status as typeof STATUS[number])) return NextResponse.json({success:false,error:"Status inválido."},{status:400});
    const prazo = nullable(body.prazo);
    if (prazo && !/^\d{4}-\d{2}-\d{2}$/.test(prazo)) return NextResponse.json({success:false,error:"Prazo inválido."},{status:400});
    const ordem = Number.isInteger(Number(body.ordem)) ? Number(body.ordem) : 0;
    const supabase = await createClient();
    const { data, error } = await supabase.from("projeto_acoes").insert({
      projeto_id:id,titulo,descricao:nullable(body.descricao),prioridade,status,
      responsavel_id:nullable(body.responsavel_id),prazo,
      concluida_em:status==="Concluída"?new Date().toISOString():null,
      ordem,criado_por:p.usuario.usuarioId
    }).select("*").single();
    if (error) return NextResponse.json({success:false,error:error.message},{status:500});
    return NextResponse.json({success:true,acao:data},{status:201});
  } catch(e) {
    return NextResponse.json({success:false,error:e instanceof Error?e.message:"Erro ao criar ação."},{status:500});
  }
}
