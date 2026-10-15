import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type EventoTimeline = {
  id: string;
  tipo: "alteracao" | "status";
  campo: string;
  valor_anterior: string | null;
  valor_novo: string | null;
  motivo: string | null;
  usuario_id: string | null;
  usuario_nome: string;
  origem: string;
  created_at: string;
};

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();

    const [alteracoesResult, statusResult] = await Promise.all([
      supabase
        .from("historico_projeto")
        .select(`
          id,
          projeto_id,
          campo,
          valor_anterior,
          valor_novo,
          usuario_id,
          usuario_nome,
          origem,
          created_at
        `)
        .eq("projeto_id", id)
        .order("created_at", { ascending: false }),

      supabase
        .from("historico_status")
        .select(`
          id,
          projeto_id,
          status_anterior,
          status_novo,
          motivo,
          usuario_id,
          usuario_nome,
          created_at
        `)
        .eq("projeto_id", id)
        .order("created_at", { ascending: false }),
    ]);

    if (alteracoesResult.error) {
      console.error(
        "[GET /api/projetos/:id/historico] Erro em historico_projeto:",
        alteracoesResult.error,
      );

      return NextResponse.json(
        {
          success: false,
          error: alteracoesResult.error.message,
        },
        { status: 500 },
      );
    }

    if (statusResult.error) {
      console.error(
        "[GET /api/projetos/:id/historico] Erro em historico_status:",
        statusResult.error,
      );

      return NextResponse.json(
        {
          success: false,
          error: statusResult.error.message,
        },
        { status: 500 },
      );
    }

    const alteracoes: EventoTimeline[] = (
      alteracoesResult.data ?? []
    ).map((item) => ({
      id: `alteracao-${item.id}`,
      tipo: "alteracao",
      campo: item.campo,
      valor_anterior: item.valor_anterior,
      valor_novo: item.valor_novo,
      motivo: null,
      usuario_id: item.usuario_id,
      usuario_nome: item.usuario_nome || "Sistema",
      origem: item.origem || "edicao",
      created_at: item.created_at,
    }));

    const status: EventoTimeline[] = (
      statusResult.data ?? []
    ).map((item) => ({
      id: `status-${item.id}`,
      tipo: "status",
      campo: "Status",
      valor_anterior: item.status_anterior,
      valor_novo: item.status_novo,
      motivo: item.motivo,
      usuario_id: item.usuario_id,
      usuario_nome: item.usuario_nome || "Sistema",
      origem: "status",
      created_at: item.created_at,
    }));

    const historico = [...alteracoes, ...status].sort(
      (a, b) =>
        new Date(b.created_at).getTime() -
        new Date(a.created_at).getTime(),
    );

    return NextResponse.json({
      success: true,
      total: historico.length,
      historico,
    });
  } catch (error) {
    console.error(
      "[GET /api/projetos/:id/historico] Erro inesperado:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Erro inesperado ao carregar histórico.",
      },
      { status: 500 },
    );
  }
}
