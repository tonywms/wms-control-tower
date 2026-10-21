import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const ENCERRADO_PROJETO = new Set(["Finalizado", "Cancelado"]);
const ENCERRADO_ITEM = new Set(["Concluída", "Concluído", "Cancelada", "Cancelado"]);

async function getSupabase() {
  if (process.env.NODE_ENV !== "production") return createAdminClient();
  return await createClient();
}

function vencido(data: string | null) {
  return !!data && new Date(`${data}T23:59:59`).getTime() < Date.now();
}

export async function GET() {
  try {
    const permissao = await requirePermission("visualizar");
    if (!permissao.ok) {
      return NextResponse.json({ success: false, error: permissao.error }, { status: permissao.status });
    }

    const supabase = await getSupabase();
    const [projetosRes, acoesRes, pendenciasRes] = await Promise.all([
      supabase.from("projetos").select(`id,nome,status,prioridade,data_fim,responsavel_id,responsavel:usuarios!projetos_responsavel_id_fkey(id,nome)`).order("nome"),
      supabase.from("projeto_acoes").select("id,projeto_id,titulo,status,prioridade,prazo,responsavel_id"),
      supabase.from("projeto_pendencias").select("id,projeto_id,titulo,tipo,status,prioridade,prazo"),
    ]);

    const erro = projetosRes.error || acoesRes.error || pendenciasRes.error;
    if (erro) return NextResponse.json({ success: false, error: erro.message }, { status: 500 });

    const projetos: any[] = projetosRes.data ?? [];
    const acoes: any[] = acoesRes.data ?? [];
    const pendencias: any[] = pendenciasRes.data ?? [];
    const projetoPorId = new Map(projetos.map((p) => [p.id, p]));
    const inconsistencias: any[] = [];

    const add = (x: any) => inconsistencias.push(x);
    const base = (p: any) => ({ projeto_id: p.id, projeto_nome: p.nome, responsavel_nome: p.responsavel?.nome ?? null });

    for (const p of projetos) {
      const ativo = !ENCERRADO_PROJETO.has(p.status);
      if (ativo && !p.responsavel_id) add({ id:`projeto-sem-owner:${p.id}`, ...base(p), item_tipo:"projeto", referencia_id:p.id, categoria:"Responsabilidade", severidade:"Atenção", titulo:"Projeto ativo sem responsável", descricao:"O projeto está ativo, mas não possui owner definido.", recomendacao:"Definir um responsável pelo projeto.", prazo:p.data_fim });
      if (ativo && !p.data_fim) add({ id:`projeto-sem-prazo:${p.id}`, ...base(p), item_tipo:"projeto", referencia_id:p.id, categoria:"Prazo", severidade:"Atenção", titulo:"Projeto ativo sem prazo", descricao:"O projeto não possui data final definida.", recomendacao:"Definir uma previsão executiva de entrega.", prazo:null });
      if (ativo && vencido(p.data_fim)) add({ id:`projeto-vencido:${p.id}`, ...base(p), item_tipo:"projeto", referencia_id:p.id, categoria:"Prazo", severidade:"Crítico", titulo:"Projeto ativo com prazo vencido", descricao:`Prazo vencido em ${p.data_fim}.`, recomendacao:"Reprogramar o prazo ou concluir formalmente o projeto.", prazo:p.data_fim });
    }

    for (const a of acoes) {
      const p: any = projetoPorId.get(a.projeto_id); if (!p || ENCERRADO_ITEM.has(a.status)) continue;
      if (p.status === "Finalizado") add({ id:`finalizado-acao:${a.id}`, ...base(p), item_tipo:"acao", referencia_id:a.id, categoria:"Status × Execução", severidade:"Crítico", titulo:"Projeto finalizado com ação aberta", descricao:`Ação \"${a.titulo}\" permanece ${a.status}.`, recomendacao:"Concluir/cancelar a ação ou reabrir o projeto.", prazo:a.prazo });
      if (p.status === "Pausado") add({ id:`pausado-acao:${a.id}`, ...base(p), item_tipo:"acao", referencia_id:a.id, categoria:"Status × Execução", severidade:"Atenção", titulo:"Projeto pausado com ação pendente", descricao:`Ação \"${a.titulo}\" continua aberta.`, recomendacao:"Validar se a ação deve permanecer ativa durante a pausa.", prazo:a.prazo });
      if (!a.responsavel_id) add({ id:`acao-sem-owner:${a.id}`, ...base(p), item_tipo:"acao", referencia_id:a.id, categoria:"Responsabilidade", severidade:a.prioridade === "Crítica" ? "Crítico" : "Atenção", titulo:"Ação aberta sem responsável", descricao:`Ação \"${a.titulo}\" não possui owner.`, recomendacao:"Definir o responsável pela execução.", prazo:a.prazo });
      if (!a.prazo) add({ id:`acao-sem-prazo:${a.id}`, ...base(p), item_tipo:"acao", referencia_id:a.id, categoria:"Prazo", severidade:a.prioridade === "Crítica" ? "Crítico" : "Atenção", titulo:"Ação aberta sem prazo", descricao:`Ação \"${a.titulo}\" não possui data limite.`, recomendacao:"Definir uma data de compromisso.", prazo:null });
      if (vencido(a.prazo)) add({ id:`acao-vencida:${a.id}`, ...base(p), item_tipo:"acao", referencia_id:a.id, categoria:"Prazo", severidade:"Crítico", titulo:"Ação aberta com prazo vencido", descricao:`Ação \"${a.titulo}\" venceu em ${a.prazo}.`, recomendacao:"Concluir a ação ou reprogramar formalmente o prazo.", prazo:a.prazo });
    }

    for (const x of pendencias) {
      const p: any = projetoPorId.get(x.projeto_id); if (!p || ENCERRADO_ITEM.has(x.status)) continue;
      if (p.status === "Finalizado") add({ id:`finalizado-pendencia:${x.id}`, ...base(p), item_tipo:"pendencia", referencia_id:x.id, categoria:"Status × Execução", severidade:"Crítico", titulo:`Projeto finalizado com ${String(x.tipo).toLowerCase()} aberto`, descricao:`\"${x.titulo}\" permanece ${x.status}.`, recomendacao:"Resolver/cancelar o item ou reavaliar o status do projeto.", prazo:x.prazo });
      if (vencido(x.prazo)) add({ id:`pendencia-vencida:${x.id}`, ...base(p), item_tipo:"pendencia", referencia_id:x.id, categoria:x.tipo, severidade:"Crítico", titulo:`${x.tipo} com prazo vencido`, descricao:`\"${x.titulo}\" venceu em ${x.prazo}.`, recomendacao:"Tratar o item ou reprogramar formalmente o prazo.", prazo:x.prazo });
    }

    inconsistencias.sort((a,b) => (a.severidade === b.severidade ? a.projeto_nome.localeCompare(b.projeto_nome,"pt-BR") : a.severidade === "Crítico" ? -1 : 1));
    const porCategoria = Array.from(inconsistencias.reduce((m:Map<string,number>,x:any)=>m.set(x.categoria,(m.get(x.categoria)??0)+1),new Map())).map(([categoria,total])=>({categoria,total})).sort((a:any,b:any)=>b.total-a.total);

    return NextResponse.json({ success:true, atualizadoEm:new Date().toISOString(), resumo:{ total:inconsistencias.length, criticos:inconsistencias.filter(x=>x.severidade==="Crítico").length, atencao:inconsistencias.filter(x=>x.severidade==="Atenção").length, projetosAfetados:new Set(inconsistencias.map(x=>x.projeto_id)).size, projetosAnalisados:projetos.length }, porCategoria, inconsistencias });
  } catch (error) {
    console.error("[GET /api/inconsistencias]", error);
    return NextResponse.json({ success:false, error:error instanceof Error ? error.message : "Erro interno ao analisar inconsistências." }, { status:500 });
  }
}
