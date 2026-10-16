"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  ShieldCheck,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";

export default function RedefinirSenhaPage() {
  const supabase = useMemo(() => createClient(), []);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] =
    useState("");

  const [showPassword, setShowPassword] =
    useState(false);

  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  const [sessionValid, setSessionValid] =
    useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let mounted = true;

    async function verificarSessao() {
      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (!mounted) return;

        if (sessionError) {
          console.error(
            "[Control Tower] Erro ao verificar sessão de recuperação:",
            sessionError,
          );

          setError(
            "Não foi possível validar o link de recuperação.",
          );

          setSessionValid(false);
          return;
        }

        if (!session) {
          setError(
            "O link de recuperação é inválido, expirou ou já foi utilizado. Solicite um novo link na tela de login.",
          );

          setSessionValid(false);
          return;
        }

        setSessionValid(true);
      } catch (err) {
        console.error(
          "[Control Tower] Erro ao verificar recuperação:",
          err,
        );

        if (mounted) {
          setError(
            "Não foi possível validar sua recuperação de senha.",
          );

          setSessionValid(false);
        }
      } finally {
        if (mounted) {
          setChecking(false);
        }
      }
    }

    verificarSessao();

    return () => {
      mounted = false;
    };
  }, [supabase]);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!sessionValid) {
      setError(
        "Sua sessão de recuperação não é válida. Solicite um novo link.",
      );
      return;
    }

    if (!password || !confirmPassword) {
      setError(
        "Informe a nova senha e confirme a nova senha.",
      );
      return;
    }

    if (password.length < 8) {
      setError(
        "A nova senha deve possuir pelo menos 8 caracteres.",
      );
      return;
    }

    if (password !== confirmPassword) {
      setError(
        "A confirmação da senha não corresponde à nova senha.",
      );
      return;
    }

    try {
      setLoading(true);

      const { error: updateError } =
        await supabase.auth.updateUser({
          password,
        });

      if (updateError) {
        throw updateError;
      }

      setSuccess(
        "Sua senha foi alterada com sucesso.",
      );

      /*
       * Encerramos a sessão de recuperação.
       * O usuário deverá autenticar novamente usando
       * a nova senha.
       */
      await supabase.auth.signOut();

      window.setTimeout(() => {
        window.location.assign(
          "/login?senha=alterada",
        );
      }, 1200);
    } catch (err) {
      console.error(
        "[Control Tower] Erro ao alterar senha:",
        err,
      );

      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível alterar sua senha.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#05080d] px-4 py-10 text-slate-200">
      <div className="absolute left-1/2 top-[-180px] h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-sky-400/[0.07] blur-[120px]" />

      <div className="absolute bottom-[-220px] right-[-100px] h-[420px] w-[420px] rounded-full bg-blue-500/[0.05] blur-[110px]" />

      <section className="relative w-full max-w-[440px]">
        <div className="mb-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-sky-400/20 bg-sky-400/[0.07] shadow-[0_0_45px_rgba(56,189,248,0.08)]">
            <KeyRound
              size={25}
              className="text-sky-300"
            />
          </div>

          <div className="mt-5 text-[10px] font-semibold uppercase tracking-[0.28em] text-sky-400/80">
            WMS Expert
          </div>

          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-white">
            Nova senha
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Defina uma nova senha para acessar o
            Control Tower.
          </p>
        </div>

        <div className="rounded-3xl border border-white/[0.08] bg-white/[0.025] p-6 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-7">
          {checking ? (
            <div className="flex min-h-[180px] flex-col items-center justify-center">
              <Loader2
                size={25}
                className="animate-spin text-sky-400"
              />

              <div className="mt-4 text-xs text-slate-500">
                Validando link de recuperação...
              </div>
            </div>
          ) : !sessionValid ? (
            <div>
              <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.06] px-4 py-4 text-xs leading-5 text-red-300">
                {error ||
                  "Não foi possível validar este link de recuperação."}
              </div>

              <button
                type="button"
                onClick={() =>
                  window.location.assign("/login")
                }
                className="mt-5 flex h-11 w-full items-center justify-center rounded-xl bg-sky-500 px-4 text-sm font-semibold text-slate-950 transition hover:bg-sky-400"
              >
                Voltar para o login
              </button>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="space-y-5"
            >
              <div className="flex gap-3 rounded-2xl border border-sky-400/10 bg-sky-400/[0.04] px-4 py-3">
                <ShieldCheck
                  size={17}
                  className="mt-0.5 shrink-0 text-sky-300"
                />

                <div className="text-[10px] leading-5 text-slate-500">
                  Link validado. Informe sua nova senha
                  abaixo.
                </div>
              </div>

              <div>
                <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">
                  Nova senha
                </label>

                <div className="relative">
                  <input
                    type={
                      showPassword
                        ? "text"
                        : "password"
                    }
                    autoComplete="new-password"
                    value={password}
                    onChange={(event) =>
                      setPassword(event.target.value)
                    }
                    placeholder="Mínimo de 8 caracteres"
                    className="input pr-11"
                    autoFocus
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowPassword(
                        (value) => !value,
                      )
                    }
                    className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-600 transition hover:bg-white/[0.05] hover:text-slate-300"
                    aria-label={
                      showPassword
                        ? "Ocultar senha"
                        : "Mostrar senha"
                    }
                  >
                    {showPassword ? (
                      <EyeOff size={15} />
                    ) : (
                      <Eye size={15} />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">
                  Confirmar nova senha
                </label>

                <div className="relative">
                  <input
                    type={
                      showConfirmPassword
                        ? "text"
                        : "password"
                    }
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(event) =>
                      setConfirmPassword(
                        event.target.value,
                      )
                    }
                    placeholder="Digite novamente"
                    className="input pr-11"
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowConfirmPassword(
                        (value) => !value,
                      )
                    }
                    className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-600 transition hover:bg-white/[0.05] hover:text-slate-300"
                    aria-label={
                      showConfirmPassword
                        ? "Ocultar senha"
                        : "Mostrar senha"
                    }
                  >
                    {showConfirmPassword ? (
                      <EyeOff size={15} />
                    ) : (
                      <Eye size={15} />
                    )}
                  </button>
                </div>
              </div>

              {error && (
                <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.06] px-4 py-3 text-xs leading-5 text-red-300">
                  {error}
                </div>
              )}

              {success && (
                <div className="flex gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] px-4 py-3 text-xs leading-5 text-emerald-300">
                  <CheckCircle2
                    size={17}
                    className="mt-0.5 shrink-0"
                  />

                  <span>{success}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-sky-500 px-4 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? (
                  <Loader2
                    size={17}
                    className="animate-spin"
                  />
                ) : (
                  <KeyRound size={17} />
                )}

                {loading
                  ? "Alterando senha..."
                  : "Definir nova senha"}
              </button>
            </form>
          )}

          <div className="mt-6 border-t border-white/[0.06] pt-5 text-center text-[10px] leading-5 text-slate-600">
            Recuperação protegida por Supabase Auth.
          </div>
        </div>
      </section>
    </main>
  );
}