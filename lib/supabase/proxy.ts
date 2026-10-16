import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },

        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );

          supabaseResponse = NextResponse.next({
            request,
          });

          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  /*
   * IMPORTANTE:
   * getClaims() também atualiza/valida a sessão do Supabase
   * quando necessário.
   */
  const { data: claimsData } =
    await supabase.auth.getClaims();

  const userId = claimsData?.claims?.sub;

  const pathname = request.nextUrl.pathname;

  /*
   * ROTAS PÚBLICAS
   *
   * /login
   *   Tela normal de autenticação.
   *
   * /auth/*
   *   Callbacks do Supabase.
   *
   * /redefinir-senha
   *   Tela utilizada depois que o Supabase valida
   *   o link de recuperação.
   */
  const isLogin = pathname === "/login";

  const isAuthRoute =
    pathname === "/auth" ||
    pathname.startsWith("/auth/");

  const isPasswordRecovery =
    pathname === "/redefinir-senha" ||
    pathname.startsWith("/redefinir-senha/");

  const isPublicAsset =
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico" ||
    /\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map)$/.test(
      pathname,
    );

  /*
   * Assets e callbacks do Supabase nunca devem ser
   * bloqueados pelo Control Tower.
   */
  if (isPublicAsset || isAuthRoute) {
    return supabaseResponse;
  }

  /*
   * A tela de redefinição também precisa poder abrir
   * durante o processo de recuperação.
   *
   * A própria página verificará se existe uma sessão
   * válida antes de permitir a alteração da senha.
   */
  if (isPasswordRecovery) {
    return supabaseResponse;
  }

  /*
   * SEM USUÁRIO AUTENTICADO
   */
  if (!userId) {
    /*
     * APIs protegidas não devem redirecionar.
     * Elas respondem HTTP 401.
     */
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        {
          success: false,
          error: "Não autenticado.",
        },
        {
          status: 401,
        },
      );
    }

    /*
     * O login é público.
     */
    if (isLogin) {
      return supabaseResponse;
    }

    /*
     * Qualquer outra página exige autenticação.
     */
    const url = request.nextUrl.clone();

    url.pathname = "/login";

    url.search = "";

    url.searchParams.set(
      "redirect",
      pathname,
    );

    return NextResponse.redirect(url);
  }

  /*
   * USUÁRIO AUTENTICADO
   *
   * Além de existir no Supabase Auth, o usuário
   * precisa possuir um perfil ativo na tabela
   * public.usuarios.
   */
  const {
    data: usuario,
    error: usuarioError,
  } = await supabase
    .from("usuarios")
    .select("id")
    .eq("auth_user_id", userId)
    .eq("ativo", true)
    .maybeSingle();

  /*
   * Existe autenticação no Supabase, mas não existe
   * perfil operacional ativo no Control Tower.
   */
  if (usuarioError || !usuario) {
    /*
     * APIs respondem HTTP 403.
     */
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Usuário autenticado sem perfil ativo no Control Tower.",
        },
        {
          status: 403,
        },
      );
    }

    /*
     * Permite carregar o login para mostrar
     * a mensagem apropriada.
     */
    if (isLogin) {
      return supabaseResponse;
    }

    const url = request.nextUrl.clone();

    url.pathname = "/login";

    url.search = "";

    url.searchParams.set(
      "error",
      "perfil",
    );

    return NextResponse.redirect(url);
  }

  /*
   * Se o usuário já estiver autenticado e tentar
   * acessar /login, enviamos para o Control Tower.
   */
  if (isLogin) {
    const url = request.nextUrl.clone();

    url.pathname = "/";

    url.search = "";

    return NextResponse.redirect(url);
  }

  /*
   * Usuário autenticado + perfil ativo.
   */
  return supabaseResponse;
}