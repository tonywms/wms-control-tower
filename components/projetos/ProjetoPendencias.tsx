"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertOctagon,
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  CircleDot,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  UserRound,
} from "lucide-react";
import PendenciaModal, { type Pendencia } from "./PendenciaModal";

type Responsavel = {
  id: string;
  nome: string;
};

type Props = {
  projetoId: string;
  onChanged?: (pendencias: Pendencia[]) => void;
};

function formatDate(value?: string | null) {
  if (!value) return "Sem prazo";

  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("pt-BR").format(date);
}

function vencida(item: Pendencia) {
  if (!item.prazo) return false;
  if (item.status === "Concluída" || item.status === "Cancelada") return false;

  const prazo = new Date(`${item.prazo}T23:59:59`);
  return prazo.getTime() < Date.now();
}

function prioridadeClass(prioridade: Pendencia["prioridade"]) {
  if (prioridade === "Crítica") return "border-rose-400/25 bg-rose-500/10 text-rose-200";
  if (prioridade === "Alta") return "border-amber-400/25 bg-amber-500/10 text-amber-200";
  if (prioridade === "Baixa") return "border-slate-400/20 bg-slate-500/10 text-slate-300";
  return "border-sky-400/20 bg-sky-500/10 text-sky-200";
}

function statusClass(status: Pendencia["status"]) {
  if (status === "Concluída") return "border-emerald-400/25 bg-emerald-500/10 text-emerald-200";
  if (status === "Cancelada") return "border-slate-400/20 bg-slate-500/10 text-slate-400";
  if (status === "Em andamento") return "border-sky-400/25 bg-sky-500/10 text-sky-200";
  return "border-amber-400/25 bg-amber-500/10 text-amber-200";
}

export default function ProjetoPendencias({ projetoId, onChanged }: Props) {
  const [pendencias, setPendencias] = useState<Pendencia[]>([]);
  const [responsaveis, setResponsaveis] = useState<Responsavel[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState<Pendencia | null>(null);
  const [excluindoId, setExcluindoId] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      setLoading(true);
      setErro("");

      const [pendenciasResponse, opcoesResponse] = await Promise.all([
        fetch(`/api/projetos/${projetoId}/pendencias`, {
          cache: "no-store",
          credentials: "same-origin",
        }),
        fetch("/api/opcoes", {
          cache: "no-store",
          credentials: "same-origin",
        }),
      ]);

      const pendenciasResult = await pendenciasResponse.json();
      const opcoesResult = await opcoesResponse.json();

      if (!pendenciasResponse.ok || !pendenciasResult.success) {
        throw new Error(
          pendenciasResult.error || "Não foi possível carregar as pendências.",
        );
      }

      const lista = (pendenciasResult.pendencias ?? []) as Pendencia[];
      setPendencias(lista);
      onChanged?.(lista);

      if (opcoesResponse.ok && opcoesResult.success) {
        setResponsaveis(opcoesResult.responsaveis ?? []);
      }
    } catch (error) {
      setPendencias([]);
      setErro(
        error instanceof Error
          ? error.message
          : "Erro inesperado ao carregar pendências.",
      );
    } finally {
      setLoading(false);
    }
  }, [projetoId, onChanged]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const contadores = useMemo(() => {
    const abertas = pendencias.filter(
      (item) => item.status !== "Concluída" && item.status !== "Cancelada",
    );
    return {
      abertas: abertas.length,
      impedimentos: abertas.filter((item) => item.tipo === "Impedimento").length,
      vencidas: abertas.filter(vencida).length,
    };
  }, [pendencias]);

  async function excluir(item: Pendencia) {
    const confirmar = window.confirm(
      `Excluir a pendência "${item.titulo}"? Esta ação não poderá ser desfeita.`,
    );
    if (!confirmar) return;

    try {
      setExcluindoId(item.id);
      setErro("");

      const response = await fetch(
        `/api/projetos/${projetoId}/pendencias/${item.id}`,
        {
          method: "DELETE",
          credentials: "same-origin",
        },
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Não foi possível excluir a pendência.");
      }

      await carregar();
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Erro inesperado ao excluir pendência.",
      );
    } finally {
      setExcluindoId(null);
    }
  }

  return (
    <>
      <section className="rounded-[22px] border border-white/[0.07] bg-white/[0.025] p-5">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
              Execução
            </div>
            <h3 className="mt-1 text-base font-bold text-white">
              Pendências e impedimentos
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void carregar()}
              disabled={loading}
              className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-2.5 text-slate-400 transition hover:bg-white/[0.07] hover:text-white disabled:opacity-50"
              title="Atualizar pendências"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            </button>

            <button
              type="button"
              onClick={() => {
                setEditando(null);
                setModalOpen(true);
              }}
              className="flex items-center gap-2 rounded-xl bg-sky-400 px-3.5 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-sky-300"
            >
              <Plus size={17} />
              Nova
            </button>
          </div>
        </div>

        <div className="mb-5 grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-white/[0.06] bg-black/15 px-3 py-3">
            <div className="text-xl font-bold text-white">{contadores.abertas}</div>
            <div className="text-[11px] uppercase tracking-wide text-slate-500">Abertas</div>
          </div>
          <div className="rounded-xl border border-rose-400/10 bg-rose-500/[0.04] px-3 py-3">
            <div className="text-xl font-bold text-rose-300">{contadores.impedimentos}</div>
            <div className="text-[11px] uppercase tracking-wide text-slate-500">Impedimentos</div>
          </div>
          <div className="rounded-xl border border-amber-400/10 bg-amber-500/[0.04] px-3 py-3">
            <div className="text-xl font-bold text-amber-300">{contadores.vencidas}</div>
            <div className="text-[11px] uppercase tracking-wide text-slate-500">Vencidas</div>
          </div>
        </div>

        {erro && (
          <div className="mb-4 flex items-start gap-3 rounded-xl border border-rose-400/20 bg-rose-500/10 p-3 text-sm text-rose-200">
            <AlertTriangle className="mt-0.5 shrink-0" size={17} />
            <span>{erro}</span>
          </div>
        )}

        {loading && pendencias.length === 0 ? (
          <div className="flex min-h-28 items-center justify-center gap-2 text-sm text-slate-500">
            <Loader2 className="animate-spin" size={17} />
            Carregando pendências...
          </div>
        ) : pendencias.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/[0.08] bg-black/10 px-4 py-7 text-center">
            <CheckCircle2 className="mx-auto mb-2 text-emerald-400/70" size={25} />
            <div className="text-sm font-semibold text-slate-300">Nenhuma pendência cadastrada</div>
            <div className="mt-1 text-xs text-slate-600">
              Use “Nova” para registrar uma pendência ou impedimento.
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {pendencias.map((item) => {
              const estaVencida = vencida(item);
              const concluida = item.status === "Concluída";

              return (
                <article
                  key={item.id}
                  className={`rounded-xl border p-4 ${
                    concluida
                      ? "border-emerald-400/10 bg-emerald-500/[0.025]"
                      : item.tipo === "Impedimento"
                        ? "border-rose-400/15 bg-rose-500/[0.035]"
                        : "border-white/[0.07] bg-black/10"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {item.tipo === "Impedimento" ? (
                          <AlertOctagon size={16} className="shrink-0 text-rose-400" />
                        ) : (
                          <CircleDot size={16} className="shrink-0 text-sky-400" />
                        )}

                        <h4 className={`text-sm font-semibold ${concluida ? "text-slate-400 line-through" : "text-white"}`}>
                          {item.titulo}
                        </h4>

                        {estaVencida && (
                          <span className="rounded-md border border-rose-400/25 bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-rose-300">
                            Vencida
                          </span>
                        )}
                      </div>

                      {item.descricao && (
                        <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">
                          {item.descricao}
                        </p>
                      )}

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className={`rounded-md border px-2 py-1 text-[10px] font-semibold ${prioridadeClass(item.prioridade)}`}>
                          {item.prioridade}
                        </span>
                        <span className={`rounded-md border px-2 py-1 text-[10px] font-semibold ${statusClass(item.status)}`}>
                          {item.status}
                        </span>

                        <span className="flex items-center gap-1 text-[11px] text-slate-500">
                          <UserRound size={12} />
                          {item.responsavel?.nome ?? "Sem responsável"}
                        </span>

                        <span className={`flex items-center gap-1 text-[11px] ${estaVencida ? "font-semibold text-rose-300" : "text-slate-500"}`}>
                          <CalendarDays size={12} />
                          {formatDate(item.prazo)}
                        </span>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditando(item);
                          setModalOpen(true);
                        }}
                        className="rounded-lg p-2 text-slate-500 transition hover:bg-white/[0.06] hover:text-sky-300"
                        title="Editar pendência"
                      >
                        <Pencil size={15} />
                      </button>

                      <button
                        type="button"
                        disabled={excluindoId === item.id}
                        onClick={() => void excluir(item)}
                        className="rounded-lg p-2 text-slate-500 transition hover:bg-rose-500/10 hover:text-rose-300 disabled:opacity-40"
                        title="Excluir pendência"
                      >
                        {excluindoId === item.id ? (
                          <Loader2 size={15} className="animate-spin" />
                        ) : (
                          <Trash2 size={15} />
                        )}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <PendenciaModal
        projetoId={projetoId}
        pendencia={editando}
        open={modalOpen}
        responsaveis={responsaveis}
        onClose={() => {
          setModalOpen(false);
          setEditando(null);
        }}
        onSaved={carregar}
      />
    </>
  );
}
