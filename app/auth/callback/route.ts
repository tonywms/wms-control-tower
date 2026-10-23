import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);

  const code = requestUrl.searchParams.get("code");

  const next =
    requestUrl.searchParams.get("next") ||
    "/redefinir-senha";

  const destino =
    next.startsWith("/") && !next.startsWith("//")
      ? next
      : "/redefinir-senha";

  if (!code) {
    return NextResponse.redirect(
      new URL(
        "/login?error=link-recuperacao",
        requestUrl.origin,
      ),
    );
  }

  const url = new URL(
    "/auth/confirmar",
    requestUrl.origin,
  );

  url.searchParams.set("code", code);
  url.searchParams.set("next", destino);

  return NextResponse.redirect(url);
}