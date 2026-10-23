import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePermission } from "@/lib/auth/permissions";
import { gerarAlertasExecutivos } from "@/lib/notificacoes/alertas-executivos";

async function db() {
  return process.env.NODE_ENV !== "production"
    ? createAdminClient()
    : await createClient();
}

export async function GET() {
  try {
    const perm = await requirePermission("visualizar");

    if (!perm.ok) {
      return NextResponse.json(
        {
          success: false,
          error: perm.error,
        },
        {
          status: perm.status,
        },
      );
    }

    const supabase = await db();

    const alertas = await gerarAlertasExecutivos(supabase);

    const criticos = alertas.filter(
      alerta => alerta.severidade === "Crítico",
    ).length;

    return NextResponse.json({
      success: true,
      atualizado_em: new Date().toISOString(),
      resumo: {
        total: alertas.length,
        criticos,
        atencao: alertas.length - criticos,
      },
      alertas,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Erro ao carregar alertas.",
      },
      {
        status: 500,
      },
    );
  }
}