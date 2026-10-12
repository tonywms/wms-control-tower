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

async function buscarCliente(
  id: string,
) {
  const supabase = await createClient();

  return await supabase
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
    .eq("id", id)
    .maybeSingle();
}

export async function GET(
  _request: NextRequest,
  context: {
    params: Promise<{ id: string }>;
  },
) {
  try {
    const permissao =
      await requirePermission("visualizar");

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

    const { id } = await context.params;

    const supabase = await createClient();

    const { data: cliente, error } = await supabase
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
      .eq("id", id)
      .maybeSingle();

    if (error) {
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

    if (!cliente) {
      return NextResponse.json(
        {
          success: false,
          error: "Cliente não encontrado.",
        },
        {
          status: 404,
        },
      );
    }

    const { count, error: countError } =
      await supabase
        .from("projetos")
        .select("id", {
          count: "exact",
          head: true,
        })
        .eq("cliente_id", id);

    if (countError) {
      return NextResponse.json(
        {
          success: false,
          error: countError.message,
        },
        {
          status: 500,
        },
      );
    }

    return NextResponse.json({
      success: true,
      cliente: {
        ...cliente,
        quantidade_projetos: count ?? 0,
      },
    });
  } catch (error) {
    console.error(
      "[GET /api/clientes/:id]",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Erro inesperado.",
      },
      {
        status: 500,
      },
    );
  }
}

export async function PUT(
  request: NextRequest,
  context: {
    params: Promise<{ id: string }>;
  },
) {
  try {
    const permissao =
      await requirePermission("editar");

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

    const { id } = await context.params;

    const body =
      (await request.json()) as ClientePayload;

    const supabase = await createClient();

    const {
      data: clienteAtual,
      error: buscaError,
    } = await buscarCliente(id);

    if (buscaError) {
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

    if (!clienteAtual) {
      return NextResponse.json(
        {
          success: false,
          error: "Cliente não encontrado.",
        },
        {
          status: 404,
        },
      );
    }

    const nome =
      body.nome === undefined
        ? clienteAtual.nome
        : normalizarTexto(body.nome);

    const cidade =
      body.cidade === undefined
        ? clienteAtual.cidade
        : normalizarTexto(body.cidade);

    const observacoes =
      body.observacoes === undefined
        ? clienteAtual.observacoes
        : normalizarTexto(body.observacoes);

    const ativo =
      body.ativo === undefined
        ? clienteAtual.ativo
        : Boolean(body.ativo);

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

    const { data: duplicado, error: duplicadoError } =
      await supabase
        .from("clientes")
        .select("id, nome, ativo")
        .ilike("nome", nome)
        .neq("id", id)
        .maybeSingle();

    if (duplicadoError) {
      return NextResponse.json(
        {
          success: false,
          error: duplicadoError.message,
        },
        {
          status: 500,
        },
      );
    }

    if (duplicado) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Já existe outro cliente com esse nome.",
        },
        {
          status: 409,
        },
      );
    }

    const { data: cliente, error } = await supabase
      .from("clientes")
      .update({
        nome,
        cidade,
        observacoes,
        ativo,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
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
        "[PUT /api/clientes/:id]",
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

    return NextResponse.json({
      success: true,
      message: "Cliente atualizado com sucesso.",
      cliente,
    });
  } catch (error) {
    console.error(
      "[PUT /api/clientes/:id] Erro inesperado:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Erro inesperado ao atualizar cliente.",
      },
      {
        status: 500,
      },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  context: {
    params: Promise<{ id: string }>;
  },
) {
  try {
    const permissao =
      await requirePermission("excluir");

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

    const { id } = await context.params;

    const supabase = await createClient();

    const {
      data: cliente,
      error: clienteError,
    } = await supabase
      .from("clientes")
      .select("id, nome")
      .eq("id", id)
      .maybeSingle();

    if (clienteError) {
      return NextResponse.json(
        {
          success: false,
          error: clienteError.message,
        },
        {
          status: 500,
        },
      );
    }

    if (!cliente) {
      return NextResponse.json(
        {
          success: false,
          error: "Cliente não encontrado.",
        },
        {
          status: 404,
        },
      );
    }

    const {
      count,
      error: projetosError,
    } = await supabase
      .from("projetos")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("cliente_id", id);

    if (projetosError) {
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

    if ((count ?? 0) > 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            `O cliente "${cliente.nome}" possui ${count} projeto(s) vinculado(s). ` +
            "Inative o cliente em vez de excluí-lo.",
        },
        {
          status: 409,
        },
      );
    }

    const { error: deleteError } =
      await supabase
        .from("clientes")
        .delete()
        .eq("id", id);

    if (deleteError) {
      console.error(
        "[DELETE /api/clientes/:id]",
        deleteError,
      );

      return NextResponse.json(
        {
          success: false,
          error: deleteError.message,
        },
        {
          status: 500,
        },
      );
    }

    return NextResponse.json({
      success: true,
      message: `Cliente "${cliente.nome}" excluído com sucesso.`,
    });
  } catch (error) {
    console.error(
      "[DELETE /api/clientes/:id] Erro inesperado:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Erro inesperado ao excluir cliente.",
      },
      {
        status: 500,
      },
    );
  }
}