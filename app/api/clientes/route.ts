import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/permissions";

type ClientePayload = {
  nome?: unknown;
  cidade?: unknown;
  observacoes?: unknown;
  ativo?: unknown;
};

function normalizarTexto(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const texto = value.trim();

  return texto.length > 0 ? texto : null;
}

export async function GET(request: NextRequest) {
  try {
    const permissao = await requirePermission("visualizar");

    if (!permissao.ok) {
      return NextResponse.json(
        {
          success: false,
          error: permissao.error,
        },
        {
          status: permissao.status,
        },
      );
    }

    const supabase = await createClient();

    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get("search")?.trim() ?? "";
    const includeInactive =
      searchParams.get("includeInactive") === "true";

    let query = supabase
      .from("clientes")
      .select(
        `
        id,
        nome,
        cidade,
        ativo,
        observacoes,
        created_at,
        updated_at
        `,
      )
      .order("nome", {
        ascending: true,
      });

    if (!includeInactive) {
      query = query.eq("ativo", true);
    }

    if (search) {
      const filtro = `%${search.replace(/[%_]/g, "\\$&")}%`;

      query = query.or(
        `nome.ilike.${filtro},cidade.ilike.${filtro}`,
      );
    }

    const { data: clientes, error } = await query;

    if (error) {
      console.error(
        "[GET /api/clientes] Erro ao buscar clientes:",
        error,
      );

      return NextResponse.json(
        {
          success: false,
          error: error.message,
        },
        {
          status: 500,
        },
      );
    }

    const clienteIds = (clientes ?? []).map(
      (cliente) => cliente.id,
    );

    const projetosPorCliente = new Map<string, number>();

    if (clienteIds.length > 0) {
      const { data: projetos, error: projetosError } =
        await supabase
          .from("projetos")
          .select("cliente_id")
          .in("cliente_id", clienteIds);

      if (projetosError) {
        console.error(
          "[GET /api/clientes] Erro ao contar projetos:",
          projetosError,
        );

        return NextResponse.json(
          {
            success: false,
            error: projetosError.message,
          },
          {
            status: 500,
          },
        );
      }

      for (const projeto of projetos ?? []) {
        const atual =
          projetosPorCliente.get(projeto.cliente_id) ?? 0;

        projetosPorCliente.set(
          projeto.cliente_id,
          atual + 1,
        );
      }
    }

    const resultado = (clientes ?? []).map((cliente) => ({
      ...cliente,
      quantidade_projetos:
        projetosPorCliente.get(cliente.id) ?? 0,
    }));

    return NextResponse.json(
      {
        success: true,
        total: resultado.length,
        clientes: resultado,
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    console.error(
      "[GET /api/clientes] Erro inesperado:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Erro inesperado ao buscar clientes.",
      },
      {
        status: 500,
      },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const permissao = await requirePermission("editar");

    if (!permissao.ok) {
      return NextResponse.json(
        {
          success: false,
          error: permissao.error,
        },
        {
          status: permissao.status,
        },
      );
    }

    const body =
      (await request.json()) as ClientePayload;

    const nome = normalizarTexto(body.nome);
    const cidade = normalizarTexto(body.cidade);
    const observacoes = normalizarTexto(
      body.observacoes,
    );

    if (!nome) {
      return NextResponse.json(
        {
          success: false,
          error: "O nome do cliente é obrigatório.",
        },
        {
          status: 400,
        },
      );
    }

    if (nome.length > 150) {
      return NextResponse.json(
        {
          success: false,
          error:
            "O nome do cliente deve ter no máximo 150 caracteres.",
        },
        {
          status: 400,
        },
      );
    }

    const supabase = await createClient();

    const { data: clienteExistente, error: buscaError } =
      await supabase
        .from("clientes")
        .select("id, nome, ativo")
        .ilike("nome", nome)
        .maybeSingle();

    if (buscaError) {
      console.error(
        "[POST /api/clientes] Erro ao validar cliente:",
        buscaError,
      );

      return NextResponse.json(
        {
          success: false,
          error: buscaError.message,
        },
        {
          status: 500,
        },
      );
    }

    if (clienteExistente) {
      return NextResponse.json(
        {
          success: false,
          error: clienteExistente.ativo
            ? "Já existe um cliente com esse nome."
            : "Já existe um cliente inativo com esse nome. Reative o cadastro existente.",
        },
        {
          status: 409,
        },
      );
    }

    const { data: cliente, error } = await supabase
      .from("clientes")
      .insert({
        nome,
        cidade,
        observacoes,
        ativo: true,
        updated_at: new Date().toISOString(),
      })
      .select(
        `
        id,
        nome,
        cidade,
        ativo,
        observacoes,
        created_at,
        updated_at
        `,
      )
      .single();

    if (error) {
      console.error(
        "[POST /api/clientes] Erro ao criar cliente:",
        error,
      );

      return NextResponse.json(
        {
          success: false,
          error: error.message,
        },
        {
          status: 500,
        },
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Cliente criado com sucesso.",
        cliente: {
          ...cliente,
          quantidade_projetos: 0,
        },
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    console.error(
      "[POST /api/clientes] Erro inesperado:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Erro inesperado ao criar cliente.",
      },
      {
        status: 500,
      },
    );
  }
}