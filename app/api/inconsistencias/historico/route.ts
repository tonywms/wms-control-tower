import { NextResponse } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { requirePermission } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function getSupabase() {
  if (process.env.NODE_ENV !== "production") return createAdminClient();
  return await createClient();
}

export async function GET() {
  try {
    const permissao = await requirePermission("visualizar");

    if (!permissao.ok) {
      return NextResponse.json(
        { success: false, error: permissao.error },
        { status: permissao.status },
      );
    }

    const supabase = await getSupabase();

    const { data, error } = await supabase
      .from("historico_saneamento")
      .select(`
        id,
        projeto_id,
        inconsistencia_id,
        referencia_id,
        item_tipo,
        categoria,
        severidade,
        titulo,
        descricao,
        recomendacao,
        operacao,
        campo_alterado,
        valor_anterior,
        valor_novo,
        usuario_id,
        usuario_nome,
        saneado_em,
        projeto:projetos!historico_saneamento_projeto_id_fkey(id,nome)
      `)
      .order("saneado_em", { ascending: false })
      .limit(500);

    if (error) throw new Error(error.message);

    const itens = (data ?? []).map((item: any) => ({
      ...item,
      projeto_nome: Array.isArray(item.projeto)
        ? item.projeto[0]?.nome ?? "Projeto"
        : item.projeto?.nome ?? "Projeto",
      projeto: undefined,
    }));

    const projetos = new Set(itens.map((item: any) => item.projeto_id));
    const criticos = itens.filter((item: any) => item.severidade === "Crítico").length;

    return NextResponse.json({
      success: true,
      resumo: {
        total: itens.length,
        criticos,
        atencao: itens.length - criticos,
        projetos: projetos.size,
      },
      itens,
    });
  } catch (error) {
      unstable_rethrow(error);
    console.error("[GET /api/inconsistencias/historico]", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Erro ao carregar histórico de saneamentos.",
      },
      { status: 500 },
    );
  }
}
