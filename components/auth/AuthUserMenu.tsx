"use client";

import { LogOut, ShieldCheck, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Usuario = {
  nome: string;
  email: string | null;
  cargo: string | null;
  setor: string | null;
  perfil: string;
};

type AuthResponse = {
  success: boolean;
  usuario?: Usuario;
};

function initials(nome: string) {
  const parts = nome.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export default function AuthUserMenu() {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;

    fetch("/api/auth/me", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()) as AuthResponse;
      })
      .then((data) => {
        if (active && data?.success && data.usuario) {
          setUsuario(data.usuario);
        }
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, []);

  async function logout() {
    try {
      setLoading(true);
      const supabase = createClient();
      await supabase.auth.signOut();
      window.location.assign("/login");
    } finally {
      setLoading(false);
    }
  }

  if (!usuario) {
    return (
      <div className="hidden h-8 w-8 items-center justify-center rounded-full border border-white/[0.06] bg-white/[0.025] sm:flex">
        <UserRound size={14} className="text-slate-600" />
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-2 rounded-xl px-1.5 py-1 transition hover:bg-white/[0.04]"
        aria-label="Abrir perfil"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full border border-sky-400/15 bg-sky-400/[0.08] text-[10px] font-semibold text-sky-200">
          {initials(usuario.nome)}
        </div>

        <div className="hidden text-left xl:block">
          <div className="text-[11px] font-medium text-slate-300">
            {usuario.nome}
          </div>
          <div className="text-[9px] text-slate-600">
            {usuario.perfil}
          </div>
        </div>
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-[80] w-64 overflow-hidden rounded-2xl border border-white/[0.09] bg-[#0a0f18]/95 p-2 shadow-2xl shadow-black/50 backdrop-blur-xl">
          <div className="rounded-xl bg-white/[0.03] p-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-sky-400/15 bg-sky-400/[0.08] text-[10px] font-semibold text-sky-200">
                {initials(usuario.nome)}
              </div>
              <div className="min-w-0">
                <div className="truncate text-xs font-semibold text-white">
                  {usuario.nome}
                </div>
                <div className="truncate text-[10px] text-slate-600">
                  {usuario.email || "Sem e-mail"}
                </div>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-white/[0.05] bg-black/20 p-2">
                <div className="text-[8px] uppercase tracking-[0.12em] text-slate-600">Perfil</div>
                <div className="mt-1 text-[10px] font-semibold text-sky-300">{usuario.perfil}</div>
              </div>
              <div className="rounded-lg border border-white/[0.05] bg-black/20 p-2">
                <div className="text-[8px] uppercase tracking-[0.12em] text-slate-600">Setor</div>
                <div className="mt-1 truncate text-[10px] font-semibold text-slate-300">{usuario.setor || "—"}</div>
              </div>
            </div>
          </div>

          <div className="my-1 border-t border-white/[0.06]" />

          <div className="px-2 py-2 text-[10px] leading-4 text-slate-600">
            <div className="flex items-center gap-2">
              <ShieldCheck size={12} className="text-emerald-400" />
              Acesso autenticado e perfil aplicado.
            </div>
          </div>

          <button
            type="button"
            onClick={logout}
            disabled={loading}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs text-red-300 transition hover:bg-red-500/[0.08] disabled:opacity-50"
          >
            <LogOut size={14} />
            {loading ? "Saindo..." : "Sair do Control Tower"}
          </button>
        </div>
      )}
    </div>
  );
}
