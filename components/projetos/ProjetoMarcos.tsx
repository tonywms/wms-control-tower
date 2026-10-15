"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Circle,
  Clock3,
  Flag,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  UserRound,
  XCircle,
} from "lucide-react";
import MarcoModal, { type Marco } from "./MarcoModal";

type Responsavel = {
  id: string;
  nome: string;
};

type Props = {
  projetoId: string;
  onChanged?: (marcos: Marco[]) => void;
};

function formatDate(value?: string | null) {
  if (!value) return "Não definida";
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR").format(date);
}

function marcoAtrasado(item: Marco) {
  if (!item.data_prevista) return false;
  if (item.status === "Concluído" || item.status === "Cancelado") return false;
  return new Date(`${item.data_prevista}T23:59:59`).getTime() < Date.now();
}

function StatusIcon({ marco }: { marco: Marco }) {
  if (marco.status === "Concluído") {
    return <CheckCircle2 size={18} className="text-emerald-400" />;
  }
  if (marco.status === "Cancelado") {
    return <XCircle size={18} className="text-slate-500" />;
  }
  if (marcoAtrasado(marco)) {
    return <AlertTriangle size={18} className="text-rose-400" />;
  }
  if (marco.status === "Em andamento") {
    return <Clock3 size={18} className="text-sky-400" />;
  }
  return <Circle size={18} className="text-slate-500" />;
}

function statusClass(item: Marco) {
  if (marcoAtrasado(item)) {
    return "border-rose-400/25 bg-rose-500/10 text-rose-300";
  }
  if (item.status === "Concluído") {
    return "border-emerald-400/25 bg-emerald-500/10 text-emerald-300";
  }
  if (item.status === "Em andamento") {
    return "border-sky-400/25 bg-sky-500/10 text-sky-300";
  }
  return "border-white/[0.08] bg-white/[0.03] text-slate-400";
}

export default function ProjetoMarcos({ projetoId, onChanged }: Props) {
  const [marcos, setMarcos] = useState<Marco[]>([]);
  const [responsaveis, setResponsaveis] = useState<Responsavel[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState<Marco | null>(null);
  const [excluindoId, setExcluindoId] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      setLoading(true);
      setErro("");

      const [marcosResponse, opcoesResponse] = await Promise.all([
        fetch(`/api/projetos/${projetoId}/marcos`, {
          cache: "no-store",
          credentials: "same-origin",
        }),
        fetch("/api/opcoes", {
          cache: "no-store",
          credentials: "same-origin",
        }),
      ]);

      const marcosResult = await marcosResponse.json();
      const opcoesResult = await opcoesResponse.json();

      if (!marcosResponse.ok || !marcosResult.success) {
        throw new Error(
          marcosResult.error || "Não foi possível carregar os marcos.",
        );
      }

      const lista = (marcosResult.marcos ?? []) as Marco[];
      setMarcos(lista);
      onChanged?.(lista);

      if (opcoesResponse.ok && opcoesResult.success) {
        setResponsaveis(opcoesResult.responsaveis ?? []);
      }
    } catch (error) {
      setMarcos([]);
      setErro(
        error instanceof Error
          ? error.message
          : "Erro inesperado ao carregar marcos.",
      );
    } finally {
      setLoading(false);
    }
  }, [projetoId, onChanged]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const contadores = useMemo(
    () => ({
      total: marcos.length,
      concluidos: marcos.filter((item) => item.status === "Concluído").length,
      atrasados: marcos.filter(marcoAtrasado).length,
    }),
    [marcos],
  );

  const proximaOrdem = useMemo(() => {
    if (marcos.length === 0) return 1;
    return Math.max(...marcos.map((item) => Number(item.ordem) || 0)) + 1;
  }, [marcos]);

  async function excluir(item: Marco) {
    const confirmar = window.confirm(
      `Excluir o marco "${item.nome}"? Esta ação não poderá ser desfeita.`,
    );
    if (!confirmar) return;

    try {
      setExcluindoId(item.id);
      setErro("");

      const response = await fetch(
        `/api/projetos/${projetoId}/marcos/${item.id}`,
        {
          method: "DELETE",
          credentials: "same-origin",
        },
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Não foi possível excluir o marco.");
      }

      await carregar();
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Erro inesperado ao excluir marco.",
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
              Cronograma
            </div>
            <h3 className="mt-1 flex items-center gap-2 text-base font-bold text-white">
              <Flag size={17} className="text-sky-400" />
              Marcos do projeto
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void carregar()}
              disabled={loading}
              className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-2.5 text-slate-400 transition hover:bg-white/[0.07] hover:text-white disabled:opacity-50"
              title="Atualizar marcos"
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
              Novo marco
            </button>
          </div>
        </div>

        <div className="mb-5 grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-white/[0.06] bg-black/15 px-3 py-3">
            <div className="text-xl font-bold text-white">{contadores.total}</div>
            <div className="text-[11px] uppercase tracking-wide text-slate-500">Total</div>
          </div>
          <div className="rounded-xl border border-emerald-400/10 bg-emerald-500/[0.04] px-3 py-3">
            <div className="text-xl font-bold text-emerald-300">{contadores.concluidos}</div>
            <div className="text-[11px] uppercase tracking-wide text-slate-500">Concluídos</div>
          </div>
          <div className="rounded-xl border border-rose-400/10 bg-rose-500/[0.04] px-3 py-3">
            <div className="text-xl font-bold text-rose-300">{contadores.atrasados}</div>
            <div className="text-[11px] uppercase tracking-wide text-slate-500">Atrasados</div>
          </div>
        </div>

        {erro && (
          <div className="mb-4 flex items-start gap-3 rounded-xl border border-rose-400/20 bg-rose-500/10 p-3 text-sm text-rose-200">
            <AlertTriangle className="mt-0.5 shrink-0" size={17} />
            <span>{erro}</span>
          </div>
        )}

        {loading && marcos.length === 0 ? (
          <div className="flex min-h-28 items-center justify-center gap-2 text-sm text-slate-500">
            <Loader2 className="animate-spin" size={17} />
            Carregando marcos...
          </div>
        ) : marcos.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/[0.08] bg-black/10 px-4 py-7 text-center">
            <Flag className="mx-auto mb-2 text-sky-400/70" size={25} />
            <div className="text-sm font-semibold text-slate-300">
              Nenhum marco cadastrado
            </div>
            <div className="mt-1 text-xs text-slate-600">
              Use “Novo marco” para montar o cronograma do projeto.
            </div>
          </div>
        ) : (
          <div className="relative">
            <div className="absolute bottom-4 left-[9px] top-4 w-px bg-white/[0.08]" />

            <div className="space-y-3">
              {marcos.map((item) => {
                const atrasado = marcoAtrasado(item);

                return (
                  <article key={item.id} className="relative pl-8">
                    <div className="absolute left-0 top-4 z-10 rounded-full bg-[#0b1326]">
                      <StatusIcon marco={item} />
                    </div>

                    <div className="rounded-xl border border-white/[0.07] bg-black/10 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="text-sm font-semibold text-white">
                              {item.nome}
                            </h4>

                            <span className={`rounded-md border px-2 py-1 text-[10px] font-semibold ${statusClass(item)}`}>
                              {atrasado ? "Atrasado" : item.status}
                            </span>
                          </div>

                          {item.descricao && (
                            <p className="mt-2 text-xs leading-5 text-slate-500">
                              {item.descricao}
                            </p>
                          )}

                          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-slate-500">
                            <span className="flex items-center gap-1">
                              <UserRound size={12} />
                              {item.responsavel?.nome ?? "Sem responsável"}
                            </span>

                            <span className={atrasado ? "flex items-center gap-1 font-semibold text-rose-300" : "flex items-center gap-1"}>
                              <CalendarDays size={12} />
                              Previsto: {formatDate(item.data_prevista)}
                            </span>

                            {item.data_realizada && (
                              <span className="flex items-center gap-1 text-emerald-400">
                                <CheckCircle2 size={12} />
                                Realizado: {formatDate(item.data_realizada)}
                              </span>
                            )}

                            <span>Ordem: {item.ordem}</span>
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
                            title="Editar marco"
                          >
                            <Pencil size={15} />
                          </button>

                          <button
                            type="button"
                            disabled={excluindoId === item.id}
                            onClick={() => void excluir(item)}
                            className="rounded-lg p-2 text-slate-500 transition hover:bg-rose-500/10 hover:text-rose-300 disabled:opacity-40"
                            title="Excluir marco"
                          >
                            {excluindoId === item.id ? (
                              <Loader2 size={15} className="animate-spin" />
                            ) : (
                              <Trash2 size={15} />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        )}
      </section>

      <MarcoModal
        projetoId={projetoId}
        marco={editando}
        open={modalOpen}
        responsaveis={responsaveis}
        proximaOrdem={proximaOrdem}
        onClose={() => {
          setModalOpen(false);
          setEditando(null);
        }}
        onSaved={carregar}
      />
    </>
  );
}
