import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();

    const { error } = await supabase
      .from("wms_control_tower_test")
      .select("id")
      .limit(1);

    if (error && error.code !== "42P01") {
      return NextResponse.json(
        {
          connected: false,
          error: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      connected: true,
      message: "Conexão com o Supabase estabelecida.",
      tableExists: error?.code !== "42P01",
    });
  } catch (error) {
    return NextResponse.json(
      {
        connected: false,
        error:
          error instanceof Error
            ? error.message
            : "Erro desconhecido ao conectar ao Supabase.",
      },
      { status: 500 }
    );
  }
}