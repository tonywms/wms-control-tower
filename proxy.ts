import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

/*
 * ============================================================
 * WMS EXPERT CONTROL TOWER
 * BYPASS TEMPORÁRIO DE AUTENTICAÇÃO PARA DESENVOLVIMENTO LOCAL
 * ============================================================
 *
 * true  = localhost entra sem passar pelo login
 * false = autenticação normal do Supabase
 *
 * IMPORTANTE:
 * O bypass abaixo funciona SOMENTE em localhost / 127.0.0.1.
 * Mesmo que alguém esqueça true em produção, o hostname impede
 * o bypass fora do ambiente local.
 */
const DEV_BYPASS_AUTH = true;

export async function proxy(request: NextRequest) {
  const hostname = request.nextUrl.hostname;

  const isLocalhost =
    hostname === "localhost" ||
    hostname === "127.0.0.1";

  /*
   * DESENVOLVIMENTO LOCAL
   *
   * Libera navegação das páginas sem exigir sessão Supabase.
   */
  if (DEV_BYPASS_AUTH && isLocalhost) {
    return NextResponse.next({
      request,
    });
  }

  /*
   * FLUXO NORMAL
   *
   * Fora do localhost continua utilizando toda a proteção
   * existente em lib/supabase/proxy.ts.
   */
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map)$).*)",
  ],
};