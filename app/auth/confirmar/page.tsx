"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function ConfirmarAuthPage() {
  const router = useRouter();

  const supabase = useMemo(
    () => createClient(),
    [],
  );

  const [error, setError] = useState("");

  useEffect(() => {
    let ativo = true;

    async function confirmar() {
      const params = new URLSearchParams(
        window.location.search,
      );

      const code = params.get("code");

      const next =
        params.get("next") ||
        "/redefinir-senha";

      const destino =
        next.startsWith("/") &&
        !next.startsWith("//")
          ? next
          : "/redefinir-senha";

      try {
        // O cliente do @supabase/ssr já troca o code da URL sozinho
        // ao ser criado. getSession() espera essa inicialização terminar.
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session) {
          router.replace(destino);
          router.refresh();
          return;
        }

        if (!code) {
          console.error(
            "[Control Tower] /auth/confirmar sem code e sem sessão.",
          );

          if (ativo) {
            setError(
              "Link de recuperação sem código de autenticação.",
            );
          }

          return;
        }

        // Fallback: só chega aqui se a troca automática não criou sessão.
        const { data, error: exchangeError } =
          await supabase.auth.exchangeCodeForSession(
            code,
          );

        if (exchangeError) {
          console.error(
            "[Control Tower] Erro PKCE no navegador:",
            {
              message: exchangeError.message,
              status: exchangeError.status,
              code: exchangeError.code,
            },
          );

          if (ativo) {
            setError(
              `Não foi possível validar o link de recuperação. ${
                exchangeError.code
                  ? `Código: ${exchangeError.code}`
                  : ""
              }`,
            );
          }

          return;
        }

        if (!data.session) {
          console.error(
            "[Control Tower] Exchange PKCE concluído sem sessão.",
          );

          if (ativo) {
            setError(
              "O link foi validado, mas nenhuma sessão de recuperação foi criada.",
            );
          }

          return;
        }

        router.replace(destino);
        router.refresh();
      } catch (err) {
        console.error(
          "[Control Tower] Erro inesperado no PKCE:",
          err,
        );

        if (ativo) {
          setError(
            "Não foi possível concluir a recuperação de senha.",
          );
        }
      }
    }

    confirmar();

    return () => {
      ativo = false;
    };
  }, [router, supabase]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#05080d] px-4 text-slate-200">
      <div className="text-center">
        {!error ? (
          <>
            <Loader2
              size={28}
              className="mx-auto animate-spin text-sky-400"
            />

            <div className="mt-4 text-sm text-slate-400">
              Validando link de recuperação...
            </div>
          </>
        ) : (
          <>
            <div className="text-sm text-red-300">
              {error}
            </div>

            <button
              type="button"
              onClick={() =>
                router.replace("/login")
              }
              className="mt-5 rounded-xl bg-sky-500 px-5 py-3 text-sm font-semibold text-slate-950"
            >
              Voltar para o login
            </button>
          </>
        )}
      </div>
    </main>
  );
}