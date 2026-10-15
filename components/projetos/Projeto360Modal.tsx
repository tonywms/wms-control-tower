"use client";

import { useEffect, useMemo, useState } from "react";
import ProjetoPendencias from "./ProjetoPendencias";
import ProjetoMarcos from "./ProjetoMarcos";
import type { Marco } from "./MarcoModal";
import ProjetoAcoes from "./ProjetoAcoes";
import type { AcaoProjeto } from "./AcaoModal";
import type { Pendencia } from "./PendenciaModal";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  CircleDot,
  History,
  Layers3,
  Loader2,
  Monitor,
  Pencil,
  RefreshCw,
  UserRound,
  X,
} from "lucide-react";

type Projeto = {
  id: string;
  nome: string;
  plataforma?: string | null;
  etapa_id?: string | null;
  setor?: string | null;
  responsavel_id?: string | null;
  responsavel_nome?: string | null;
  status: string;
  prioridade: string;
  data_inicio?: string | null;
  data_fim?: string | null;
  observacoes?: string | null;
  fase_origem?: string | null;
  percentual: number;
  created_at?: string | null;
  updated_at?: string | null;
  cliente?: {
    id: string;
    nome: string;
    cidade?: string | null;
  } | null;
  etapa?: {
    id: string;
    nome: string;
    ordem?: number;
  } | null;
};

type HistoricoItem = {
  id: string;
  tipo: "alteracao" | "status";
  campo: string;
  valor_anterior: string | null;
  valor_novo: string | null;
  motivo: string | null;
  usuario_nome: string;
  created_at: string;
};

type Projeto360ModalProps = {
  projeto: Projeto | null;
  open: boolean;
  onClose: () => void;
  onEdit: (projeto: Projeto) => void;
};

function formatDate(value?: string | null) {
  if (!value) return "Não definida";

  const date = new Date(
    value.includes("T") ? value : `${value}T12:00:00`,
  );

  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("pt-BR").format(date);
}

function formatDateTime(value?: string | null) {
  if (!value) return "Não informada";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function valueText(value: string | null) {
  if (value === null || value === "") {
    return "Não informado";
  }

  return value;
}

function calcularDiasAte(value?: string | null) {
  if (!value) return null;

  const target = new Date(`${value}T12:00:00`);
  const now = new Date();

  const today = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    12,
  );

  return Math.ceil(
    (target.getTime() - today.getTime()) / 86400000,
  );
}

export default function Projeto360Modal({
  projeto,
  open,
  onClose,
  onEdit,
}: Projeto360ModalProps) {
  const [historico, setHistorico] = useState<
    HistoricoItem[]
  >([]);

  const [loadingHistorico, setLoadingHistorico] =
    useState(false);

  const [erroHistorico, setErroHistorico] =
    useState("");

  const [pendenciasProjeto, setPendenciasProjeto] = useState<
    Pendencia[]
  >([]);

  const [marcosProjeto, setMarcosProjeto] = useState<Marco[]>([]);
  const [acoesProjeto, setAcoesProjeto] = useState<AcaoProjeto[]>([]);

  useEffect(() => {
    if (!open || !projeto) {
      return;
    }

    let cancelado = false;

    async function carregar() {
      try {
        setLoadingHistorico(true);
        setErroHistorico("");

        const response = await fetch(
          `/api/projetos/${projeto.id}/historico`,
          {
            cache: "no-store",
            credentials: "same-origin",
          },
        );

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(
            result.error ||
              "Não foi possível carregar o histórico.",
          );
        }

        if (!cancelado) {
          setHistorico(result.historico ?? []);
        }
      } catch (error) {
        if (!cancelado) {
          setHistorico([]);

          setErroHistorico(
            error instanceof Error
              ? error.message
              : "Erro ao carregar histórico.",
          );
        }
      } finally {
        if (!cancelado) {
          setLoadingHistorico(false);
        }
      }
    }

    setHistorico([]);
    void carregar();

    return () => {
      cancelado = true;
    };
  }, [open, projeto]);

  async function atualizarHistorico() {
    if (!projeto) return;

    try {
      setLoadingHistorico(true);
      setErroHistorico("");

      const response = await fetch(
        `/api/projetos/${projeto.id}/historico`,
        {
          cache: "no-store",
          credentials: "same-origin",
        },
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error ||
            "Não foi possível carregar o histórico.",
        );
      }

      setHistorico(result.historico ?? []);
    } catch (error) {
      setErroHistorico(
        error instanceof Error
          ? error.message
          : "Erro ao carregar histórico.",
      );
    } finally {
      setLoadingHistorico(false);
    }
  }

  const diasAtePrazo = useMemo(
    () => calcularDiasAte(projeto?.data_fim),
    [projeto?.data_fim],
  );

  if (!open || !projeto) {
    return null;
  }

  const projetoEncerrado =
    projeto.status === "Finalizado" ||
    projeto.status === "Cancelado";

  const atrasado =
    diasAtePrazo !== null &&
    diasAtePrazo < 0 &&
    !projetoEncerrado;

  const pendenciasAbertas = pendenciasProjeto.filter(
    (item) =>
      item.status !== "Concluída" &&
      item.status !== "Cancelada",
  );

  const pendenciaEstaVencida = (item: Pendencia) => {
    if (!item.prazo) return false;

    const prazo = new Date(`${item.prazo}T23:59:59`);
    return prazo.getTime() < Date.now();
  };

  const impedimentoCritico = pendenciasAbertas.some(
    (item) =>
      item.tipo === "Impedimento" &&
      (item.prioridade === "Crítica" ||
        pendenciaEstaVencida(item)),
  );

  const pendenciaVencida = pendenciasAbertas.some(
    (item) =>
      item.tipo === "Pendência" &&
      pendenciaEstaVencida(item),
  );

  const impedimentoAberto = pendenciasAbertas.some(
    (item) => item.tipo === "Impedimento",
  );

  const marcoEstaAtrasado = (item: Marco) => {
    if (!item.data_prevista) return false;
    if (item.status === "Concluído" || item.status === "Cancelado") {
      return false;
    }

    const prazo = new Date(`${item.data_prevista}T23:59:59`);
    return prazo.getTime() < Date.now();
  };

  const marcoAtrasado = marcosProjeto.some(marcoEstaAtrasado);

  const acaoEstaVencida = (item: AcaoProjeto) => {
    if (!item.prazo) return false;
    if (item.status === "Concluída" || item.status === "Cancelada") {
      return false;
    }

    const prazo = new Date(`${item.prazo}T23:59:59`);
    return prazo.getTime() < Date.now();
  };

  const acaoVencida = acoesProjeto.some(acaoEstaVencida);

  const precisaAtencao =
    projeto.status === "Bloqueado" ||
    projeto.status === "Pausado" ||
    atrasado ||
    pendenciaVencida ||
    impedimentoAberto ||
    marcoAtrasado ||
    acaoVencida;

  const saudeProjeto = impedimentoCritico
    ? "Crítico"
    : precisaAtencao
      ? "Atenção"
      : "Estável";

  const saudeHelper = impedimentoCritico
    ? "Impedimento crítico ou vencido"
    : projeto.status === "Bloqueado"
      ? "Projeto bloqueado"
      : projeto.status === "Pausado"
        ? "Projeto pausado"
        : atrasado
          ? "Prazo do projeto vencido"
          : pendenciaVencida
            ? "Existe pendência vencida"
            : impedimentoAberto
              ? "Existe impedimento aberto"
              : marcoAtrasado
                ? "Existe marco do cronograma atrasado"
                : acaoVencida
                  ? "Existe próxima ação vencida"
                  : "Sem alerta crítico";

  const formatarDataAlerta = (data?: string | null) => {
    if (!data) return "";
    return new Intl.DateTimeFormat("pt-BR").format(
      new Date(`${data}T12:00:00`),
    );
  };

  const alertasGerenciais: string[] = [];

  if (impedimentoCritico) {
    const itens = pendenciasAbertas.filter(
      (item) =>
        item.tipo === "Impedimento" &&
        (item.prioridade === "Crítica" || pendenciaEstaVencida(item)),
    );

    itens.forEach((item) => {
      const detalhe = pendenciaEstaVencida(item) && item.prazo
        ? `, vencido em ${formatarDataAlerta(item.prazo)}`
        : item.prioridade === "Crítica"
          ? ", prioridade crítica"
          : "";

      alertasGerenciais.push(`Impedimento "${item.titulo}"${detalhe}.`);
    });
  }

  if (projeto.status === "Bloqueado") {
    alertasGerenciais.push(
      "O projeto está bloqueado e precisa de atuação para voltar ao fluxo.",
    );
  }

  if (projeto.status === "Pausado") {
    alertasGerenciais.push(
      "O projeto está pausado. Verifique o motivo e a previsão de retomada.",
    );
  }

  if (atrasado) {
    alertasGerenciais.push(
      "A data final do projeto já passou e o projeto ainda não foi encerrado.",
    );
  }

  pendenciasAbertas
    .filter((item) => item.tipo === "Pendência" && pendenciaEstaVencida(item))
    .forEach((item) => {
      alertasGerenciais.push(
        `Pendência "${item.titulo}" venceu em ${formatarDataAlerta(item.prazo)}.`,
      );
    });

  pendenciasAbertas
    .filter(
      (item) =>
        item.tipo === "Impedimento" &&
        !(
          item.prioridade === "Crítica" ||
          pendenciaEstaVencida(item)
        ),
    )
    .forEach((item) => {
      alertasGerenciais.push(`Impedimento "${item.titulo}" está aberto.`);
    });

  marcosProjeto
    .filter(marcoEstaAtrasado)
    .forEach((item) => {
      alertasGerenciais.push(
        `Marco "${item.nome}" está atrasado desde ${formatarDataAlerta(item.data_prevista)}.`,
      );
    });

  acoesProjeto
    .filter(acaoEstaVencida)
    .forEach((item) => {
      alertasGerenciais.push(
        `Ação "${item.titulo}" venceu em ${formatarDataAlerta(item.prazo)}.`,
      );
    });

  const etapaAtual =
    projeto.etapa?.nome ||
    projeto.fase_origem ||
    "Sem etapa";

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center overflow-hidden bg-black/75 p-4 backdrop-blur-sm">
      <div className="flex h-[calc(100dvh-48px)] w-[min(1024px,calc(100vw-48px))] shrink-0 flex-col overflow-hidden rounded-[26px] border border-sky-400/25 bg-[#070d1b] shadow-2xl shadow-black/70"
        style={{ animation: "none", transition: "none" }}>
        {/* CABEÇALHO */}
        <div className="shrink-0 border-b border-white/[0.07] bg-gradient-to-r from-sky-500/[0.08] via-indigo-500/[0.06] to-violet-500/[0.07] px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-sky-400">
                Control Tower • Projeto 360
              </div>

              <div className="mt-1 flex flex-wrap items-center gap-3">
                <h2 className="truncate text-2xl font-semibold text-white">
                  {projeto.nome}
                </h2>

                <span className="rounded-full border border-amber-400/20 bg-amber-500/[0.08] px-2.5 py-1 text-[10px] font-semibold text-amber-300">
                  {projeto.prioridade}
                </span>
              </div>

              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span>
                  {projeto.cliente?.nome ??
                    "Cliente não informado"}
                </span>

                <span>•</span>

                <span>
                  {projeto.plataforma ??
                    "Sem plataforma"}
                </span>

                <span>•</span>

                <span>
                  {projeto.setor ?? "Sem setor"}
                </span>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => onEdit(projeto)}
                className="flex items-center gap-2 rounded-xl border border-sky-400/20 bg-sky-500/[0.08] px-3.5 py-2.5 text-xs font-semibold text-sky-300 transition hover:bg-sky-500/[0.14]"
              >
                <Pencil size={14} />
                Editar
              </button>

              <button
                type="button"
                onClick={onClose}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-slate-400 transition hover:bg-white/[0.07] hover:text-white"
                aria-label="Fechar"
              >
                <X size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* CONTEÚDO */}
        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          {/* INDICADORES */}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric
              icon={Layers3}
              label="Etapa atual"
              value={etapaAtual}
              helper={projeto.status}
            />

            <Metric
              icon={UserRound}
              label="Responsável"
              value={
                projeto.responsavel_nome ??
                "Sem responsável"
              }
              helper={
                projeto.setor ??
                "Setor não informado"
              }
            />

            <Metric
              icon={CalendarDays}
              label="Prazo"
              value={formatDate(projeto.data_fim)}
              helper={
                diasAtePrazo === null
                  ? "Sem previsão definida"
                  : diasAtePrazo < 0
                    ? `${Math.abs(
                        diasAtePrazo,
                      )} dia(s) em atraso`
                    : diasAtePrazo === 0
                      ? "Vence hoje"
                      : `${diasAtePrazo} dia(s) restante(s)`
              }
              danger={atrasado}
            />

            <Metric
              icon={Activity}
              label="Saúde"
              value={saudeProjeto}
              helper={saudeHelper}
              danger={saudeProjeto !== "Estável"}
            />
          </div>

          {/* PROGRESSO */}
          <section className="mt-4 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">
                  Andamento geral
                </div>

                <div className="mt-1 text-lg font-semibold text-white">
                  {projeto.percentual}% concluído
                </div>
              </div>

              <div className="text-right text-xs text-slate-500">
                <div>
                  Início:{" "}
                  {formatDate(projeto.data_inicio)}
                </div>

                <div className="mt-1">
                  Fim: {formatDate(projeto.data_fim)}
                </div>
              </div>
            </div>

            <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/[0.05]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-sky-400 to-cyan-300 transition-all"
                style={{
                  width: `${Math.min(
                    100,
                    Math.max(
                      0,
                      projeto.percentual ?? 0,
                    ),
                  )}%`,
                }}
              />
            </div>
          </section>

          <div className="mt-4 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
            {/* COLUNA ESQUERDA */}
            <div className="space-y-4">
              <section className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
                <div className="flex items-center gap-2">
                  <Monitor
                    size={15}
                    className="text-sky-400"
                  />

                  <h3 className="text-sm font-semibold text-white">
                    Situação atual
                  </h3>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <Info
                    label="Status"
                    value={projeto.status}
                  />

                  <Info
                    label="Prioridade"
                    value={projeto.prioridade}
                  />

                  <Info
                    label="Plataforma"
                    value={
                      projeto.plataforma ??
                      "Não informada"
                    }
                  />

                  <Info
                    label="Fase"
                    value={
                      projeto.fase_origem ??
                      "Não informada"
                    }
                  />
                </div>
              </section>

              <section className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
                <div className="flex items-center gap-2">
                  <CircleDot
                    size={15}
                    className="text-violet-400"
                  />

                  <h3 className="text-sm font-semibold text-white">
                    Contexto / próximos passos
                  </h3>
                </div>

                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-400">
                  {projeto.observacoes?.trim() ||
                    "Nenhuma observação registrada para este projeto."}
                </p>
              </section>

              <ProjetoPendencias
                projetoId={projeto.id}
                onChanged={setPendenciasProjeto}
              />

              <ProjetoMarcos
                projetoId={projeto.id}
                onChanged={setMarcosProjeto}
              />

              <ProjetoAcoes
                projetoId={projeto.id}
                onChanged={setAcoesProjeto}
              />

              {precisaAtencao && (
                <section className="rounded-2xl border border-amber-400/20 bg-amber-500/[0.06] p-5">
                  <div className="flex items-center gap-2 text-amber-300">
                    <AlertTriangle size={15} />

                    <h3 className="text-sm font-semibold">
                      Atenção gerencial
                    </h3>
                  </div>

                  <div className="mt-3 space-y-2">
                    {alertasGerenciais.map((alerta, index) => (
                      <div
                        key={`${alerta}-${index}`}
                        className="flex items-start gap-2 text-xs leading-5 text-amber-200/75"
                      >
                        <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-amber-300" />
                        <span>{alerta}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>

            {/* HISTÓRICO RECENTE */}
            <section className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <History
                      size={15}
                      className="text-sky-400"
                    />

                    <h3 className="text-sm font-semibold text-white">
                      Atividade recente
                    </h3>
                  </div>

                  <p className="mt-1 text-[11px] text-slate-600">
                    Últimas movimentações registradas
                    no projeto.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    void atualizarHistorico()
                  }
                  disabled={loadingHistorico}
                  className="flex items-center gap-1.5 rounded-lg border border-white/[0.07] bg-white/[0.03] px-2.5 py-2 text-[10px] text-slate-400 transition hover:text-white disabled:opacity-50"
                >
                  <RefreshCw
                    size={12}
                    className={
                      loadingHistorico
                        ? "animate-spin"
                        : ""
                    }
                  />

                  Atualizar
                </button>
              </div>

              {loadingHistorico &&
              historico.length === 0 ? (
                <div className="flex min-h-[260px] items-center justify-center text-sm text-slate-500">
                  <Loader2
                    size={16}
                    className="mr-2 animate-spin"
                  />

                  Carregando...
                </div>
              ) : erroHistorico ? (
                <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/[0.06] p-3 text-xs text-red-300">
                  {erroHistorico}
                </div>
              ) : historico.length === 0 ? (
                <div className="flex min-h-[260px] flex-col items-center justify-center text-center">
                  <History
                    size={25}
                    className="text-slate-700"
                  />

                  <div className="mt-3 text-sm text-slate-400">
                    Sem atividade registrada
                  </div>
                </div>
              ) : (
                <div className="mt-4 space-y-2.5">
                  {historico
                    .slice(0, 6)
                    .map((item) => (
                      <div
                        key={item.id}
                        className="rounded-xl border border-white/[0.06] bg-black/10 px-3.5 py-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-xs text-slate-300">
                              <span className="font-semibold text-white">
                                {item.usuario_nome ||
                                  "Sistema"}
                              </span>{" "}
                              alterou{" "}
                              <span
                                className={
                                  item.tipo ===
                                  "status"
                                    ? "text-violet-300"
                                    : "text-sky-300"
                                }
                              >
                                {item.campo}
                              </span>
                            </div>

                            <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px]">
                              <span className="rounded-md bg-white/[0.04] px-2 py-1 text-slate-500">
                                {valueText(
                                  item.valor_anterior,
                                )}
                              </span>

                              <ArrowRight
                                size={11}
                                className="text-slate-700"
                              />

                              <span className="rounded-md border border-emerald-400/10 bg-emerald-500/[0.06] px-2 py-1 text-emerald-300">
                                {valueText(
                                  item.valor_novo,
                                )}
                              </span>
                            </div>

                            {item.motivo && (
                              <div className="mt-2 text-[10px] leading-4 text-amber-300/70">
                                Motivo:{" "}
                                {item.motivo}
                              </div>
                            )}
                          </div>

                          <div className="shrink-0 text-[9px] text-slate-700">
                            {formatDateTime(
                              item.created_at,
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </section>
          </div>
        </div>

        {/* RODAPÉ */}
        <div className="flex shrink-0 items-center justify-between gap-4 border-t border-white/[0.07] px-6 py-4">
          <div className="flex items-center gap-2 text-[10px] text-slate-600">
            <CheckCircle2 size={13} />

            Última atualização:{" "}
            {formatDateTime(projeto.updated_at)}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-white/[0.06] hover:text-white"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  helper,
  danger = false,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  helper: string;
  danger?: boolean;
}) {
  return (
    <div
      className={[
        "rounded-2xl border p-4",
        danger
          ? "border-amber-400/20 bg-amber-500/[0.05]"
          : "border-white/[0.07] bg-white/[0.025]",
      ].join(" ")}
    >
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.13em] text-slate-600">
        <Icon
          size={13}
          className={
            danger
              ? "text-amber-400"
              : "text-sky-400"
          }
        />

        {label}
      </div>

      <div
        className={[
          "mt-2 truncate text-sm font-semibold",
          danger
            ? "text-amber-200"
            : "text-white",
        ].join(" ")}
      >
        {value}
      </div>

      <div className="mt-1 truncate text-[10px] text-slate-600">
        {helper}
      </div>
    </div>
  );
}

function Info({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-white/[0.05] bg-black/10 px-3 py-2.5">
      <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-700">
        {label}
      </div>

      <div className="mt-1 truncate text-xs font-medium text-slate-300">
        {value}
      </div>
    </div>
  );
}
