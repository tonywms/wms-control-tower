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
const DEV_BYPASS_AUTH = false;

export async function proxy(request: NextRequest) {
  const hostname = request.nextUrl.hostname;
  const pathname = request.nextUrl.pathname;

  const isLocalhost =
    hostname === "localhost" ||
    hostname === "127.0.0.1";

  /*
   * ============================================================
   * ROTAS DE CRON
   * ============================================================
   *
   * As rotas /api/cron/* não utilizam autenticação de usuário
   * do Supabase.
   *
   * Elas possuem autenticação própria através do CRON_SECRET,
   * validado dentro de cada endpoint.
   *
   * IMPORTANTE:
   * Isto NÃO torna o cron público.
   *
   * Uma chamada sem o header:
   *
   * Authorization: Bearer <CRON_SECRET>
   *
   * continuará recebendo HTTP 401 pela própria rota do cron.
   */
  if (pathname.startsWith("/api/cron/")) {
    return NextResponse.next({
      request,
    });
  }

  /*
   * ============================================================
   * DESENVOLVIMENTO LOCAL
   * ============================================================
   *
   * Libera navegação das páginas sem exigir sessão Supabase
   * somente quando o bypass estiver explicitamente habilitado.
   */
  if (DEV_BYPASS_AUTH && isLocalhost) {
    return NextResponse.next({
      request,
    });
  }

  /*
   * ============================================================
   * FLUXO NORMAL
   * ============================================================
   *
   * Todas as demais páginas e APIs continuam utilizando
   * integralmente a proteção existente em:
   *
   * lib/supabase/proxy.ts
   */
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map)$).*)",
  ],
};