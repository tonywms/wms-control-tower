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

const PERMISSOES: Record<Permissao, readonly Perfil[]> = {
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

export function hasPermission(
  perfil: Perfil,
  permissao: Permissao,
): boolean {
  return PERMISSOES[permissao].includes(perfil);
}

export async function getCurrentUserContext(): Promise<UsuarioContexto | null> {
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
    .eq("auth_user_id", userData.user.id)
    .eq("ativo", true)
    .maybeSingle();

  if (usuarioError || !usuario) {
    return null;
  }

  if (!PERFIS.includes(usuario.perfil as Perfil)) {
    return null;
  }

  return {
    authUserId: userData.user.id,
    email: userData.user.email ?? usuario.email ?? null,
    usuarioId: usuario.id,
    nome: usuario.nome,
    cargo: usuario.cargo ?? null,
    setor: usuario.setor ?? null,
    perfil: usuario.perfil as Perfil,
    ativo: Boolean(usuario.ativo),
  };
}

export async function requirePermission(
  permissao: Permissao,
) {
  const usuario = await getCurrentUserContext();

  if (!usuario) {
    return {
      ok: false as const,
      status: 401 as const,
      usuario: null,
      error:
        "Usuário não autenticado ou sem perfil ativo no Control Tower.",
    };
  }

  if (!hasPermission(usuario.perfil, permissao)) {
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