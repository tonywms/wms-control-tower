import { createClient } from "@/lib/supabase/server";

export const PERFIS = [
  "CEO",
  "Diretoria",
  "P&D",
  "Desenvolvimento",
  "Implantação",
  "Suporte",
  "Comercial",
  "Visualização",
] as const;

export type Perfil = (typeof PERFIS)[number];

export type Permissao =
  | "visualizar"
  | "editar"
  | "alterar_status"
  | "excluir"
  | "administrar";

const PERMISSOES: Record<
  Permissao,
  readonly Perfil[]
> = {
  visualizar: PERFIS,

  editar: [
    "CEO",
    "Diretoria",
    "P&D",
    "Desenvolvimento",
    "Implantação",
    "Suporte",
    "Comercial",
  ],

  alterar_status: [
    "CEO",
    "Diretoria",
    "P&D",
    "Desenvolvimento",
    "Implantação",
    "Suporte",
  ],

  excluir: [
    "CEO",
    "Diretoria",
    "P&D",
  ],

  administrar: [
    "CEO",
    "Diretoria",
  ],
};

export type UsuarioContexto = {
  authUserId: string;
  email: string | null;
  usuarioId: string;
  nome: string;
  cargo: string | null;
  setor: string | null;
  perfil: Perfil;
  ativo: boolean;
};

/*
 * ============================================================
 * WMS EXPERT CONTROL TOWER
 * MODO DE DESENVOLVIMENTO SEM LOGIN
 * ============================================================
 *
 * true:
 *   Permite trabalhar localmente sem sessão do Supabase Auth.
 *
 * false:
 *   Volta ao comportamento normal de autenticação.
 *
 * IMPORTANTE:
 * O bypass somente é aceito quando NODE_ENV !== "production".
 */
const DEV_BYPASS_AUTH = true;

/*
 * Usuário que será utilizado durante o desenvolvimento.
 *
 * Este é o ID real do registro em public.usuarios.
 *
 * Não criamos usuário fictício.
 * Continuamos utilizando o usuário real e suas permissões.
 */
const DEV_USUARIO_ID =
  "3214c1e1-5a13-44a0-b4c6-24220ebb4598";

/*
 * Auth UID real correspondente ao usuário.
 */
const DEV_AUTH_USER_ID =
  "5a83fc0e-d2d7-4eda-b000-f8866d4cf093";

export function hasPermission(
  perfil: Perfil,
  permissao: Permissao,
): boolean {
  return PERMISSOES[permissao].includes(perfil);
}

/*
 * ============================================================
 * USUÁRIO DE DESENVOLVIMENTO
 * ============================================================
 *
 * Busca o usuário diretamente em public.usuarios.
 *
 * Isso mantém:
 *
 * - perfil real;
 * - nome real;
 * - cargo real;
 * - setor real;
 * - permissões reais;
 * - usuarioId real;
 * - histórico/auditoria com usuário real.
 *
 * A única coisa ignorada temporariamente é a necessidade
 * de possuir uma sessão do Supabase Auth.
 */
async function getDevelopmentUserContext(): Promise<UsuarioContexto | null> {
  const supabase = await createClient();

  const {
    data: usuario,
    error: usuarioError,
  } = await supabase
    .from("usuarios")
    .select(
      "id, nome, email, cargo, setor, perfil, ativo, auth_user_id",
    )
    .eq("id", DEV_USUARIO_ID)
    .eq("ativo", true)
    .maybeSingle();

  if (usuarioError) {
    console.error(
      "[Control Tower][DEV] Erro ao carregar usuário de desenvolvimento:",
      usuarioError,
    );

    return null;
  }

  if (!usuario) {
    console.error(
      "[Control Tower][DEV] Usuário de desenvolvimento não encontrado ou inativo.",
    );

    return null;
  }

  if (!PERFIS.includes(usuario.perfil as Perfil)) {
    console.error(
      `[Control Tower][DEV] Perfil inválido: ${usuario.perfil}`,
    );

    return null;
  }

  return {
    authUserId:
      usuario.auth_user_id ??
      DEV_AUTH_USER_ID,

    email:
      usuario.email ??
      "tonymoreira@wmsexpert.com.br",

    usuarioId: usuario.id,

    nome: usuario.nome,

    cargo: usuario.cargo ?? null,

    setor: usuario.setor ?? null,

    perfil: usuario.perfil as Perfil,

    ativo: Boolean(usuario.ativo),
  };
}

/*
 * ============================================================
 * CONTEXTO DO USUÁRIO
 * ============================================================
 */
export async function getCurrentUserContext(): Promise<UsuarioContexto | null> {
  /*
   * ----------------------------------------------------------
   * MODO DEV
   * ----------------------------------------------------------
   *
   * O bypass NÃO funciona em build/execução production.
   */
  if (
    DEV_BYPASS_AUTH &&
    process.env.NODE_ENV !== "production"
  ) {
    return getDevelopmentUserContext();
  }

  /*
   * ----------------------------------------------------------
   * AUTENTICAÇÃO NORMAL
   * ----------------------------------------------------------
   */
  const supabase = await createClient();

  const {
    data: userData,
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    return null;
  }

  const {
    data: usuario,
    error: usuarioError,
  } = await supabase
    .from("usuarios")
    .select(
      "id, nome, email, cargo, setor, perfil, ativo, auth_user_id",
    )
    .eq(
      "auth_user_id",
      userData.user.id,
    )
    .eq("ativo", true)
    .maybeSingle();

  if (usuarioError || !usuario) {
    return null;
  }

  if (
    !PERFIS.includes(
      usuario.perfil as Perfil,
    )
  ) {
    return null;
  }

  return {
    authUserId: userData.user.id,

    email:
      userData.user.email ??
      usuario.email ??
      null,

    usuarioId: usuario.id,

    nome: usuario.nome,

    cargo: usuario.cargo ?? null,

    setor: usuario.setor ?? null,

    perfil: usuario.perfil as Perfil,

    ativo: Boolean(usuario.ativo),
  };
}

/*
 * ============================================================
 * VERIFICAÇÃO DE PERMISSÃO
 * ============================================================
 */
export async function requirePermission(
  permissao: Permissao,
) {
  const usuario =
    await getCurrentUserContext();

  if (!usuario) {
    return {
      ok: false as const,

      status: 401 as const,

      usuario: null,

      error:
        "Usuário não autenticado ou sem perfil ativo no Control Tower.",
    };
  }

  if (
    !hasPermission(
      usuario.perfil,
      permissao,
    )
  ) {
    return {
      ok: false as const,

      status: 403 as const,

      usuario,

      error:
        `O perfil ${usuario.perfil} não possui permissão para ${permissao}.`,
    };
  }

  return {
    ok: true as const,

    status: 200 as const,

    usuario,

    error: null,
  };
}