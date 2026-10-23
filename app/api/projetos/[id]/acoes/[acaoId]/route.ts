import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePermission } from "@/lib/auth/permissions";
import { dispararSincronizacaoNotificacoes } from "@/lib/notificacoes/sincronizar";

const PRIORIDADES = [
  "Baixa",
  "Normal",
  "Alta",
  "Crítica",
] as const;

const STATUS = [
  "Pendente",
  "Em andamento",
  "Concluída",
  "Cancelada",
] as const;

type Ctx = {
  params: Promise<{
    id: string;
    acaoId: string;
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
   PUT
   Edita / conclui / reabre uma ação
========================================================= */

export async function PUT(
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

    const { id, acaoId } = await params;
    const body = await req.json();
    const supabase = await getSupabase();

    /* =====================================================
       BUSCA A AÇÃO ATUAL
    ===================================================== */

    const {
      data: atual,
      error: erroAtual,
    } = await supabase
      .from("projeto_acoes")
      .select("*")
      .eq("id", acaoId)
      .eq("projeto_id", id)
      .maybeSingle();

    if (erroAtual) {
      console.error(
        "[PUT projeto_acoes atual]",
        erroAtual,
      );

      return NextResponse.json(
        {
          success: false,
          error: erroAtual.message,
        },
        {
          status: 500,
        },
      );
    }

    if (!atual) {
      return NextResponse.json(
        {
          success: false,
          error: "Ação não encontrada.",
        },
        {
          status: 404,
        },
      );
    }

    /* =====================================================
       ATUALIZAÇÃO PARCIAL
    ===================================================== */

    const titulo =
      body.titulo !== undefined
        ? txt(body.titulo)
        : atual.titulo;

    const descricao =
      body.descricao !== undefined
        ? nullable(body.descricao)
        : atual.descricao;

    const prioridade =
      body.prioridade !== undefined
        ? txt(body.prioridade)
        : atual.prioridade;

    const status =
      body.status !== undefined
        ? txt(body.status)
        : atual.status;

    const responsavelId =
      body.responsavel_id !== undefined
        ? nullable(body.responsavel_id)
        : atual.responsavel_id;

    const prazo =
      body.prazo !== undefined
        ? nullable(body.prazo)
        : atual.prazo;

    const ordem =
      body.ordem !== undefined
        ? Number(body.ordem)
        : atual.ordem;

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
       CONTROLE DA DATA DE CONCLUSÃO
    ===================================================== */

    let concluidaEm = atual.concluida_em;

    if (
      status === "Concluída" &&
      atual.status !== "Concluída"
    ) {
      concluidaEm = new Date().toISOString();
    }

    if (status !== "Concluída") {
      concluidaEm = null;
    }

    /* =====================================================
       UPDATE
    ===================================================== */

    const { data, error } = await supabase
      .from("projeto_acoes")
      .update({
        titulo,
        descricao,
        prioridade,
        status,
        responsavel_id: responsavelId,
        prazo,
        concluida_em: concluidaEm,
        ordem,
        updated_at: new Date().toISOString(),
      })
      .eq("id", acaoId)
      .eq("projeto_id", id)
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
      console.error("[PUT projeto_acoes]", error);

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

       Somente o usuário que executou a alteração.
    ===================================================== */

    await dispararSincronizacaoNotificacoes(
      supabase,
      "acao_atualizada",
      permission.usuario.usuarioId,
    );

    return NextResponse.json({
      success: true,
      acao: data,
    });
  } catch (error) {
    console.error("[PUT projeto_acoes]", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Erro ao atualizar ação.",
      },
      {
        status: 500,
      },
    );
  }
}

/* =========================================================
   DELETE
   Exclui uma ação
========================================================= */

export async function DELETE(
  _req: NextRequest,
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

    const { id, acaoId } = await params;
    const supabase = await getSupabase();

    /* =====================================================
       CONFERE SE A AÇÃO EXISTE E PERTENCE AO PROJETO
    ===================================================== */

    const {
      data: atual,
      error: erroAtual,
    } = await supabase
      .from("projeto_acoes")
      .select("id")
      .eq("id", acaoId)
      .eq("projeto_id", id)
      .maybeSingle();

    if (erroAtual) {
      console.error(
        "[DELETE projeto_acoes atual]",
        erroAtual,
      );

      return NextResponse.json(
        {
          success: false,
          error: erroAtual.message,
        },
        {
          status: 500,
        },
      );
    }

    if (!atual) {
      return NextResponse.json(
        {
          success: false,
          error: "Ação não encontrada.",
        },
        {
          status: 404,
        },
      );
    }

    /* =====================================================
       DELETE
    ===================================================== */

    const { error } = await supabase
      .from("projeto_acoes")
      .delete()
      .eq("id", acaoId)
      .eq("projeto_id", id);

    if (error) {
      console.error("[DELETE projeto_acoes]", error);

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

       Somente o usuário que executou a exclusão.
    ===================================================== */

    await dispararSincronizacaoNotificacoes(
      supabase,
      "acao_excluida",
      permission.usuario.usuarioId,
    );

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("[DELETE projeto_acoes]", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Erro ao excluir ação.",
      },
      {
        status: 500,
      },
    );
  }
}