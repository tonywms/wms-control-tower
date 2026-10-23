import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePermission } from "@/lib/auth/permissions";

const txt = (v: unknown) =>
  typeof v === "string" ? v.trim() : "";

async function ctx() {
  const p = await requirePermission("visualizar");

  if (!p.ok) {
    return {
      ok: false as const,
      response: NextResponse.json(
        {
          success: false,
          error: p.error,
        },
        {
          status: p.status,
        },
      ),
    };
  }

  return {
    ok: true as const,
    usuarioId: p.usuario.usuarioId,
    supabase: createAdminClient(),
  };
}

/**
 * Retorna somente notificações ATIVAS.
 *
 * Notificações resolvidas permanecem armazenadas no banco
 * como histórico, mas não participam:
 *
 * - do sino;
 * - do contador;
 * - da lista operacional atual.
 */
export async function GET() {
  try {
    const c = await ctx();

    if (!c.ok) {
      return c.response;
    }

    const {
      data,
      error,
    } = await c.supabase
      .from("notificacoes")
      .select(
        `
          id,
          usuario_id,
          projeto_id,
          chave,
          tipo,
          titulo,
          mensagem,
          severidade,
          referencia_tipo,
          referencia_id,
          lida,
          lida_em,
          resolvida,
          resolvida_em,
          created_at,
          updated_at,
          projeto:projetos(id,nome)
        `,
      )
      .eq(
        "usuario_id",
        c.usuarioId,
      )
      .eq(
        "resolvida",
        false,
      )
      .order(
        "created_at",
        {
          ascending: false,
        },
      )
      .limit(100);

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

    const notificacoes =
      data ?? [];

    const naoLidas =
      notificacoes.filter(
        notificacao =>
          !notificacao.lida,
      ).length;

    return NextResponse.json({
      success: true,
      nao_lidas: naoLidas,
      notificacoes,
    });
  } catch (e) {
    return NextResponse.json(
      {
        success: false,
        error:
          e instanceof Error
            ? e.message
            : "Erro ao carregar notificações.",
      },
      {
        status: 500,
      },
    );
  }
}

/**
 * Compatibilidade com a sincronização anterior.
 *
 * Novos fluxos por evento utilizam:
 * lib/notificacoes/sincronizar.ts
 */
export async function POST(
  req: NextRequest,
) {
  try {
    const c = await ctx();

    if (!c.ok) {
      return c.response;
    }

    const body =
      await req.json();

    const alertas =
      Array.isArray(body?.alertas)
        ? body.alertas
        : [];

    const agora =
      new Date().toISOString();

    const payload =
      alertas
        .map((a: any) => {
          const chave =
            txt(a.id);

          const tipo =
            txt(a.tipo);

          const titulo =
            txt(a.titulo);

          const descricao =
            txt(a.descricao);

          const severidade =
            txt(a.severidade);

          const projetoId =
            txt(a.projeto_id);

          const projetoNome =
            txt(a.projeto_nome);

          if (
            !chave ||
            !tipo ||
            !titulo ||
            !descricao ||
            ![
              "Crítico",
              "Atenção",
            ].includes(
              severidade,
            )
          ) {
            return null;
          }

          return {
            usuario_id:
              c.usuarioId,

            projeto_id:
              projetoId ||
              null,

            chave,

            tipo,

            titulo:
              projetoNome
                ? `${projetoNome} · ${titulo}`
                : titulo,

            mensagem:
              descricao,

            severidade,

            referencia_tipo:
              "alerta_executivo",

            referencia_id:
              chave,

            /*
             * Se o alerta reapareceu,
             * a notificação volta a ser ativa.
             */
            resolvida:
              false,

            resolvida_em:
              null,

            updated_at:
              agora,
          };
        })
        .filter(Boolean);

    if (payload.length) {
      const {
        error,
      } = await c.supabase
        .from("notificacoes")
        .upsert(
          payload,
          {
            onConflict:
              "usuario_id,chave",

            ignoreDuplicates:
              false,
          },
        );

      if (error) {
        return NextResponse.json(
          {
            success: false,
            error:
              error.message,
          },
          {
            status: 500,
          },
        );
      }
    }

    return NextResponse.json({
      success: true,
      sincronizadas:
        payload.length,
    });
  } catch (e) {
    return NextResponse.json(
      {
        success: false,
        error:
          e instanceof Error
            ? e.message
            : "Erro ao sincronizar notificações.",
      },
      {
        status: 500,
      },
    );
  }
}

/**
 * Controle de leitura.
 *
 * Uma notificação resolvida pertence ao histórico e,
 * portanto, não é alterada pelo fluxo operacional
 * "Ler todas".
 */
export async function PATCH(
  req: NextRequest,
) {
  try {
    const c = await ctx();

    if (!c.ok) {
      return c.response;
    }

    const body =
      await req.json();

    const agora =
      new Date().toISOString();

    /*
     * Marca como lidas somente as notificações
     * ainda ativas.
     */
    if (body?.todas === true) {
      const {
        error,
      } = await c.supabase
        .from("notificacoes")
        .update({
          lida: true,
          lida_em: agora,
          updated_at: agora,
        })
        .eq(
          "usuario_id",
          c.usuarioId,
        )
        .eq(
          "resolvida",
          false,
        )
        .eq(
          "lida",
          false,
        );

      if (error) {
        return NextResponse.json(
          {
            success: false,
            error:
              error.message,
          },
          {
            status: 500,
          },
        );
      }

      return NextResponse.json({
        success: true,
      });
    }

    const id =
      txt(body?.id);

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Informe a notificação.",
        },
        {
          status: 400,
        },
      );
    }

    const lida =
      body?.lida !== false;

    /*
     * O fluxo operacional permite alterar leitura
     * somente de notificações ativas.
     */
    const {
      data,
      error,
    } = await c.supabase
      .from("notificacoes")
      .update({
        lida,
        lida_em:
          lida
            ? agora
            : null,
        updated_at:
          agora,
      })
      .eq(
        "id",
        id,
      )
      .eq(
        "usuario_id",
        c.usuarioId,
      )
      .eq(
        "resolvida",
        false,
      )
      .select(
        "id,lida,lida_em,resolvida",
      )
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        {
          success: false,
          error:
            error.message,
        },
        {
          status: 500,
        },
      );
    }

    if (!data) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Notificação ativa não encontrada.",
        },
        {
          status: 404,
        },
      );
    }

    return NextResponse.json({
      success: true,
      notificacao: data,
    });
  } catch (e) {
    return NextResponse.json(
      {
        success: false,
        error:
          e instanceof Error
            ? e.message
            : "Erro ao atualizar notificação.",
      },
      {
        status: 500,
      },
    );
  }
}