import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);

  const code = requestUrl.searchParams.get("code");
  const next =
    requestUrl.searchParams.get("next") ||
    "/redefinir-senha";

  if (!code) {
    return NextResponse.redirect(
      new URL(
        "/login?error=link-recuperacao",
        requestUrl.origin,
      ),
    );
  }

  const supabase = await createClient();

  const { error } =
    await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error(
      "[Control Tower] Erro no callback Auth:",
      error,
    );

    return NextResponse.redirect(
      new URL(
        "/login?error=link-recuperacao",
        requestUrl.origin,
      ),
    );
  }

  const destino =
    next.startsWith("/") &&
    !next.startsWith("//")
      ? next
      : "/redefinir-senha";

  return NextResponse.redirect(
    new URL(destino, requestUrl.origin),
  );
}