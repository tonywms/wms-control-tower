"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Loader2, Save, X } from "lucide-react";

export type Pendencia = {
  id: string;
  projeto_id: string;
  titulo: string;
  descricao?: string | null;
  tipo: "Pendência" | "Impedimento";
  prioridade: "Baixa" | "Normal" | "Alta" | "Crítica";
  status: "Pendente" | "Em andamento" | "Concluída" | "Cancelada";
  responsavel_id?: string | null;
  prazo?: string | null;
  concluida_em?: string | null;
  criado_por?: string | null;
  created_at: string;
  updated_at: string;
  responsavel?: { id: string; nome: string } | null;
  criador?: { id: string; nome: string } | null;
};

type Responsavel = {
  id: string;
  nome: string;
};

type Props = {
  projetoId: string;
  pendencia: Pendencia | null;
  open: boolean;
  responsaveis: Responsavel[];
  onClose: () => void;
  onSaved: () => void | Promise<void>;
};

const TIPOS = ["Pendência", "Impedimento"] as const;
const PRIORIDADES = ["Baixa", "Normal", "Alta", "Crítica"] as const;
const STATUS = ["Pendente", "Em andamento", "Concluída", "Cancelada"] as const;

export default function PendenciaModal({
  projetoId,
  pendencia,
  open,
  responsaveis,
  onClose,
  onSaved,
}: Props) {
  const [form, setForm] = useState({
    titulo: "",
    descricao: "",
    tipo: "Pendência",
    prioridade: "Normal",
    status: "Pendente",
    responsavel_id: "",
    prazo: "",
  });
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (!open) return;

    setErro("");
    setForm({
      titulo: pendencia?.titulo ?? "",
      descricao: pendencia?.descricao ?? "",
      tipo: pendencia?.tipo ?? "Pendência",
      prioridade: pendencia?.prioridade ?? "Normal",
      status: pendencia?.status ?? "Pendente",
      responsavel_id: pendencia?.responsavel_id ?? "",
      prazo: pendencia?.prazo ?? "",
    });
  }, [open, pendencia]);

  if (!open) return null;

  async function salvar() {
    if (!form.titulo.trim()) {
      setErro("Informe o título da pendência.");
      return;
    }

    try {
      setLoading(true);
      setErro("");

      const url = pendencia
        ? `/api/projetos/${projetoId}/pendencias/${pendencia.id}`
        : `/api/projetos/${projetoId}/pendencias`;

      const response = await fetch(url, {
        method: pendencia ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          titulo: form.titulo.trim(),
          descricao: form.descricao.trim() || null,
          tipo: form.tipo,
          prioridade: form.prioridade,
          status: form.status,
          responsavel_id: form.responsavel_id || null,
          prazo: form.prazo || null,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Não foi possível salvar a pendência.");
      }

      await onSaved();
      onClose();
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Erro inesperado ao salvar a pendência.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div
        className="w-full max-w-2xl overflow-hidden rounded-[24px] border border-sky-400/20 bg-[#080f1f] shadow-2xl shadow-black/70"
        style={{ animation: "none", transition: "none" }}
      >
        <header className="flex items-start justify-between border-b border-white/[0.07] px-6 py-5">
          <div>
            <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.18em] text-sky-400">
              Control Tower • Projeto 360
            </div>
            <h2 className="text-xl font-bold text-white">
              {pendencia ? "Editar pendência" : "Nova pendência"}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-2 text-slate-400 transition hover:bg-white/[0.07] hover:text-white"
            title="Fechar"
          >
            <X size={18} />
          </button>
        </header>

        <div className="max-h-[calc(100dvh-190px)] overflow-y-auto p-6">
          {erro && (
            <div className="mb-5 flex items-start gap-3 rounded-2xl border border-rose-400/20 bg-rose-500/10 p-4 text-sm text-rose-200">
              <AlertTriangle className="mt-0.5 shrink-0" size={18} />
              <span>{erro}</span>
            </div>
          )}

          <div className="space-y-5">
            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                Título *
              </span>
              <input
                value={form.titulo}
                maxLength={200}
                onChange={(e) =>
                  setForm((atual) => ({ ...atual, titulo: e.target.value }))
                }
                placeholder="Ex.: Ajustar retorno da API"
                className="w-full rounded-xl border border-white/[0.08] bg-white/[0.035] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-sky-400/50"
              />
            </label>

            <div className="grid gap-4 md:grid-cols-3">
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                  Tipo
                </span>
                <select
                  value={form.tipo}
                  onChange={(e) =>
                    setForm((atual) => ({ ...atual, tipo: e.target.value }))
                  }
                  className="w-full rounded-xl border border-white/[0.08] bg-[#0b1426] px-4 py-3 text-sm text-white outline-none focus:border-sky-400/50"
                >
                  {TIPOS.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                  Prioridade
                </span>
                <select
                  value={form.prioridade}
                  onChange={(e) =>
                    setForm((atual) => ({
                      ...atual,
                      prioridade: e.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-white/[0.08] bg-[#0b1426] px-4 py-3 text-sm text-white outline-none focus:border-sky-400/50"
                >
                  {PRIORIDADES.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                  Status
                </span>
                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm((atual) => ({ ...atual, status: e.target.value }))
                  }
                  className="w-full rounded-xl border border-white/[0.08] bg-[#0b1426] px-4 py-3 text-sm text-white outline-none focus:border-sky-400/50"
                >
                  {STATUS.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                  Responsável
                </span>
                <select
                  value={form.responsavel_id}
                  onChange={(e) =>
                    setForm((atual) => ({
                      ...atual,
                      responsavel_id: e.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-white/[0.08] bg-[#0b1426] px-4 py-3 text-sm text-white outline-none focus:border-sky-400/50"
                >
                  <option value="">Não definido</option>
                  {responsaveis.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.nome}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                  Prazo
                </span>
                <input
                  type="date"
                  value={form.prazo}
                  onChange={(e) =>
                    setForm((atual) => ({ ...atual, prazo: e.target.value }))
                  }
                  className="w-full rounded-xl border border-white/[0.08] bg-white/[0.035] px-4 py-3 text-sm text-white outline-none focus:border-sky-400/50"
                />
              </label>
            </div>

            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                Descrição
              </span>
              <textarea
                value={form.descricao}
                rows={5}
                onChange={(e) =>
                  setForm((atual) => ({ ...atual, descricao: e.target.value }))
                }
                placeholder="Descreva o que precisa ser resolvido..."
                className="w-full resize-none rounded-xl border border-white/[0.08] bg-white/[0.035] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-sky-400/50"
              />
            </label>
          </div>
        </div>

        <footer className="flex justify-end gap-3 border-t border-white/[0.07] px-6 py-4">
          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-white/[0.07] hover:text-white disabled:opacity-50"
          >
            Cancelar
          </button>

          <button
            type="button"
            disabled={loading || !form.titulo.trim()}
            onClick={() => void salvar()}
            className="flex items-center gap-2 rounded-xl bg-sky-400 px-4 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-sky-300 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? (
              <Loader2 className="animate-spin" size={17} />
            ) : (
              <Save size={17} />
            )}
            {loading ? "Salvando..." : "Salvar"}
          </button>
        </footer>
      </div>
    </div>
  );
}
