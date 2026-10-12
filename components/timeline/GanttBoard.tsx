"use client";

import { useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Clock3,
  Pencil,
  User,
} from "lucide-react";

type Projeto = {
  id: string;
  cliente_id: string;
  nome: string;
  plataforma: string | null;
  etapa_id: string | null;
  setor: string | null;
  responsavel_id: string | null;
  responsavel_nome: string | null;
  status: string;
  prioridade: string;
  data_inicio: string | null;
  data_fim: string | null;
  observacoes: string | null;
  fase_origem: string | null;
  percentual: number;
  created_at: string;
  updated_at: string;

  cliente: {
    id: string;
    nome: string;
    cidade: string | null;
  } | null;

  etapa: {
    id: string;
    nome: string;
    ordem: number;
  } | null;
};

type GanttBoardProps = {
  projetos: Projeto[];
  onEdit: (projeto: Projeto) => void;
};

type TimelineMonth = {
  date: Date;
  year: number;
  month: number;
  label: string;
  daysInMonth: number;
};

const DAY_MS = 1000 * 60 * 60 * 24;

const STATUS_STYLES: Record<
  string,
  {
    bar: string;
    fill: string;
    text: string;
    dot: string;
  }
> = {
  "Em andamento": {
    bar: "border-sky-400/30 bg-sky-950/50",
    fill: "bg-sky-500/70",
    text: "text-sky-300",
    dot: "bg-sky-400",
  },

  Planejado: {
    bar: "border-violet-400/30 bg-violet-950/40",
    fill: "bg-violet-500/65",
    text: "text-violet-300",
    dot: "bg-violet-400",
  },

  "Não iniciado": {
    bar: "border-slate-400/20 bg-slate-900/50",
    fill: "bg-slate-500/60",
    text: "text-slate-300",
    dot: "bg-slate-400",
  },

  Pausado: {
    bar: "border-amber-400/30 bg-amber-950/40",
    fill: "bg-amber-500/65",
    text: "text-amber-300",
    dot: "bg-amber-400",
  },

  Bloqueado: {
    bar: "border-red-400/30 bg-red-950/40",
    fill: "bg-red-500/65",
    text: "text-red-300",
    dot: "bg-red-400",
  },

  Finalizado: {
    bar: "border-emerald-400/30 bg-emerald-950/40",
    fill: "bg-emerald-500/65",
    text: "text-emerald-300",
    dot: "bg-emerald-400",
  },

  Cancelado: {
    bar: "border-rose-400/30 bg-rose-950/40",
    fill: "bg-rose-500/60",
    text: "text-rose-300",
    dot: "bg-rose-400",
  },
};

function parseDate(value: string | null) {
  if (!value) return null;

  const [year, month, day] = value.split("-").map(Number);

  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day)
  ) {
    return null;
  }

  return new Date(year, month - 1, day);
}

function startOfDay(date: Date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function formatShortDate(date: Date | null) {
  if (!date) return "Sem data";

  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
}

function formatLongDate(date: Date | null) {
  if (!date) return "Sem data";

  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function diffDays(start: Date, end: Date) {
  return Math.round(
    (startOfDay(end).getTime() - startOfDay(start).getTime()) / DAY_MS,
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getStatusStyle(status: string) {
  return (
    STATUS_STYLES[status] ?? {
      bar: "border-slate-400/20 bg-slate-900/50",
      fill: "bg-slate-500/60",
      text: "text-slate-300",
      dot: "bg-slate-400",
    }
  );
}

export default function GanttBoard({
  projetos,
  onEdit,
}: GanttBoardProps) {
  const [currentDate, setCurrentDate] = useState(() => {
    const today = new Date();

    return new Date(
      today.getFullYear(),
      today.getMonth(),
      1,
    );
  });

  const today = useMemo(() => {
    return startOfDay(new Date());
  }, []);

  /*
   * Timeline:
   *
   * mês anterior
   * mês atual
   * próximo mês
   * mês seguinte
   *
   * Mantemos uma janela de 4 meses para permitir
   * visualização operacional sem deixar a tela excessivamente larga.
   */
  const months = useMemo<TimelineMonth[]>(() => {
    const list: TimelineMonth[] = [];

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    for (let index = -1; index <= 2; index += 1) {
      const date = new Date(year, month + index, 1);

      list.push({
        date,
        year: date.getFullYear(),
        month: date.getMonth(),
        label: date
          .toLocaleDateString("pt-BR", {
            month: "short",
            year: "2-digit",
          })
          .replace(".", "")
          .toUpperCase(),
        daysInMonth: new Date(
          date.getFullYear(),
          date.getMonth() + 1,
          0,
        ).getDate(),
      });
    }

    return list;
  }, [currentDate]);

  const timelineStart = useMemo(() => {
    const first = months[0];

    return startOfDay(
      new Date(first.year, first.month, 1),
    );
  }, [months]);

  const timelineEnd = useMemo(() => {
    const last = months[months.length - 1];

    return startOfDay(
      new Date(
        last.year,
        last.month + 1,
        0,
      ),
    );
  }, [months]);

  const totalDays = useMemo(() => {
    return diffDays(timelineStart, timelineEnd) + 1;
  }, [timelineStart, timelineEnd]);

  const todayPosition = useMemo(() => {
    if (today < timelineStart || today > timelineEnd) {
      return null;
    }

    const daysFromStart = diffDays(
      timelineStart,
      today,
    );

    return ((daysFromStart + 0.5) / totalDays) * 100;
  }, [today, timelineStart, timelineEnd, totalDays]);

  function previousPeriod() {
    setCurrentDate(
      new Date(
        currentDate.getFullYear(),
        currentDate.getMonth() - 1,
        1,
      ),
    );
  }

  function nextPeriod() {
    setCurrentDate(
      new Date(
        currentDate.getFullYear(),
        currentDate.getMonth() + 1,
        1,
      ),
    );
  }

  function goToToday() {
    const now = new Date();

    setCurrentDate(
      new Date(
        now.getFullYear(),
        now.getMonth(),
        1,
      ),
    );
  }

  function calculateBarPosition(
    projeto: Projeto,
  ) {
    const inicio = parseDate(projeto.data_inicio);
    const fimOriginal = parseDate(projeto.data_fim);

    /*
     * Se não houver início nem fim,
     * não existe informação suficiente para posicionar
     * corretamente o projeto no Gantt.
     */
    if (!inicio && !fimOriginal) {
      return null;
    }

    /*
     * Se existir apenas uma data:
     * usamos a mesma data como início/fim.
     */
    const dataInicio = startOfDay(
      inicio ?? fimOriginal!,
    );

    const dataFim = startOfDay(
      fimOriginal ?? inicio!,
    );

    /*
     * Proteção contra registros inconsistentes:
     * caso fim < início, usamos início como fim.
     */
    const fimCorrigido =
      dataFim < dataInicio
        ? dataInicio
        : dataFim;

    /*
     * Projeto completamente fora da janela.
     */
    if (
      fimCorrigido < timelineStart ||
      dataInicio > timelineEnd
    ) {
      return null;
    }

    /*
     * Recortamos somente a parte visual da barra
     * que pertence à janela atualmente exibida.
     */
    const visualInicio =
      dataInicio < timelineStart
        ? timelineStart
        : dataInicio;

    const visualFim =
      fimCorrigido > timelineEnd
        ? timelineEnd
        : fimCorrigido;

    const startOffsetDays = diffDays(
      timelineStart,
      visualInicio,
    );

    const durationDays =
      diffDays(
        visualInicio,
        visualFim,
      ) + 1;

    const left =
      (startOffsetDays / totalDays) * 100;

    const width =
      (durationDays / totalDays) * 100;

    const percentual = clamp(
      Number(projeto.percentual) || 0,
      0,
      100,
    );

    const duracaoTotalDias =
      diffDays(dataInicio, fimCorrigido) + 1;

    return {
      left: `${left}%`,
      width: `${Math.max(width, 0.8)}%`,
      percentual,
      dataInicio,
      dataFim: fimCorrigido,
      duracaoTotalDias,
      cortadoInicio: dataInicio < timelineStart,
      cortadoFim: fimCorrigido > timelineEnd,
    };
  }

  function isAtrasado(projeto: Projeto) {
    const fim = parseDate(projeto.data_fim);

    if (!fim) return false;

    return (
      fim < today &&
      projeto.status !== "Finalizado" &&
      projeto.status !== "Cancelado"
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-3xl border border-white/[0.06] bg-[#080d16]/80 p-5 backdrop-blur-md">
      {/* HEADER */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.06] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-white">
              Gantt / Timeline Operational
            </h3>

            <span className="rounded-full border border-sky-400/20 bg-sky-400/[0.07] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-sky-300">
              Operacional
            </span>
          </div>

          <p className="mt-1 text-xs text-slate-500">
            Cronograma real dos projetos por data de início,
            previsão de término e progresso.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={goToToday}
            className="rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2 text-[11px] font-semibold text-slate-300 transition hover:border-white/[0.14] hover:bg-white/[0.05] hover:text-white"
          >
            Hoje
          </button>

          <div className="flex items-center gap-1 rounded-xl border border-white/[0.07] bg-white/[0.025] p-1">
            <button
              type="button"
              onClick={previousPeriod}
              aria-label="Período anterior"
              className="rounded-lg p-2 text-slate-400 transition hover:bg-white/[0.06] hover:text-white"
            >
              <ChevronLeft size={16} />
            </button>

            <span className="min-w-[145px] px-2 text-center text-xs font-semibold uppercase tracking-wider text-slate-300">
              {currentDate.toLocaleDateString(
                "pt-BR",
                {
                  month: "long",
                  year: "numeric",
                },
              )}
            </span>

            <button
              type="button"
              onClick={nextPeriod}
              aria-label="Próximo período"
              className="rounded-lg p-2 text-slate-400 transition hover:bg-white/[0.06] hover:text-white"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* LEGENDA */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[10px] text-slate-500">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-sky-400" />
          Em andamento
        </div>

        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-violet-400" />
          Planejado
        </div>

        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-amber-400" />
          Pausado
        </div>

        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-red-400" />
          Bloqueado
        </div>

        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          Finalizado
        </div>

        <div className="ml-auto flex items-center gap-2">
          <span className="h-3 w-px bg-sky-300" />
          Hoje
        </div>
      </div>

      {/* TIMELINE */}
      <div className="overflow-x-auto">
        <div className="min-w-[1080px]">
          {/* CABEÇALHO */}
          <div className="grid grid-cols-[310px_1fr] border-b border-white/[0.06] pb-3">
            <div className="flex items-end text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
              Projeto / Cliente
            </div>

            <div className="relative flex">
              {months.map((month) => (
                <div
                  key={`${month.year}-${month.month}`}
                  className="flex-1 border-l border-white/[0.06] pl-3 text-center text-[10px] font-bold uppercase tracking-wider text-slate-400"
                >
                  {month.label}
                </div>
              ))}
            </div>
          </div>

          {/* PROJETOS */}
          <div className="divide-y divide-white/[0.04]">
            {projetos.map((projeto) => {
              const pos =
                calculateBarPosition(projeto);

              const statusStyle =
                getStatusStyle(projeto.status);

              const atrasado =
                isAtrasado(projeto);

              const inicio =
                parseDate(projeto.data_inicio);

              const fim =
                parseDate(projeto.data_fim);

              return (
                <div
                  key={projeto.id}
                  className="group grid grid-cols-[310px_1fr] items-center py-3 transition hover:bg-white/[0.02]"
                >
                  {/* IDENTIFICAÇÃO */}
                  <div className="min-w-0 pr-5">
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-1.5 w-1.5 shrink-0 rounded-full ${statusStyle.dot}`}
                      />

                      <span className="truncate text-xs font-semibold text-white">
                        {projeto.nome}
                      </span>

                      <button
                        type="button"
                        onClick={() =>
                          onEdit(projeto)
                        }
                        aria-label={`Editar ${projeto.nome}`}
                        className="ml-auto shrink-0 rounded-lg p-1.5 text-slate-600 opacity-0 transition group-hover:opacity-100 hover:bg-white/[0.06] hover:text-white"
                      >
                        <Pencil size={13} />
                      </button>
                    </div>

                    <div className="mt-1 flex min-w-0 items-center gap-2 text-[10px] text-slate-500">
                      <span className="max-w-[150px] truncate text-sky-400">
                        {projeto.cliente?.nome ||
                          "Sem cliente"}
                      </span>

                      <span>•</span>

                      <span className="flex min-w-0 items-center gap-1 truncate">
                        <User size={10} />

                        <span className="truncate">
                          {projeto.responsavel_nome ||
                            "Sem responsável"}
                        </span>
                      </span>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {projeto.etapa?.nome && (
                        <span className="max-w-[130px] truncate rounded-md border border-white/[0.06] bg-white/[0.025] px-2 py-0.5 text-[9px] text-slate-400">
                          {projeto.etapa.nome}
                        </span>
                      )}

                      <span
                        className={`rounded-md border border-white/[0.05] px-2 py-0.5 text-[9px] ${statusStyle.text}`}
                      >
                        {projeto.status}
                      </span>

                      {atrasado && (
                        <span className="rounded-md border border-red-400/20 bg-red-400/[0.06] px-2 py-0.5 text-[9px] font-semibold text-red-300">
                          Atrasado
                        </span>
                      )}
                    </div>
                  </div>

                  {/* ÁREA DA TIMELINE */}
                  <div className="relative h-[68px] rounded-xl bg-white/[0.012]">
                    {/* GRADE MENSAL */}
                    <div className="absolute inset-0 flex">
                      {months.map((month) => (
                        <div
                          key={`${month.year}-${month.month}-grid`}
                          className="relative flex-1 border-l border-white/[0.035]"
                        >
                          {/* Pequenas divisões internas */}
                          <div className="absolute inset-0 grid grid-cols-7 opacity-40">
                            {Array.from({
                              length: 6,
                            }).map(
                              (_, index) => (
                                <div
                                  key={index}
                                  className="border-r border-white/[0.018]"
                                />
                              ),
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* LINHA DE HOJE */}
                    {todayPosition !== null && (
                      <div
                        className="absolute bottom-0 top-0 z-10 w-px bg-sky-300/70"
                        style={{
                          left: `${todayPosition}%`,
                        }}
                      >
                        <div className="absolute left-1/2 top-0 -translate-x-1/2 whitespace-nowrap rounded-md border border-sky-300/20 bg-sky-300/10 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-sky-300">
                          Hoje
                        </div>
                      </div>
                    )}

                    {/* SEM DATA */}
                    {!pos && (
                      <div className="absolute inset-0 flex items-center px-4">
                        <span className="rounded-lg border border-dashed border-white/[0.07] bg-white/[0.015] px-3 py-1.5 text-[10px] italic text-slate-600">
                          Sem período definido
                        </span>
                      </div>
                    )}

                    {/* BARRA DO PROJETO */}
                    {pos && (
                      <div
                        className={`absolute top-[24px] h-7 overflow-hidden rounded-lg border shadow-sm transition-all duration-300 group-hover:brightness-110 ${statusStyle.bar}`}
                        style={{
                          left: pos.left,
                          width: pos.width,
                          minWidth: "18px",
                        }}
                        title={[
                          projeto.nome,
                          `Início: ${formatLongDate(
                            pos.dataInicio,
                          )}`,
                          `Fim: ${formatLongDate(
                            pos.dataFim,
                          )}`,
                          `Duração: ${pos.duracaoTotalDias} ${
                            pos.duracaoTotalDias === 1
                              ? "dia"
                              : "dias"
                          }`,
                          `Progresso: ${pos.percentual}%`,
                          atrasado
                            ? "Status: ATRASADO"
                            : `Status: ${projeto.status}`,
                        ].join(" • ")}
                      >
                        {/* PROGRESSO */}
                        <div
                          className={`absolute inset-y-0 left-0 ${statusStyle.fill} transition-all duration-500`}
                          style={{
                            width: `${pos.percentual}%`,
                          }}
                        />

                        {/* CONTEÚDO */}
                        <div className="relative z-10 flex h-full items-center justify-between gap-2 px-2.5">
                          <span className="truncate text-[9px] font-bold text-white">
                            {pos.cortadoInicio
                              ? "← "
                              : ""}
                            {pos.percentual}%
                            {pos.cortadoFim
                              ? " →"
                              : ""}
                          </span>

                          {pos.duracaoTotalDias <=
                            45 && (
                            <span className="hidden shrink-0 items-center gap-1 text-[8px] font-medium text-white/70 sm:flex">
                              <Clock3
                                size={9}
                              />

                              {pos.duracaoTotalDias}d
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* MARCAÇÕES DE DATA */}
                    {pos && (
                      <>
                        <div
                          className="absolute bottom-1 text-[8px] text-slate-600"
                          style={{
                            left: pos.left,
                          }}
                        >
                          {formatShortDate(
                            pos.dataInicio,
                          )}
                        </div>

                        <div
                          className="absolute bottom-1 -translate-x-full text-[8px] text-slate-600"
                          style={{
                            left: `calc(${pos.left} + ${pos.width})`,
                          }}
                        >
                          {formatShortDate(
                            pos.dataFim,
                          )}
                        </div>
                      </>
                    )}

                    {/* DATA DE FIM FORA DA JANELA */}
                    {!pos &&
                      fim &&
                      fim < timelineStart && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] text-slate-600">
                          Encerrado antes da janela
                        </span>
                      )}

                    {!pos &&
                      inicio &&
                      inicio > timelineEnd && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] text-slate-600">
                          Início após a janela
                        </span>
                      )}
                  </div>
                </div>
              );
            })}

            {projetos.length === 0 && (
              <div className="py-16 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-white/[0.06] bg-white/[0.025]">
                  <Clock3
                    size={20}
                    className="text-slate-600"
                  />
                </div>

                <p className="mt-3 text-sm font-medium text-slate-400">
                  Nenhum projeto encontrado
                </p>

                <p className="mt-1 text-xs text-slate-600">
                  Os projetos aparecerão aqui quando
                  estiverem disponíveis na carteira.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* RODAPÉ */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.05] pt-3 text-[10px] text-slate-600">
        <span>
          {projetos.length}{" "}
          {projetos.length === 1
            ? "projeto"
            : "projetos"}{" "}
          na carteira
        </span>

        <span>
          A barra representa o período entre{" "}
          <strong className="font-semibold text-slate-500">
            início
          </strong>{" "}
          e{" "}
          <strong className="font-semibold text-slate-500">
            previsão de término
          </strong>
          .
        </span>
      </div>
    </div>
  );
}