import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePermission } from "@/lib/auth/permissions";

async function getSupabase() {
  if (process.env.NODE_ENV !== "production") return createAdminClient();
  return await createClient();
}

export async function GET() {
  try {
    const permission = await requirePermission("visualizar");
    if (!permission.ok) {
      return NextResponse.json({ success: false, error: permission.error }, { status: permission.status });
    }

    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from("projeto_acoes")
      .select(`
        id, projeto_id, titulo, descricao, prioridade, status,
        responsavel_id, prazo, concluida_em, ordem, created_at, updated_at,
        responsavel:usuarios!projeto_acoes_responsavel_id_fkey(id,nome),
        projeto:projetos!projeto_acoes_projeto_id_fkey(id,nome,setor,status,prioridade)
      `)
      .order("prazo", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[GET agenda executiva]", error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, atualizado_em: new Date().toISOString(), acoes: data ?? [] });
  } catch (error) {
    console.error("[GET agenda executiva]", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Erro ao carregar Agenda Executiva.",
    }, { status: 500 });
  }
}
