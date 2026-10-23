"use client";

import {
  AlertTriangle,
  Bell,
  BellRing,
  Check,
  CheckCheck,
  ChevronRight,
  Clock3,
  RefreshCw,
  ShieldAlert,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Severidade = "Crítico" | "Atenção" | "Informação";
type Aba = "alertas" | "notificacoes";
type FiltroAlerta = "Todos" | "Críticos" | "Atenção";
type FiltroNotificacao = "Todas" | "Críticas" | "Não lidas";

type Notificacao = {
  id: string;
  projeto_id: string | null;
  projeto_nome: string | null;
  tipo: string;
  severidade: Severidade;
  titulo: string;
  descricao: string | null;
  lida: boolean;
  created_at: string | null;
};

type Alerta = {
  id: string;
  projeto_id: string | null;
  projeto_nome: string | null;
  tipo: string;
  severidade: "Crítico" | "Atenção";
  titulo: string;
  descricao: string | null;
  prazo: string | null;
};

type ResumoAlertas = {
  total: number;
  criticos: number;
  atencao: number;
};

type Props = {
  onOpenProjeto: (projetoId: string) => void | Promise<void>;
};

function normalizarNotificacoes(payload: any): Notificacao[] {
  const lista = payload?.notificacoes ?? payload?.items ?? payload?.data ?? [];

  if (!Array.isArray(lista)) return [];

  return lista.map((n: any, i: number) => ({
    id: String(
      n.id ?? `${n.projeto_id ?? "global"}-${n.tipo ?? "notificacao"}-${i}`,
    ),
    projeto_id: n.projeto_id ? String(n.projeto_id) : null,
    projeto_nome: n.projeto_nome ?? n.projeto?.nome ?? null,
    tipo: String(n.tipo ?? "Notificação"),
    severidade:
      n.severidade === "Crítico" || n.severidade === "Atenção"
        ? n.severidade
        : "Informação",
    titulo: String(n.titulo ?? n.mensagem ?? "Notificação"),
    descricao: n.descricao ?? n.mensagem ?? null,
    lida: Boolean(n.lida ?? n.read ?? false),
    created_at: n.created_at ?? n.criado_em ?? null,
  }));
}

function normalizarAlertas(payload: any): Alerta[] {
  const lista = payload?.alertas ?? [];

  if (!Array.isArray(lista)) return [];

  return lista
    .filter(
      (a: any) =>
        a?.severidade === "Crítico" || a?.severidade === "Atenção",
    )
    .map((a: any, i: number) => ({
      id: String(
        a.id ?? `${a.projeto_id ?? "global"}-${a.tipo ?? "alerta"}-${i}`,
      ),
      projeto_id: a.projeto_id ? String(a.projeto_id) : null,
      projeto_nome: a.projeto_nome ?? a.projeto?.nome ?? null,
      tipo: String(a.tipo ?? "Alerta"),
      severidade: a.severidade,
      titulo: String(a.titulo ?? a.descricao ?? "Alerta executivo"),
      descricao: a.descricao ?? null,
      prazo: a.prazo ?? null,
    }));
}

function tempo(data: string | null) {
  if (!data) return "";

  const t = new Date(data).getTime();

  if (Number.isNaN(t)) return "";

  const m = Math.max(0, Math.floor((Date.now() - t) / 60000));

  if (m < 1) return "Agora";
  if (m < 60) return `Há ${m} min`;

  const h = Math.floor(m / 60);

  if (h < 24) return `Há ${h}h`;

  return `Há ${Math.floor(h / 24)}d`;
}

function formatarPrazo(data: string | null) {
  if (!data) return "";

  const partes = data.split("-");

  if (partes.length !== 3) return data;

  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

export default function NotificationCenter({ onOpenProjeto }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");

  const [aba, setAba] = useState<Aba>("alertas");

  const [filtroAlerta, setFiltroAlerta] =
    useState<FiltroAlerta>("Todos");

  const [filtroNotificacao, setFiltroNotificacao] =
    useState<FiltroNotificacao>("Todas");

  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [alertas, setAlertas] = useState<Alerta[]>([]);

  const [resumoAlertas, setResumoAlertas] = useState<ResumoAlertas>({
    total: 0,
    criticos: 0,
    atencao: 0,
  });

  const ref = useRef<HTMLDivElement | null>(null);

  const carregar = useCallback(async (silencioso = false) => {
    try {
      if (!silencioso) setLoading(true);

      setErro("");

      const [responseAlertas, responseNotificacoes] = await Promise.all([
        fetch("/api/alertas/executivos", {
          cache: "no-store",
        }),
        fetch("/api/notificacoes", {
          cache: "no-store",
        }),
      ]);

      const [dataAlertas, dataNotificacoes] = await Promise.all([
        responseAlertas.json().catch(() => null),
        responseNotificacoes.json().catch(() => null),
      ]);

      if (!responseAlertas.ok || dataAlertas?.success === false) {
        throw new Error(
          dataAlertas?.error || "Erro ao carregar alertas executivos.",
        );
      }

      if (
        !responseNotificacoes.ok ||
        dataNotificacoes?.success === false
      ) {
        throw new Error(
          dataNotificacoes?.error || "Erro ao carregar notificações.",
        );
      }

      const alertasNormalizados = normalizarAlertas(dataAlertas);

      setAlertas(alertasNormalizados);

      setResumoAlertas(
        dataAlertas?.resumo ?? {
          total: alertasNormalizados.length,
          criticos: alertasNormalizados.filter(
            a => a.severidade === "Crítico",
          ).length,
          atencao: alertasNormalizados.filter(
            a => a.severidade === "Atenção",
          ).length,
        },
      );

      setNotificacoes(normalizarNotificacoes(dataNotificacoes));
    } catch (e) {
      setErro(
        e instanceof Error
          ? e.message
          : "Erro ao carregar a Central de Notificações.",
      );
    } finally {
      if (!silencioso) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void carregar();

    const timer = window.setInterval(
      () => void carregar(true),
      60000,
    );

    return () => window.clearInterval(timer);
  }, [carregar]);

  useEffect(() => {
    const fechar = (event: MouseEvent) => {
      if (
        open &&
        ref.current &&
        !ref.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", fechar);

    return () => document.removeEventListener("mousedown", fechar);
  }, [open]);

  const naoLidas = useMemo(
    () => notificacoes.filter(n => !n.lida).length,
    [notificacoes],
  );

  const alertasVisiveis = useMemo(() => {
    if (filtroAlerta === "Críticos") {
      return alertas.filter(a => a.severidade === "Crítico");
    }

    if (filtroAlerta === "Atenção") {
      return alertas.filter(a => a.severidade === "Atenção");
    }

    return alertas;
  }, [alertas, filtroAlerta]);

  const notificacoesVisiveis = useMemo(() => {
    if (filtroNotificacao === "Críticas") {
      return notificacoes.filter(n => n.severidade === "Crítico");
    }

    if (filtroNotificacao === "Não lidas") {
      return notificacoes.filter(n => !n.lida);
    }

    return notificacoes;
  }, [notificacoes, filtroNotificacao]);

  async function marcarLida(n: Notificacao) {
    if (n.lida) return;

    try {
      const response = await fetch("/api/notificacoes", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: n.id,
          lida: true,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || data?.success === false) {
        throw new Error(
          data?.error || "Erro ao marcar notificação como lida.",
        );
      }

      setNotificacoes(atual =>
        atual.map(x =>
          x.id === n.id ? { ...x, lida: true } : x,
        ),
      );

      setErro("");
    } catch (e) {
      setErro(
        e instanceof Error
          ? e.message
          : "Erro ao marcar notificação como lida.",
      );
    }
  }

  async function marcarTodas() {
    if (!naoLidas) return;

    try {
      const response = await fetch("/api/notificacoes", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          todas: true,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || data?.success === false) {
        throw new Error(
          data?.error || "Erro ao marcar todas as notificações como lidas.",
        );
      }

      setNotificacoes(atual =>
        atual.map(x => ({ ...x, lida: true })),
      );

      setErro("");
    } catch (e) {
      setErro(
        e instanceof Error
          ? e.message
          : "Erro ao marcar todas as notificações como lidas.",
      );
    }
  }
  async function abrirNotificacao(n: Notificacao) {
    await marcarLida(n);

    if (n.projeto_id) {
      setOpen(false);
      await onOpenProjeto(n.projeto_id);
    }
  }

  async function abrirAlerta(a: Alerta) {
    if (a.projeto_id) {
      setOpen(false);
      await onOpenProjeto(a.projeto_id);
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="Notificações"
        onClick={() => setOpen(v => !v)}
        className={`relative flex h-9 w-9 items-center justify-center rounded-xl border transition ${
          open
            ? "border-sky-400/25 bg-sky-400/[0.10] text-sky-200"
            : "border-white/[0.06] bg-white/[0.025] text-slate-500 hover:text-sky-200"
        }`}
      >
        {naoLidas ? <BellRing size={16} /> : <Bell size={16} />}

        {naoLidas > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-[#070a10] bg-red-500 px-1 text-[8px] font-bold text-white">
            {naoLidas > 99 ? "99+" : naoLidas}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-[2px] sm:absolute sm:inset-auto sm:right-0 sm:top-[calc(100%+12px)] sm:bg-transparent sm:backdrop-blur-none">
          <div className="absolute inset-y-0 right-0 flex w-[min(500px,100vw)] flex-col border-l border-sky-400/15 bg-[#07101d]/98 shadow-[-24px_0_70px_rgba(0,0,0,.6)] sm:relative sm:max-h-[82vh] sm:overflow-hidden sm:rounded-2xl sm:border">
            <div className="border-b border-white/[0.06] p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[.16em] text-sky-300">
                    <BellRing size={13} />
                    Central de notificações
                  </div>

                  <h3 className="mt-2 text-lg font-semibold text-white">
                    Suas exceções executivas
                  </h3>

                  <p className="mt-1 text-[10px] text-slate-500">
                    Alertas ativos e histórico de notificações da
                    operação.
                  </p>
                </div>

                <button
                  onClick={() => setOpen(false)}
                  className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-2 text-slate-500 hover:text-white"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="mt-4 grid grid-cols-4 gap-2">
                <Resumo
                  label="Alertas"
                  value={resumoAlertas.total}
                  tone="sky"
                />

                <Resumo
                  label="Críticos"
                  value={resumoAlertas.criticos}
                  tone="red"
                />

                <Resumo
                  label="Atenção"
                  value={resumoAlertas.atencao}
                  tone="amber"
                />

                <Resumo
                  label="Não lidas"
                  value={naoLidas}
                  tone="slate"
                />
              </div>

              <div className="mt-4 flex rounded-xl border border-white/[0.06] bg-black/20 p-1">
                <button
                  type="button"
                  onClick={() => setAba("alertas")}
                  className={`flex-1 rounded-lg px-3 py-2 text-[9px] font-semibold transition ${
                    aba === "alertas"
                      ? "bg-sky-400/[0.10] text-sky-200"
                      : "text-slate-600 hover:text-slate-300"
                  }`}
                >
                  Alertas ativos · {resumoAlertas.total}
                </button>

                <button
                  type="button"
                  onClick={() => setAba("notificacoes")}
                  className={`flex-1 rounded-lg px-3 py-2 text-[9px] font-semibold transition ${
                    aba === "notificacoes"
                      ? "bg-violet-400/[0.10] text-violet-200"
                      : "text-slate-600 hover:text-slate-300"
                  }`}
                >
                  Histórico · {notificacoes.length}
                </button>
              </div>

              {aba === "alertas" ? (
                <div className="mt-3 flex items-center gap-2">
                  {(
                    ["Todos", "Críticos", "Atenção"] as FiltroAlerta[]
                  ).map(f => (
                    <button
                      key={f}
                      onClick={() => setFiltroAlerta(f)}
                      className={`rounded-lg border px-3 py-1.5 text-[9px] ${
                        filtroAlerta === f
                          ? "border-sky-400/20 bg-sky-400/[0.09] text-sky-200"
                          : "border-white/[0.05] text-slate-600"
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="mt-3 flex items-center gap-2">
                  {(
                    [
                      "Todas",
                      "Críticas",
                      "Não lidas",
                    ] as FiltroNotificacao[]
                  ).map(f => (
                    <button
                      key={f}
                      onClick={() => setFiltroNotificacao(f)}
                      className={`rounded-lg border px-3 py-1.5 text-[9px] ${
                        filtroNotificacao === f
                          ? "border-violet-400/20 bg-violet-400/[0.09] text-violet-200"
                          : "border-white/[0.05] text-slate-600"
                      }`}
                    >
                      {f}
                    </button>
                  ))}

                  <button
                    onClick={() => void marcarTodas()}
                    disabled={!naoLidas}
                    className="ml-auto flex items-center gap-1.5 text-[9px] text-slate-600 hover:text-emerald-300 disabled:opacity-30"
                  >
                    <CheckCheck size={13} />
                    Ler todas
                  </button>
                </div>
              )}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {loading &&
              !alertas.length &&
              !notificacoes.length ? (
                <Estado
                  icon={
                    <RefreshCw
                      size={15}
                      className="animate-spin"
                    />
                  }
                  texto="Sincronizando Central..."
                />
              ) : erro &&
                !alertas.length &&
                !notificacoes.length ? (
                <Estado
                  icon={<AlertTriangle size={15} />}
                  texto={erro}
                />
              ) : aba === "alertas" ? (
                !alertasVisiveis.length ? (
                  <Estado
                    icon={<CheckCheck size={18} />}
                    texto="Nenhum alerta ativo neste filtro."
                  />
                ) : (
                  <div className="divide-y divide-white/[0.045]">
                    {alertasVisiveis.map(a => (
                      <div
                        key={a.id}
                        className="group p-4 hover:bg-white/[0.018]"
                      >
                        <div className="flex gap-3">
                          <Icone severidade={a.severidade} />

                          <button
                            disabled={!a.projeto_id}
                            onClick={() => void abrirAlerta(a)}
                            className="min-w-0 flex-1 text-left disabled:cursor-default"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="truncate text-[11px] font-semibold text-slate-200">
                                {a.projeto_nome ||
                                  "Control Tower"}
                              </span>

                              <Badge
                                severidade={a.severidade}
                                texto={a.tipo}
                              />
                            </div>

                            <div className="mt-1.5 text-[10px] font-medium text-slate-400">
                              {a.titulo}
                            </div>

                            {a.descricao && (
                              <div className="mt-1 line-clamp-2 text-[9px] leading-4 text-slate-600">
                                {a.descricao}
                              </div>
                            )}

                            <div className="mt-2 flex items-center gap-3 text-[8px] text-slate-700">
                              {a.prazo && (
                                <span className="flex items-center gap-1">
                                  <Clock3 size={10} />
                                  Prazo {formatarPrazo(a.prazo)}
                                </span>
                              )}

                              {a.projeto_id && (
                                <span className="flex items-center gap-1 text-sky-500/80">
                                  Abrir Projeto 360
                                  <ChevronRight size={10} />
                                </span>
                              )}
                            </div>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : !notificacoesVisiveis.length ? (
                <Estado
                  icon={<CheckCheck size={18} />}
                  texto="Nada pendente neste filtro."
                />
              ) : (
                <div className="divide-y divide-white/[0.045]">
                  {notificacoesVisiveis.map(n => (
                    <div
                      key={n.id}
                      className={`group p-4 hover:bg-white/[0.018] ${
                        !n.lida ? "bg-sky-400/[0.018]" : ""
                      }`}
                    >
                      <div className="flex gap-3">
                        <Icone severidade={n.severidade} />

                        <button
                          disabled={!n.projeto_id}
                          onClick={() =>
                            void abrirNotificacao(n)
                          }
                          className="min-w-0 flex-1 text-left disabled:cursor-default"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="truncate text-[11px] font-semibold text-slate-200">
                              {n.projeto_nome ||
                                "Control Tower"}
                            </span>

                            <Badge
                              severidade={n.severidade}
                              texto={n.tipo}
                            />

                            {!n.lida && (
                              <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
                            )}
                          </div>

                          <div className="mt-1.5 text-[10px] font-medium text-slate-400">
                            {n.titulo}
                          </div>

                          {n.descricao && (
                            <div className="mt-1 line-clamp-2 text-[9px] leading-4 text-slate-600">
                              {n.descricao}
                            </div>
                          )}

                          <div className="mt-2 flex items-center gap-3 text-[8px] text-slate-700">
                            {n.created_at && (
                              <span className="flex items-center gap-1">
                                <Clock3 size={10} />
                                {tempo(n.created_at)}
                              </span>
                            )}

                            {n.projeto_id && (
                              <span className="flex items-center gap-1 text-sky-500/80">
                                Abrir Projeto 360
                                <ChevronRight size={10} />
                              </span>
                            )}
                          </div>
                        </button>

                        {!n.lida && (
                          <button
                            title="Marcar como lida"
                            onClick={() => void marcarLida(n)}
                            className="self-start rounded-lg p-1.5 text-slate-700 opacity-0 hover:text-emerald-300 group-hover:opacity-100"
                          >
                            <Check size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-white/[0.06] px-4 py-3">
              <span className="text-[8px] text-slate-700">
                Atualização automática a cada 60 segundos
              </span>

              <button
                onClick={() => void carregar()}
                className="flex items-center gap-1.5 text-[9px] text-slate-600 hover:text-sky-300"
              >
                <RefreshCw size={11} />
                Atualizar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Icone({
  severidade,
}: {
  severidade: Severidade;
}) {
  const c =
    severidade === "Crítico"
      ? "bg-red-400/[.07] text-red-300"
      : severidade === "Atenção"
        ? "bg-amber-400/[.07] text-amber-300"
        : "bg-sky-400/[.07] text-sky-300";

  return (
    <div
      className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${c}`}
    >
      {severidade === "Crítico" ? (
        <ShieldAlert size={14} />
      ) : severidade === "Atenção" ? (
        <AlertTriangle size={14} />
      ) : (
        <Bell size={14} />
      )}
    </div>
  );
}

function Badge({
  severidade,
  texto,
}: {
  severidade: Severidade;
  texto: string;
}) {
  const c =
    severidade === "Crítico"
      ? "border-red-400/15 bg-red-400/[.05] text-red-300"
      : severidade === "Atenção"
        ? "border-amber-400/15 bg-amber-400/[.05] text-amber-300"
        : "border-sky-400/15 bg-sky-400/[.05] text-sky-300";

  return (
    <span className={`rounded-full border px-2 py-0.5 text-[8px] ${c}`}>
      {texto}
    </span>
  );
}

function Resumo({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "sky" | "red" | "amber" | "slate";
}) {
  const c =
    tone === "red"
      ? "border-red-400/10 bg-red-400/[.035] text-red-300"
      : tone === "amber"
        ? "border-amber-400/10 bg-amber-400/[.035] text-amber-300"
        : tone === "sky"
          ? "border-sky-400/10 bg-sky-400/[.035] text-sky-300"
          : "border-white/[.05] bg-white/[.02] text-slate-300";

  return (
    <div className={`rounded-xl border p-3 ${c}`}>
      <div className="text-lg font-semibold">{value}</div>
      <div className="mt-1 text-[8px] uppercase tracking-[.12em] opacity-60">
        {label}
      </div>
    </div>
  );
}

function Estado({
  icon,
  texto,
}: {
  icon: React.ReactNode;
  texto: string;
}) {
  return (
    <div className="flex min-h-[260px] items-center justify-center px-8 text-center text-[10px] text-slate-600">
      <div>
        <div className="mb-2 flex justify-center">{icon}</div>
        {texto}
      </div>
    </div>
  );
}