import { NextRequest, NextResponse } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/permissions";

export async function GET(request: NextRequest) {
  try {
    const permissao = await requirePermission("visualizar");
    if (!permissao.ok) {
      return NextResponse.json(
        { success: false, error: permissao.error },
        { status: permissao.status }
      );
    }

    const supabase = await createClient();
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get("search")?.trim() ?? "";
    const includeInactive = searchParams.get("includeInactive") === "true";

    let query = supabase
      .from("usuarios")
      .select("id, auth_user_id, nome, email, cargo, setor, perfil, ativo, created_at, updated_at")
      .order("nome", { ascending: true });

    if (!includeInactive) {
      query = query.eq("ativo", true);
    }

    if (search) {
      const filtro = `%${search.replace(/[%_]/g, "\\$&")}%`;
      query = query.or(`nome.ilike.${filtro},email.ilike.${filtro},cargo.ilike.${filtro},setor.ilike.${filtro}`);
    }

    const { data: usuarios, error } = await query;

    if (error) {
      console.error("[API /api/usuarios] Erro do banco de dados:", error);
      return NextResponse.json({ success: false, error: "Não foi possível processar os usuários." }, { status: 500 });
    }

    return NextResponse.json({ success: true, total: usuarios?.length ?? 0, usuarios: usuarios ?? [] });
  } catch (error) {
    unstable_rethrow(error);
    console.error("[API /api/usuarios GET] Erro inesperado:", error);
    return NextResponse.json(
      { success: false, error: "Erro ao buscar usuários." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const permissao = await requirePermission("administrar");
    if (!permissao.ok) {
      return NextResponse.json(
        { success: false, error: permissao.error },
        { status: permissao.status }
      );
    }

    const body = await request.json();
    const nome = typeof body.nome === "string" ? body.nome.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim() : null;
    const cargo = typeof body.cargo === "string" ? body.cargo.trim() : null;
    const setor = typeof body.setor === "string" ? body.setor.trim() : null;
    const perfil = typeof body.perfil === "string" ? body.perfil.trim() : "Visualização";
    const ativo = body.ativo === undefined ? true : Boolean(body.ativo);

    if (!nome) {
      return NextResponse.json({ success: false, error: "O nome do usuário é obrigatório." }, { status: 400 });
    }

    const supabase = await createClient();

    const { data: usuario, error } = await supabase
      .from("usuarios")
      .insert({
        nome,
        email,
        cargo,
        setor,
        perfil,
        ativo,
        updated_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    if (error) {
      console.error("[API /api/usuarios] Erro do banco de dados:", error);
      return NextResponse.json({ success: false, error: "Não foi possível processar os usuários." }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Usuário cadastrado com sucesso.", usuario }, { status: 201 });
  } catch (error) {
    unstable_rethrow(error);
    console.error("[API /api/usuarios POST] Erro inesperado:", error);
    return NextResponse.json(
      { success: false, error: "Erro ao cadastrar usuário." },
      { status: 500 },
    );
  }
}
