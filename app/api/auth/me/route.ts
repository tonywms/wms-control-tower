import { NextResponse } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { getCurrentUserContext } from "@/lib/auth/permissions";

export async function GET() {
  try {
    const usuario = await getCurrentUserContext();

    if (!usuario) {
      return NextResponse.json(
        {
          success: false,
          authenticated: false,
          error: "Usuário não autenticado ou sem perfil ativo no Control Tower.",
        },
        { status: 401 },
      );
    }

    return NextResponse.json({
      success: true,
      authenticated: true,
      usuario,
      permissoes: {
        visualizar: true,
        editar: [
          "CEO",
          "DIRETORIA",
          "P&D",
          "DESENVOLVIMENTO",
          "IMPLANTAÇÃO",
          "SUPORTE",
          "COMERCIAL",
        ].includes(usuario.perfil),
        alterar_status: [
          "CEO",
          "DIRETORIA",
          "P&D",
          "DESENVOLVIMENTO",
          "IMPLANTAÇÃO",
          "SUPORTE",
        ].includes(usuario.perfil),
        excluir: ["CEO", "DIRETORIA", "P&D"].includes(usuario.perfil),
        administrar: ["CEO", "DIRETORIA"].includes(usuario.perfil),
      },
    });
  } catch (error) {
      unstable_rethrow(error);
    console.error("[GET /api/auth/me]", error);

    return NextResponse.json(
      {
        success: false,
        authenticated: false,
        error: "Erro ao identificar o usuário.",
      },
      { status: 500 },
    );
  }
}
