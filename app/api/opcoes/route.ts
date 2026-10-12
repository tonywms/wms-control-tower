import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();

    const [etapasResult, usuariosResult] = await Promise.all([
      supabase
        .from("etapas")
        .select("id,nome,ordem")
        .order("ordem", {
          ascending: true,
        }),

      supabase
        .from("usuarios")
        .select("id,nome,cargo,setor")
        .eq("ativo", true)
        .order("nome", {
          ascending: true,
        }),
    ]);

    if (etapasResult.error) {
      return NextResponse.json(
        {
          success: false,
          error: etapasResult.error.message,
        },
        { status: 500 },
      );
    }

    if (usuariosResult.error) {
      return NextResponse.json(
        {
          success: false,
          error: usuariosResult.error.message,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      etapas: etapasResult.data ?? [],
      responsaveis: usuariosResult.data ?? [],
    });
  } catch (error) {
    console.error("Erro ao carregar opções:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Erro ao carregar opções.",
      },
      { status: 500 },
    );
  }
}