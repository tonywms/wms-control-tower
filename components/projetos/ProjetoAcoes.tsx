"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  Check,
  CheckCircle2,
  ListTodo,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  UserRound,
} from "lucide-react";
import AcaoModal, { type AcaoProjeto } from "./AcaoModal";

type Props = {
  projetoId: string;
  onChanged?: (acoes: AcaoProjeto[]) => void;
};

const fmt = (v?: string | null) =>
  !v
    ? "Sem prazo"
    : new Intl.DateTimeFormat("pt-BR").format(new Date(`${v}T12:00:00`));

const encerrada = (a: AcaoProjeto) =>
  a.status === "Concluída" || a.status === "Cancelada";

const vencida = (a: AcaoProjeto) =>
  !!a.prazo &&
  !encerrada(a) &&
  new Date(`${a.prazo}T23:59:59`).getTime() < Date.now();

const hoje = (a: AcaoProjeto) => {
  if (!a.prazo || encerrada(a)) return false;
  const agora = new Date();
  const y = agora.getFullYear();
  const m = String(agora.getMonth() + 1).padStart(2, "0");
  const d = String(agora.getDate()).padStart(2, "0");
  return a.prazo === `${y}-${m}-${d}`;
};

export default function ProjetoAcoes({ projetoId, onChanged }: Props) {
  const [acoes, setAcoes] = useState<AcaoProjeto[]>([]);
  const [responsaveis, setResponsaveis] = useState<{ id: string; nome: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [open, setOpen] = useState(false);
  const [editando, setEditando] = useState<AcaoProjeto | null>(null);
  const [concluindoId, setConcluindoId] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      setLoading(true);
      setErro("");

      const [a, o] = await Promise.all([
        fetch(`/api/projetos/${projetoId}/acoes`, { cache: "no-store" }),
        fetch("/api/opcoes", { cache: "no-store" }),
      ]);

      const ar = await a.json();
      const or = await o.json();

      if (!a.ok || !ar.success) {
        throw new Error(ar.error || "Erro ao carregar ações.");
      }

      const lista = (ar.acoes ?? []) as AcaoProjeto[];
      setAcoes(lista);
      onChanged?.(lista);

      if (o.ok && or.success) {
        setResponsaveis(or.responsaveis ?? []);
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao carregar ações.");
    } finally {
      setLoading(false);
    }
  }, [projetoId, onChanged]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const stats = useMemo(
    () => ({
      abertas: acoes.filter((x) => !encerrada(x)).length,
      concluidas: acoes.filter((x) => x.status === "Concluída").length,
      vencidas: acoes.filter(vencida).length,
    }),
    [acoes],
  );

  const listaOrdenada = useMemo(
    () =>
      [...acoes].sort((a, b) => {
        if (encerrada(a) !== encerrada(b)) return encerrada(a) ? 1 : -1;
        if (vencida(a) !== vencida(b)) return vencida(a) ? -1 : 1;
        if (!!a.prazo !== !!b.prazo) return a.prazo ? -1 : 1;
        if (a.prazo && b.prazo && a.prazo !== b.prazo) {
          return a.prazo.localeCompare(b.prazo);
        }
        return (Number(a.ordem) || 0) - (Number(b.ordem) || 0);
      }),
    [acoes],
  );

  const ordem = useMemo(
    () =>
      acoes.length
        ? Math.max(...acoes.map((x) => Number(x.ordem) || 0)) + 1
        : 1,
    [acoes],
  );

  async function concluir(a: AcaoProjeto) {
    if (encerrada(a)) return;

    try {
      setConcluindoId(a.id);
      setErro("");

      const r = await fetch(`/api/projetos/${projetoId}/acoes/${a.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Concluída" }),
      });

      const j = await r.json();
      if (!r.ok || !j.success) {
        throw new Error(j.error || "Não foi possível concluir a ação.");
      }

      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao concluir ação.");
    } finally {
      setConcluindoId(null);
    }
  }

  async function excluir(a: AcaoProjeto) {
    if (!confirm(`Excluir a ação "${a.titulo}"?`)) return;

    const r = await fetch(`/api/projetos/${projetoId}/acoes/${a.id}`, {
      method: "DELETE",
    });
    const j = await r.json();

    if (!r.ok || !j.success) {
      setErro(j.error || "Erro ao excluir.");
      return;
    }

    await carregar();
  }

  return (
    <>
      <section className="rounded-[22px] border border-white/[.07] bg-white/[.025] p-5">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[.16em] text-slate-500">
              Execução
            </div>
            <h3 className="mt-1 flex items-center gap-2 text-base font-bold text-white">
              <ListTodo size={17} className="text-sky-400" />
              Plano de ação executivo
            </h3>
            <p className="mt-1 text-[11px] text-slate-600">
              Próximos passos, responsáveis e prazos do projeto.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void carregar()}
              disabled={loading}
              className="rounded-xl border border-white/[.08] p-2.5 text-slate-400 transition hover:bg-white/[.05] hover:text-white disabled:opacity-50"
              title="Atualizar ações"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            </button>
            <button
              type="button"
              onClick={() => {
                setEditando(null);
                setOpen(true);
              }}
              className="flex items-center gap-2 rounded-xl bg-sky-400 px-3.5 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-sky-300"
            >
              <Plus size={17} />
              Nova ação
            </button>
          </div>
        </div>

        <div className="mb-5 grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-white/[.06] bg-black/15 p-3">
            <b className="text-xl text-white">{stats.abertas}</b>
            <div className="text-[10px] uppercase text-slate-500">Abertas</div>
          </div>
          <div className="rounded-xl border border-emerald-400/10 bg-emerald-500/[.04] p-3">
            <b className="text-xl text-emerald-300">{stats.concluidas}</b>
            <div className="text-[10px] uppercase text-slate-500">Concluídas</div>
          </div>
          <div className="rounded-xl border border-rose-400/10 bg-rose-500/[.04] p-3">
            <b className="text-xl text-rose-300">{stats.vencidas}</b>
            <div className="text-[10px] uppercase text-slate-500">Vencidas</div>
          </div>
        </div>

        {erro && (
          <div className="mb-3 flex gap-2 rounded-xl border border-rose-400/20 bg-rose-500/10 p-3 text-xs text-rose-200">
            <AlertTriangle size={15} />
            {erro}
          </div>
        )}

        {loading && acoes.length === 0 ? (
          <div className="flex justify-center p-6 text-slate-500">
            <Loader2 className="animate-spin" />
          </div>
        ) : acoes.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/[.08] p-6 text-center text-sm text-slate-500">
            Nenhuma próxima ação cadastrada.
          </div>
        ) : (
          <div className="space-y-3">
            {listaOrdenada.map((a) => {
              const isVencida = vencida(a);
              const isHoje = hoje(a);
              const isEncerrada = encerrada(a);

              return (
                <article
                  key={a.id}
                  className={`rounded-xl border p-4 transition ${
                    isVencida
                      ? "border-rose-400/25 bg-rose-500/[.06]"
                      : isHoje
                        ? "border-amber-400/20 bg-amber-500/[.045]"
                        : isEncerrada
                          ? "border-emerald-400/10 bg-emerald-500/[.025] opacity-70"
                          : "border-white/[.07] bg-black/10"
                  }`}
                >
                  <div className="flex justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <b className="text-sm text-white">{a.titulo}</b>

                        {isVencida && (
                          <span className="rounded-md border border-rose-400/25 bg-rose-500/10 px-2 py-1 text-[10px] font-bold text-rose-300">
                            Vencida
                          </span>
                        )}

                        {isHoje && (
                          <span className="rounded-md border border-amber-400/25 bg-amber-500/10 px-2 py-1 text-[10px] font-bold text-amber-300">
                            Vence hoje
                          </span>
                        )}

                        <span className="rounded-md border border-white/[.08] px-2 py-1 text-[10px] text-slate-300">
                          {a.status}
                        </span>
                        <span className="rounded-md border border-white/[.08] px-2 py-1 text-[10px] text-slate-400">
                          {a.prioridade}
                        </span>
                      </div>

                      {a.descricao && (
                        <p className="mt-2 text-xs leading-5 text-slate-500">
                          {a.descricao}
                        </p>
                      )}

                      <div className="mt-3 flex flex-wrap gap-4 text-[11px] text-slate-500">
                        <span className="flex items-center gap-1">
                          <UserRound size={12} />
                          {a.responsavel?.nome ?? "Sem responsável"}
                        </span>
                        <span
                          className={`flex items-center gap-1 ${
                            isVencida
                              ? "text-rose-300"
                              : isHoje
                                ? "text-amber-300"
                                : ""
                          }`}
                        >
                          <CalendarDays size={12} />
                          {fmt(a.prazo)}
                        </span>
                        {a.status === "Concluída" && (
                          <span className="flex items-center gap-1 text-emerald-400">
                            <CheckCircle2 size={12} />
                            Concluída
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-start gap-1">
                      {!isEncerrada && (
                        <button
                          type="button"
                          onClick={() => void concluir(a)}
                          disabled={concluindoId === a.id}
                          className="rounded-lg p-2 text-slate-500 transition hover:bg-emerald-500/[.08] hover:text-emerald-300 disabled:opacity-50"
                          title="Concluir ação"
                        >
                          {concluindoId === a.id ? (
                            <Loader2 size={15} className="animate-spin" />
                          ) : (
                            <Check size={15} />
                          )}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setEditando(a);
                          setOpen(true);
                        }}
                        className="rounded-lg p-2 text-slate-500 transition hover:bg-sky-500/[.08] hover:text-sky-300"
                        title="Editar ação"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => void excluir(a)}
                        className="rounded-lg p-2 text-slate-500 transition hover:bg-rose-500/[.08] hover:text-rose-300"
                        title="Excluir ação"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <AcaoModal
        projetoId={projetoId}
        acao={editando}
        open={open}
        responsaveis={responsaveis}
        proximaOrdem={ordem}
        onClose={() => {
          setOpen(false);
          setEditando(null);
        }}
        onSaved={carregar}
      />
    </>
  );
}
