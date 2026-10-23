import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePermission } from "@/lib/auth/permissions";
import { dispararSincronizacaoNotificacoes } from "@/lib/notificacoes/sincronizar";

const PRIORIDADES = ["Baixa", "Normal", "Alta", "Crítica"] as const;

const STATUS = [
  "Pendente",
  "Em andamento",
  "Concluída",
  "Cancelada",
] as const;

type Ctx = {
  params: Promise<{
    id: string;
  }>;
};

const txt = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

const nullable = (value: unknown) => txt(value) || null;

async function getSupabase() {
  if (process.env.NODE_ENV !== "production") {
    return createAdminClient();
  }

  return await createClient();
}

/* =========================================================
   GET
   Lista as ações do projeto
========================================================= */

export async function GET(
  _req: NextRequest,
  { params }: Ctx,
) {
  try {
    const permission = await requirePermission("visualizar");

    if (!permission.ok) {
      return NextResponse.json(
        {
          success: false,
          error: permission.error,
        },
        {
          status: permission.status,
        },
      );
    }

    const { id } = await params;
    const supabase = await getSupabase();

    const { data, error } = await supabase
      .from("projeto_acoes")
      .select(`
        id,
        projeto_id,
        titulo,
        descricao,
        prioridade,
        status,
        responsavel_id,
        prazo,
        concluida_em,
        ordem,
        criado_por,
        created_at,
        updated_at,
        responsavel:usuarios!projeto_acoes_responsavel_id_fkey(
          id,
          nome
        ),
        criador:usuarios!projeto_acoes_criado_por_fkey(
          id,
          nome
        )
      `)
      .eq("projeto_id", id)
      .order("ordem", {
        ascending: true,
      })
      .order("prazo", {
        ascending: true,
        nullsFirst: false,
      })
      .order("created_at", {
        ascending: true,
      });

    if (error) {
      console.error("[GET projeto_acoes]", error);

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
      acoes: data ?? [],
    });
  } catch (error) {
    console.error("[GET projeto_acoes]", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Erro ao carregar ações.",
      },
      {
        status: 500,
      },
    );
  }
}

/* =========================================================
   POST
   Cria uma nova ação
========================================================= */

export async function POST(
  req: NextRequest,
  { params }: Ctx,
) {
  try {
    const permission = await requirePermission("editar");

    if (!permission.ok) {
      return NextResponse.json(
        {
          success: false,
          error: permission.error,
        },
        {
          status: permission.status,
        },
      );
    }

    const { id } = await params;
    const body = await req.json();

    const titulo = txt(body.titulo);
    const descricao = nullable(body.descricao);
    const prioridade = txt(body.prioridade) || "Normal";
    const status = txt(body.status) || "Pendente";
    const responsavelId = nullable(body.responsavel_id);
    const prazo = nullable(body.prazo);

    /* =====================================================
       VALIDAÇÕES
    ===================================================== */

    if (!titulo) {
      return NextResponse.json(
        {
          success: false,
          error: "Informe o título da ação.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      !PRIORIDADES.includes(
        prioridade as (typeof PRIORIDADES)[number],
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Prioridade inválida.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      !STATUS.includes(
        status as (typeof STATUS)[number],
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Status inválido.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      prazo &&
      !/^\d{4}-\d{2}-\d{2}$/.test(prazo)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Prazo inválido.",
        },
        {
          status: 400,
        },
      );
    }

    const ordem =
      body.ordem === undefined ||
      body.ordem === null ||
      body.ordem === ""
        ? 0
        : Number(body.ordem);

    if (!Number.isInteger(ordem)) {
      return NextResponse.json(
        {
          success: false,
          error: "Ordem inválida.",
        },
        {
          status: 400,
        },
      );
    }

    /* =====================================================
       BANCO
    ===================================================== */

    const supabase = await getSupabase();

    const { data, error } = await supabase
      .from("projeto_acoes")
      .insert({
        projeto_id: id,
        titulo,
        descricao,
        prioridade,
        status,
        responsavel_id: responsavelId,
        prazo,
        concluida_em:
          status === "Concluída"
            ? new Date().toISOString()
            : null,
        ordem,
        criado_por: permission.usuario.usuarioId,
      })
      .select(`
        id,
        projeto_id,
        titulo,
        descricao,
        prioridade,
        status,
        responsavel_id,
        prazo,
        concluida_em,
        ordem,
        criado_por,
        created_at,
        updated_at,
        responsavel:usuarios!projeto_acoes_responsavel_id_fkey(
          id,
          nome
        ),
        criador:usuarios!projeto_acoes_criado_por_fkey(
          id,
          nome
        )
      `)
      .single();

    if (error) {
      console.error("[POST projeto_acoes]", error);

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

    /* =====================================================
       NOTIFICAÇÕES POR EVENTO

       Sincroniza somente para o usuário que executou
       a criação da ação.
    ===================================================== */

    await dispararSincronizacaoNotificacoes(
      supabase,
      "acao_criada",
      permission.usuario.usuarioId,
    );

    return NextResponse.json(
      {
        success: true,
        acao: data,
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    console.error("[POST projeto_acoes]", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Erro ao criar ação.",
      },
      {
        status: 500,
      },
    );
  }
}