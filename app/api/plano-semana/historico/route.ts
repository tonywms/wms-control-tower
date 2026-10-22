import { NextRequest, NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requirePermission } from "@/lib/auth/permissions";
import { registrarFotografiaSemana } from "@/lib/plano-semana/historico";

export async function GET() {
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

    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("plano_semana_historico")
      .select("*")
      .order("inicio_semana", { ascending: false })
      .limit(52);

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({
      success: true,
      semanas: data ?? [],
    });
  } catch (error) {
    console.error(
      "[GET /api/plano-semana/historico]",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Erro ao carregar histórico semanal.",
      },
      {
        status: 500,
      },
    );
  }
}

export async function POST(req: NextRequest) {
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

    const body = await req.json();

    const inicio = body?.inicio;
    const fim = body?.fim;

    const resultado = await registrarFotografiaSemana({
      inicio,
      fim,
      registradoPor: permission.usuario.usuarioId ?? null,
      registradoPorNome: permission.usuario.nome || "Sistema",
    });

    return NextResponse.json({
      success: true,
      semana: resultado.semana,
      message: resultado.message,
    });
  } catch (error) {
    console.error(
      "[POST /api/plano-semana/historico]",
      error,
    );

    const message =
      error instanceof Error
        ? error.message
        : "Erro ao registrar semana.";

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      {
        status:
          message === "Período semanal inválido."
            ? 400
            : 500,
      },
    );
  }
}