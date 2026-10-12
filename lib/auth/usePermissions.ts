"use client";

import { useCallback, useEffect, useState } from "react";

export type Permissao =
  | "visualizar"
  | "editar"
  | "alterar_status"
  | "excluir"
  | "administrar";

type PermissoesUsuario = Record<Permissao, boolean>;

type AuthMeResponse = {
  success: boolean;
  authenticated?: boolean;
  usuario?: {
    authUserId: string;
    email: string | null;
    usuarioId: string;
    nome: string;
    cargo: string | null;
    setor: string | null;
    perfil: string;
    ativo: boolean;
  };
  permissoes?: Partial<PermissoesUsuario>;
  error?: string;
};

const DEFAULT_PERMISSOES: PermissoesUsuario = {
  visualizar: false,
  editar: false,
  alterar_status: false,
  excluir: false,
  administrar: false,
};

let permissionsPromise: Promise<PermissoesUsuario> | null = null;

async function carregarPermissoes(): Promise<PermissoesUsuario> {
  if (!permissionsPromise) {
    permissionsPromise = fetch("/api/auth/me", {
      method: "GET",
      cache: "no-store",
      credentials: "same-origin",
    })
      .then(async (response) => {
        const data =
          (await response.json()) as AuthMeResponse;

        if (
          !response.ok ||
          !data.success ||
          !data.permissoes
        ) {
          return DEFAULT_PERMISSOES;
        }

        return {
          ...DEFAULT_PERMISSOES,
          ...data.permissoes,
        };
      })
      .catch(() => DEFAULT_PERMISSOES);
  }

  return permissionsPromise;
}

export function resetPermissionsCache() {
  permissionsPromise = null;
}

export function usePermissions() {
  const [permissoes, setPermissoes] =
    useState<PermissoesUsuario | null>(null);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ativo = true;

    carregarPermissoes().then((resultado) => {
      if (!ativo) {
        return;
      }

      setPermissoes(resultado);
      setLoading(false);
    });

    return () => {
      ativo = false;
    };
  }, []);

  const can = useCallback(
    (permissao: Permissao) => {
      if (!permissoes) {
        return false;
      }

      return Boolean(permissoes[permissao]);
    },
    [permissoes],
  );

  return {
    permissoes:
      permissoes ?? DEFAULT_PERMISSOES,
    loading,
    can,
  };
}