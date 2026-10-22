"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Users,
  Search,
  Plus,
  Edit3,
  Power,
  X,
  CheckCircle2,
  ChevronLeft,
  ShieldCheck,
  Building,
  Briefcase,
} from "lucide-react";
import { usePermissions } from "@/components/auth/usePermissions";

type Usuario = {
  id: string;
  nome: string;
  email: string | null;
  cargo: string | null;
  setor: string | null;
  perfil: string;
  ativo: boolean;
  created_at: string;
};

const PERFIS_OPCOES = [
  "CEO",
  "Diretoria",
  "P&D",
  "Desenvolvimento",
  "Implantação",
  "Suporte",
  "Comercial",
  "Visualização",
];

const SETORES_OPCOES = [
  "Diretoria",
  "P&D",
  "Desenvolvimento",
  "Implantação",
  "Suporte",
  "Comercial",
  "Administrativo",
];

export default function UsuariosPage() {
  const { can } = usePermissions();

  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [includeInactive, setIncludeInactive] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<Usuario | null>(null);

  const [form, setForm] = useState({
    nome: "",
    email: "",
    cargo: "",
    setor: "",
    perfil: "Visualização",
    ativo: true,
  });

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadUsuarios = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (includeInactive) params.set("includeInactive", "true");

      const response = await fetch(`/api/usuarios?${params.toString()}`, {
        cache: "no-store",
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Erro ao carregar usuários.");
      }

      setUsuarios(data.usuarios ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar usuários.");
    } finally {
      setLoading(false);
    }
  }, [search, includeInactive]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadUsuarios();
    }, 250);
    return () => clearTimeout(timer);
  }, [loadUsuarios]);

  function abrirNovo() {
    setEditingUser(null);
    setForm({
      nome: "",
      email: "",
      cargo: "",
      setor: "Implantação",
      perfil: "Implantação",
      ativo: true,
    });
    setError("");
    setModalOpen(true);
  }

  function abrirEdicao(u: Usuario) {
    setEditingUser(u);
    setForm({
      nome: u.nome,
      email: u.email ?? "",
      cargo: u.cargo ?? "",
      setor: u.setor ?? "Implantação",
      perfil: u.perfil ?? "Visualização",
      ativo: u.ativo,
    });
    setError("");
    setModalOpen(true);
  }

  async function salvar() {
    try {
      setSaving(true);
      setError("");

      if (!form.nome.trim()) {
        throw new Error("O nome do usuário é obrigatório.");
      }

      const url = editingUser ? `/api/usuarios/${editingUser.id}` : "/api/usuarios";
      const method = editingUser ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Erro ao salvar usuário.");
      }

      setSuccess(editingUser ? "Usuário atualizado!" : "Usuário cadastrado!");
      setModalOpen(false);
      await loadUsuarios();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleAtivo(u: Usuario) {
    try {
      setSaving(true);
      const response = await fetch(`/api/usuarios/${u.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ativo: !u.ativo }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Erro ao alterar status.");
      }

      await loadUsuarios();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao alterar status.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#05080d] text-slate-200 p-6 lg:p-10">
      <div className="mx-auto max-w-[1500px]">
        {/* HEADER */}
        <header className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b border-white/[0.06] pb-6">
          <div>
            <Link href="/" className="mb-3 inline-flex items-center gap-2 text-xs text-slate-500 hover:text-white">
              <ChevronLeft size={14} /> Control Tower
            </Link>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-sky-400/20 bg-sky-400/10 text-sky-300">
                <Users size={22} />
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-white">Usuários & Equipe</h1>
                <p className="text-xs text-slate-500">Gestão de integrantes, cargos e permissões de acesso.</p>
              </div>
            </div>
          </div>

          {can("administrar") && (
            <button
              onClick={abrirNovo}
              className="flex h-11 items-center gap-2 rounded-xl bg-sky-500 px-5 text-xs font-semibold text-slate-950 transition hover:bg-sky-400"
            >
              <Plus size={16} /> Novo Usuário
            </button>
          )}
        </header>

        {error && (
          <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-xs text-red-300">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 flex items-center gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-xs text-emerald-300">
            <CheckCircle2 size={16} /> {success}
          </div>
        )}

        {/* TABELA / CONTROLES */}
        <div className="overflow-hidden rounded-3xl border border-white/[0.06] bg-[#080d16]/80 backdrop-blur-md">
          <div className="flex flex-col gap-4 p-5 border-b border-white/[0.06] md:flex-row md:items-center md:justify-between">
            <div className="relative max-w-md flex-1">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nome, e-mail, setor..."
                className="h-10 w-full rounded-xl border border-white/[0.08] bg-white/[0.03] pl-10 pr-4 text-xs text-white outline-none focus:border-sky-500/40"
              />
            </div>

            <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                checked={includeInactive}
                onChange={(e) => setIncludeInactive(e.target.checked)}
                className="rounded border-white/10 bg-white/5 accent-sky-400"
              />
              Mostrar inativos
            </label>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-xs">
              <thead className="border-b border-white/[0.06] bg-white/[0.01] text-[10px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="p-4">Usuário / E-mail</th>
                  <th className="p-4">Cargo</th>
                  <th className="p-4">Setor</th>
                  <th className="p-4">Perfil</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500">Carregando usuários...</td>
                  </tr>
                ) : usuarios.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500">Nenhum usuário encontrado.</td>
                  </tr>
                ) : (
                  usuarios.map((u) => (
                    <tr key={u.id} className="hover:bg-white/[0.02]">
                      <td className="p-4">
                        <div className="font-semibold text-white">{u.nome}</div>
                        <div className="text-[10px] text-slate-500">{u.email || "Sem e-mail"}</div>
                      </td>
                      <td className="p-4 text-slate-300">
                        <div className="flex items-center gap-1.5">
                          <Briefcase size={12} className="text-slate-500" />
                          {u.cargo || "—"}
                        </div>
                      </td>
                      <td className="p-4 text-slate-300">
                        <div className="flex items-center gap-1.5">
                          <Building size={12} className="text-slate-500" />
                          {u.setor || "—"}
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="inline-flex items-center gap-1 rounded-lg border border-sky-400/20 bg-sky-400/10 px-2.5 py-1 text-[10px] font-semibold text-sky-300">
                          <ShieldCheck size={11} /> {u.perfil}
                        </span>
                      </td>
                      <td className="p-4">
                        {u.ativo ? (
                          <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-400">Ativo</span>
                        ) : (
                          <span className="rounded-full bg-slate-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-slate-500">Inativo</span>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        {can("administrar") && (
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => abrirEdicao(u)}
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
                              title="Editar"
                            >
                              <Edit3 size={14} />
                            </button>
                            <button
                              onClick={() => toggleAtivo(u)}
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-amber-400"
                              title={u.ativo ? "Inativar" : "Ativar"}
                            >
                              <Power size={14} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* MODAL CADASTRAR / EDITAR */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-white/[0.09] bg-[#090e17] p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-4">
              <h3 className="text-lg font-semibold text-white">
                {editingUser ? "Editar Usuário" : "Novo Usuário"}
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-500 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase text-slate-500">Nome completo *</label>
                <input
                  type="text"
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  placeholder="Ex.: Carlos Felipe"
                  className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5 text-xs text-white outline-none focus:border-sky-500/40"
                />
              </div>

              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase text-slate-500">E-mail corporativo</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="exemplo@wmsexpert.com.br"
                  className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5 text-xs text-white outline-none focus:border-sky-500/40"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase text-slate-500">Cargo</label>
                  <input
                    type="text"
                    value={form.cargo}
                    onChange={(e) => setForm({ ...form, cargo: e.target.value })}
                    placeholder="Ex.: Dev Lead"
                    className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5 text-xs text-white outline-none focus:border-sky-500/40"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase text-slate-500">Setor</label>
                  <select
                    value={form.setor}
                    onChange={(e) => setForm({ ...form, setor: e.target.value })}
                    className="w-full rounded-xl border border-white/[0.08] bg-[#090e17] px-3 py-2.5 text-xs text-slate-200 outline-none focus:border-sky-500/40"
                  >
                    {SETORES_OPCOES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase text-slate-500">Perfil de Acesso</label>
                <select
                  value={form.perfil}
                  onChange={(e) => setForm({ ...form, perfil: e.target.value })}
                  className="w-full rounded-xl border border-white/[0.08] bg-[#090e17] px-3 py-2.5 text-xs text-slate-200 outline-none focus:border-sky-500/40"
                >
                  {PERFIS_OPCOES.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2 border-t border-white/[0.06] pt-4">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-xl border border-white/[0.08] px-4 py-2 text-xs font-medium text-slate-300 hover:bg-white/[0.05]"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={salvar}
                className="rounded-xl bg-sky-500 px-5 py-2 text-xs font-semibold text-slate-950 hover:bg-sky-400 disabled:opacity-50"
              >
                {saving ? "Salvando..." : "Salvar Usuário"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}