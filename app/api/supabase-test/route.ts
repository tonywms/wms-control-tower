import { NextResponse } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();

    const { error } = await supabase
      .from("wms_control_tower_test")
      .select("id")
      .limit(1);

    if (error && error.code !== "42P01") {
      console.error("[API /api/supabase-test] Falha na consulta de conexão:", error);
      return NextResponse.json(
        { connected: false, error: "Não foi possível validar a conexão com o banco de dados." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      connected: true,
      message: "Conexão com o Supabase estabelecida.",
      tableExists: error?.code !== "42P01",
    });
  } catch (error) {
    unstable_rethrow(error);
    console.error("[API /api/supabase-test] Erro inesperado:", error);
    return NextResponse.json(
      { connected: false, error: "Não foi possível validar a conexão com o banco de dados." },
      { status: 500 },
    );
  }
}
