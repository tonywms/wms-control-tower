"use client";

import { FormEvent, useEffect, useState } from "react";
import { ArrowRight, Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("error") === "perfil") {
      setError(
        "Seu acesso foi autenticado, mas seu usuário ainda não está vinculado a um perfil ativo no Control Tower.",
      );
    }
  }, []);


  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!email.trim() || !password) {
      setError("Informe seu e-mail e sua senha.");
      return;
    }

    try {
      setLoading(true);

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) {
        throw signInError;
      }

      const response = await fetch("/api/auth/me", {
        cache: "no-store",
      });

      if (!response.ok) {
        await supabase.auth.signOut();
        throw new Error("Login realizado, mas este e-mail não possui um usuário ativo vinculado ao Control Tower.");
      }

      window.location.assign("/");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível entrar no Control Tower.",
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
            <ShieldCheck size={25} className="text-sky-300" />
          </div>

          <div className="mt-5 text-[10px] font-semibold uppercase tracking-[0.28em] text-sky-400/80">
            WMS Expert
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-white">
            Control Tower
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Acesso ao centro executivo e operacional.
          </p>
        </div>

        <div className="rounded-3xl border border-white/[0.08] bg-white/[0.025] p-6 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-7">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">
                E-mail corporativo
              </label>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="seu.email@wmsexpert.com.br"
                className="input"
                autoFocus
              />
            </div>

            <div>
              <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">
                Senha
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                  className="input pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-600 transition hover:bg-white/[0.05] hover:text-slate-300"
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.06] px-4 py-3 text-xs leading-5 text-red-300">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-sky-500 px-4 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? <Loader2 size={17} className="animate-spin" /> : <ArrowRight size={17} />}
              {loading ? "Validando acesso..." : "Entrar no Control Tower"}
            </button>
          </form>

          <div className="mt-6 border-t border-white/[0.06] pt-5 text-center text-[10px] leading-5 text-slate-600">
            Acesso protegido por Supabase Auth. Seu perfil define quais ações estão disponíveis.
          </div>
        </div>
      </section>
    </main>
  );
}
