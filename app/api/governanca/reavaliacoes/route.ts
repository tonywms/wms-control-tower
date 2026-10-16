import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";

type RegistroPayload = {
  decisao_id: string;
  acao: "manter" | "encerrar";
  justificativa: string | null;
  usuario_nome: string;
  created_at: string;
};

type Body = {
  decisao_id?: string;
  projeto_id?: string;
  acao?: "manter" | "encerrar";
  justificativa?: string;
  efetividade?: string | null;
  score_atual?: number | null;
  urgencia_atual?: number | null;
  saude_atual?: string | null;
  progresso_atual?: number | null;
};

function parseRegistro(valor: string | null): RegistroPayload | null {
  if (!valor) return null;

  try {
    const parsed = JSON.parse(valor) as Partial<RegistroPayload>;

    if (
      typeof parsed.decisao_id !== "string" ||
      (parsed.acao !== "manter" && parsed.acao !== "encerrar")
    ) {
      return null;
    }

    return {
      decisao_id: parsed.decisao_id,
      acao: parsed.acao,
      justificativa:
        typeof parsed.justificativa === "string" ? parsed.justificativa : null,
      usuario_nome:
        typeof parsed.usuario_nome === "string" ? parsed.usuario_nome : "Sistema",
      created_at:
        typeof parsed.created_at === "string"
          ? parsed.created_at
          : new Date(0).toISOString(),
    };
  } catch {
    return null;
  }
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

    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("historico_projeto")
      .select("id,valor_novo,created_at")
      .eq("origem", "governanca")
      .eq("campo", "Acompanhamento gerencial")
      .order("created_at", { ascending: false })
      .limit(1000);

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 },
      );
    }

    const acompanhamentos = (data ?? [])
      .map((item) => {
        const registro = parseRegistro(item.valor_novo);

        if (!registro) return null;

        return {
          ...registro,
          created_at: item.created_at ?? registro.created_at,
        };
      })
      .filter((item): item is RegistroPayload => Boolean(item));

    return NextResponse.json({
      success: true,
      acompanhamentos,
    });
  } catch (error) {
    console.error("[GET /api/governanca/reavaliacoes]", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Erro ao carregar reavaliações gerenciais.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const permissao = await requirePermission("editar");

    if (!permissao.ok) {
      return NextResponse.json(
        { success: false, error: permissao.error },
        { status: permissao.status },
      );
    }

    const body = (await request.json()) as Body;

    const decisaoId =
      typeof body.decisao_id === "string" ? body.decisao_id.trim() : "";
    const projetoId =
      typeof body.projeto_id === "string" ? body.projeto_id.trim() : "";
    const justificativa =
      typeof body.justificativa === "string" ? body.justificativa.trim() : "";

    if (!decisaoId || !projetoId) {
      return NextResponse.json(
        { success: false, error: "Decisão e projeto são obrigatórios." },
        { status: 400 },
      );
    }

    if (body.acao !== "manter" && body.acao !== "encerrar") {
      return NextResponse.json(
        { success: false, error: "Ação de reavaliação inválida." },
        { status: 400 },
      );
    }

    if (justificativa.length < 10) {
      return NextResponse.json(
        {
          success: false,
          error: "A justificativa deve possuir pelo menos 10 caracteres.",
        },
        { status: 400 },
      );
    }

    const usuario = permissao.usuario;
    const createdAt = new Date().toISOString();

    const registro: RegistroPayload & {
      efetividade: string | null;
      score_atual: number | null;
      urgencia_atual: number | null;
      saude_atual: string | null;
      progresso_atual: number | null;
    } = {
      decisao_id: decisaoId,
      acao: body.acao,
      justificativa,
      usuario_nome: usuario.nome || "Sistema",
      created_at: createdAt,
      efetividade: body.efetividade ?? null,
      score_atual:
        typeof body.score_atual === "number" ? body.score_atual : null,
      urgencia_atual:
        typeof body.urgencia_atual === "number" ? body.urgencia_atual : null,
      saude_atual: body.saude_atual ?? null,
      progresso_atual:
        typeof body.progresso_atual === "number" ? body.progresso_atual : null,
    };

    const supabase = createAdminClient();

    const { error } = await supabase.from("historico_projeto").insert({
      projeto_id: projetoId,
      campo: "Acompanhamento gerencial",
      valor_anterior: null,
      valor_novo: JSON.stringify(registro),
      usuario_id: usuario.usuarioId ?? null,
      usuario_nome: usuario.nome || "Sistema",
      origem: "governanca",
      created_at: createdAt,
    });

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      acompanhamento: registro,
    });
  } catch (error) {
    console.error("[POST /api/governanca/reavaliacoes]", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Erro ao registrar reavaliação gerencial.",
      },
      { status: 500 },
    );
  }
}
