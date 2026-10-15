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

  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  const pathname = request.nextUrl.pathname;

  const isLogin = pathname === "/login";
  const isAuthRoute = pathname.startsWith("/auth/");
  const isPublicAsset =
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico" ||
    /\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map)$/.test(pathname);

  if (isPublicAsset || isAuthRoute) {
    return supabaseResponse;
  }

  if (!userId) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        {
          success: false,
          error: "Não autenticado.",
        },
        { status: 401 },
      );
    }

    if (!isLogin) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("redirect", pathname);
      return NextResponse.redirect(url);
    }

    return supabaseResponse;
  }

  // O usuário autenticado também precisa existir na tabela `usuarios`
  // e estar ativo. Isso impede que uma conta do Supabase Auth sem perfil
  // operacional entre no Control Tower.
  const { data: usuario, error: usuarioError } = await supabase
    .from("usuarios")
    .select("id")
    .eq("auth_user_id", userId)
    .eq("ativo", true)
    .maybeSingle();

  if (usuarioError || !usuario) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        {
          success: false,
          error: "Usuário autenticado sem perfil ativo no Control Tower.",
        },
        { status: 403 },
      );
    }

    if (isLogin) {
      return supabaseResponse;
    }

    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("error", "perfil");
    return NextResponse.redirect(url);
  }

  if (isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
