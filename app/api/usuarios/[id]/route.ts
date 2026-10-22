import { NextRequest, NextResponse } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/permissions";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const permissao = await requirePermission("administrar");
    if (!permissao.ok) {
      return NextResponse.json(
        { success: false, error: permissao.error },
        { status: permissao.status }
      );
    }

    const { id } = await context.params;
    const body = await request.json();

    const supabase = await createClient();

    const { data: usuarioAtual, error: buscaError } = await supabase
      .from("usuarios")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (buscaError || !usuarioAtual) {
      return NextResponse.json({ success: false, error: "Usuário não encontrado." }, { status: 404 });
    }

    const updateData = {
      nome: typeof body.nome === "string" ? body.nome.trim() : usuarioAtual.nome,
      email: body.email !== undefined ? (typeof body.email === "string" ? body.email.trim() : null) : usuarioAtual.email,
      cargo: body.cargo !== undefined ? (typeof body.cargo === "string" ? body.cargo.trim() : null) : usuarioAtual.cargo,
      setor: body.setor !== undefined ? (typeof body.setor === "string" ? body.setor.trim() : null) : usuarioAtual.setor,
      perfil: typeof body.perfil === "string" ? body.perfil.trim() : usuarioAtual.perfil,
      ativo: body.ativo === undefined ? usuarioAtual.ativo : Boolean(body.ativo),
      updated_at: new Date().toISOString(),
    };

    const { data: usuario, error } = await supabase
      .from("usuarios")
      .update(updateData)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      console.error("[API /api/usuarios/[id] PUT] Erro do banco de dados:", error);
      return NextResponse.json({ success: false, error: "Não foi possível atualizar o usuário." }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Usuário atualizado com sucesso.", usuario });
  } catch (error) {
    unstable_rethrow(error);
    console.error("[API /api/usuarios/[id] PUT] Erro inesperado:", error);
    return NextResponse.json(
      { success: false, error: "Erro ao atualizar usuário." },
      { status: 500 },
    );
  }
}
