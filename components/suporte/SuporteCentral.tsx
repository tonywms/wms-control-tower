"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Filter,
  Headphones,
  Search,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  UserRound,
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

type SuporteCentralProps = {
  projetos: Projeto[];
  onOpenProjeto: (id: string) => void;
};

type Tone =
  | "sky"
  | "emerald"
  | "amber"
  | "red"
  | "violet"
  | "slate";

const normalize = (value?: string | null) =>
  (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const formatDate = (value?: string | null) => {
  if (!value) return "Sem prazo";

  const [year, month, day] = value.slice(0, 10).split("-");

  if (!year || !month || !day) return "Sem prazo";

  return `${day}/${month}/${year}`;
};

const parseLocalDate = (value?: string | null) => {
  if (!value) return null;

  const [year, month, day] = value
    .slice(0, 10)
    .split("-")
    .map(Number);

  if (!year || !month || !day) return null;

  return new Date(year, month - 1, day);
};

const getToday = () => {
  const now = new Date();

  return new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
};

const isFinalizado = (status?: string | null) => {
  const value = normalize(status);

  return (
    value === "finalizado" ||
    value === "concluido" ||
    value === "concluida" ||
    value === "encerrado" ||
    value === "encerrada" ||
    value === "cancelado" ||
    value === "cancelada"
  );
};

const isBloqueado = (status?: string | null) =>
  normalize(status).includes("bloque");

const isPausado = (status?: string | null) =>
  normalize(status).includes("paus");

const isSuporte = (projeto: Projeto) => {
  const setor = normalize(projeto.setor);
  const origem = normalize(projeto.fase_origem);

  /*
   * A rotina de Suporte considera o setor/origem.
   * Não usamos apenas etapa porque "Suporte" também pode
   * aparecer como uma fase da jornada de implantação.
   */
  return setor.includes("suporte") || origem.includes("suporte");
};

const getStatusTone = (status?: string | null): Tone => {
  if (isBloqueado(status)) return "red";
  if (isPausado(status)) return "amber";
  if (isFinalizado(status)) return "emerald";

  return "sky";
};

const getPriorityTone = (priority?: string | null): Tone => {
  const value = normalize(priority);

  if (value.includes("crit")) return "red";
  if (value.includes("alta")) return "amber";

  if (
    value.includes("normal") ||
    value.includes("media")
  ) {
    return "sky";
  }

  if (value.includes("baixa")) return "slate";

  return "violet";
};

const toneClasses: Record<Tone, string> = {
  sky:
    "border-sky-400/10 bg-sky-400/[0.06] text-sky-300",
  emerald:
    "border-emerald-400/10 bg-emerald-400/[0.06] text-emerald-300",
  amber:
    "border-amber-400/10 bg-amber-400/[0.06] text-amber-300",
  red:
    "border-red-400/10 bg-red-400/[0.06] text-red-300",
  violet:
    "border-violet-400/10 bg-violet-400/[0.06] text-violet-300",
  slate:
    "border-white/[0.07] bg-white/[0.035] text-slate-400",
};

export default function SuporteCentral({
  projetos,
  onOpenProjeto,
}: SuporteCentralProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("Todos");
  const [responsavelFilter, setResponsavelFilter] =
    useState("Todos");

  const projetosSuporte = useMemo(
    () => projetos.filter(isSuporte),
    [projetos],
  );

  const responsaveis = useMemo(() => {
    return Array.from(
      new Set(
        projetosSuporte
          .map((projeto) => projeto.responsavel_nome)
          .filter(
            (value): value is string =>
              Boolean(value?.trim()),
          ),
      ),
    ).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [projetosSuporte]);

  const statusDisponiveis = useMemo(() => {
    return Array.from(
      new Set(
        projetosSuporte
          .map((projeto) => projeto.status)
          .filter(Boolean),
      ),
    ).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [projetosSuporte]);

  const metricas = useMemo(() => {
    const hoje = getToday();

    const ativos = projetosSuporte.filter(
      (projeto) => !isFinalizado(projeto.status),
    );

    const criticos = ativos.filter((projeto) => {
      const prioridade = normalize(projeto.prioridade);

      return (
        prioridade.includes("crit") ||
        prioridade.includes("alta")
      );
    });

    const bloqueados = ativos.filter((projeto) =>
      isBloqueado(projeto.status),
    );

    const atrasados = ativos.filter((projeto) => {
      const prazo = parseLocalDate(projeto.data_fim);

      return prazo ? prazo < hoje : false;
    });

    const semPrazo = ativos.filter(
      (projeto) => !projeto.data_fim,
    );

    return {
      total: projetosSuporte.length,
      ativos: ativos.length,
      criticos: criticos.length,
      bloqueados: bloqueados.length,
      atrasados: atrasados.length,
      semPrazo: semPrazo.length,
    };
  }, [projetosSuporte]);

  const projetosFiltrados = useMemo(() => {
    const query = normalize(search);

    return projetosSuporte
      .filter((projeto) => {
        const matchSearch =
          !query ||
          normalize(projeto.nome).includes(query) ||
          normalize(projeto.cliente?.nome).includes(query) ||
          normalize(projeto.responsavel_nome).includes(query) ||
          normalize(projeto.etapa?.nome).includes(query) ||
          normalize(projeto.plataforma).includes(query) ||
          normalize(projeto.cliente?.cidade).includes(query) ||
          normalize(projeto.observacoes).includes(query);

        const matchStatus =
          statusFilter === "Todos" ||
          projeto.status === statusFilter;

        const matchResponsavel =
          responsavelFilter === "Todos" ||
          projeto.responsavel_nome === responsavelFilter;

        return (
          matchSearch &&
          matchStatus &&
          matchResponsavel
        );
      })
      .sort((a, b) => {
        const prioridadePeso = (projeto: Projeto) => {
          const prioridade = normalize(projeto.prioridade);

          if (prioridade.includes("crit")) return 4;
          if (prioridade.includes("alta")) return 3;
          if (prioridade.includes("normal")) return 2;
          if (prioridade.includes("media")) return 2;

          return 1;
        };

        const prioridadeDiff =
          prioridadePeso(b) - prioridadePeso(a);

        if (prioridadeDiff !== 0) return prioridadeDiff;

        const aFim =
          parseLocalDate(a.data_fim)?.getTime() ?? Infinity;

        const bFim =
          parseLocalDate(b.data_fim)?.getTime() ?? Infinity;

        return aFim - bFim;
      });
  }, [
    projetosSuporte,
    search,
    statusFilter,
    responsavelFilter,
  ]);

  return (
    <div className="mt-5 space-y-4">
      {/* CABEÇALHO */}

      <section className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-gradient-to-br from-white/[0.045] via-white/[0.025] to-transparent p-5">
        <div className="absolute right-[-60px] top-[-80px] h-[240px] w-[240px] rounded-full bg-emerald-400/[0.04] blur-[90px]" />

        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck
                size={15}
                className="text-emerald-300"
              />

              <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Central de Suporte
              </span>
            </div>

            <h2 className="mt-2 text-lg font-semibold tracking-[-0.025em] text-white">
              Operação de suporte e pós-Go-Live
            </h2>

            <p className="mt-1 max-w-2xl text-[11px] leading-5 text-slate-500">
              Visão operacional dos clientes e projetos em
              suporte, priorizando criticidade, responsáveis,
              prazos, bloqueios e pendências que exigem atuação.
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2">
            <Headphones
              size={14}
              className="text-emerald-300"
            />

            <div>
              <div className="text-[9px] uppercase tracking-[0.12em] text-slate-600">
                Operação ativa
              </div>

              <div className="mt-0.5 text-sm font-semibold text-white">
                {metricas.ativos}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* KPIs */}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          label="Suporte"
          value={metricas.total}
          helper={`${metricas.ativos} ativos`}
          icon={Headphones}
          tone="emerald"
        />

        <MetricCard
          label="Críticos / Alta"
          value={metricas.criticos}
          helper="Maior prioridade"
          icon={AlertTriangle}
          tone={
            metricas.criticos > 0
              ? "red"
              : "emerald"
          }
        />

        <MetricCard
          label="Bloqueados"
          value={metricas.bloqueados}
          helper="Exigem atuação"
          icon={ShieldAlert}
          tone={
            metricas.bloqueados > 0
              ? "red"
              : "emerald"
          }
        />

        <MetricCard
          label="Atrasados"
          value={metricas.atrasados}
          helper="Prazo ultrapassado"
          icon={Clock3}
          tone={
            metricas.atrasados > 0
              ? "amber"
              : "emerald"
          }
        />

        <MetricCard
          label="Sem prazo"
          value={metricas.semPrazo}
          helper="Precisam de previsão"
          icon={CalendarDays}
          tone={
            metricas.semPrazo > 0
              ? "amber"
              : "emerald"
          }
        />
      </section>

      {/* FILTROS */}

      <section className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <div className="relative flex-1">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600"
            />

            <input
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Buscar cliente, projeto, responsável, situação..."
              className="h-10 w-full rounded-xl border border-white/[0.06] bg-black/20 pl-9 pr-3 text-[11px] text-slate-300 outline-none transition placeholder:text-slate-700 focus:border-emerald-400/20"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter
              size={14}
              className="text-slate-600"
            />

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value)
              }
              className="h-10 min-w-40 rounded-xl border border-white/[0.06] bg-[#0a1019] px-3 text-[11px] text-slate-400 outline-none"
            >
              <option>Todos</option>

              {statusDisponiveis.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>

            <select
              value={responsavelFilter}
              onChange={(event) =>
                setResponsavelFilter(event.target.value)
              }
              className="h-10 min-w-44 rounded-xl border border-white/[0.06] bg-[#0a1019] px-3 text-[11px] text-slate-400 outline-none"
            >
              <option>Todos</option>

              {responsaveis.map((responsavel) => (
                <option
                  key={responsavel}
                  value={responsavel}
                >
                  {responsavel}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* CARTEIRA DE SUPORTE */}

      <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02]">
        <div className="flex items-center justify-between border-b border-white/[0.05] px-5 py-4">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">
              Carteira de Suporte
            </div>

            <div className="mt-1 text-[11px] text-slate-600">
              {projetosFiltrados.length} projeto
              {projetosFiltrados.length === 1 ? "" : "s"}{" "}
              encontrado
              {projetosFiltrados.length === 1 ? "" : "s"}
            </div>
          </div>

          <span className="rounded-full border border-emerald-400/10 bg-emerald-400/[0.05] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-emerald-300">
            Suporte
          </span>
        </div>

        {projetosFiltrados.length === 0 ? (
          <div className="flex min-h-56 flex-col items-center justify-center p-8 text-center">
            <Headphones
              size={28}
              className="text-slate-700"
            />

            <div className="mt-3 text-sm font-medium text-slate-400">
              Nenhum projeto em suporte encontrado
            </div>

            <div className="mt-1 max-w-md text-[11px] leading-5 text-slate-600">
              Não existem projetos vinculados ao setor Suporte
              compatíveis com os filtros selecionados.
            </div>
          </div>
        ) : (
          <div className="grid gap-3 p-4 xl:grid-cols-2">
            {projetosFiltrados.map((projeto) => (
              <ProjetoSuporteCard
                key={projeto.id}
                projeto={projeto}
                onOpenProjeto={onOpenProjeto}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function MetricCard({
  label,
  value,
  helper,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string | number;
  helper: string;
  icon: typeof Headphones;
  tone: Tone;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4">
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-600">
          {label}
        </span>

        <div
          className={`flex h-8 w-8 items-center justify-center rounded-xl border ${toneClasses[tone]}`}
        >
          <Icon size={14} />
        </div>
      </div>

      <div className="mt-4 text-2xl font-semibold tracking-[-0.04em] text-white">
        {value}
      </div>

      <div className="mt-1 text-[10px] text-slate-600">
        {helper}
      </div>
    </div>
  );
}

function ProjetoSuporteCard({
  projeto,
  onOpenProjeto,
}: {
  projeto: Projeto;
  onOpenProjeto: (id: string) => void;
}) {
  const statusTone = getStatusTone(projeto.status);
  const priorityTone = getPriorityTone(projeto.prioridade);

  const percentual = Math.min(
    100,
    Math.max(0, Number(projeto.percentual || 0)),
  );

  const hoje = getToday();
  const dataFim = parseLocalDate(projeto.data_fim);

  const atrasado =
    Boolean(dataFim) &&
    !isFinalizado(projeto.status) &&
    dataFim! < hoje;

  return (
    <article className="group rounded-2xl border border-white/[0.06] bg-black/15 p-4 transition hover:border-emerald-400/10 hover:bg-white/[0.025]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full border px-2 py-1 text-[8px] font-semibold uppercase tracking-[0.11em] ${toneClasses[statusTone]}`}
            >
              {projeto.status || "Sem status"}
            </span>

            <span
              className={`rounded-full border px-2 py-1 text-[8px] font-semibold uppercase tracking-[0.11em] ${toneClasses[priorityTone]}`}
            >
              {projeto.prioridade || "Sem prioridade"}
            </span>

            {atrasado && (
              <span className="flex items-center gap-1 rounded-full border border-red-400/10 bg-red-400/[0.06] px-2 py-1 text-[8px] font-semibold uppercase tracking-[0.11em] text-red-300">
                <AlertTriangle size={9} />
                Atrasado
              </span>
            )}
          </div>

          <h3 className="mt-3 truncate text-sm font-semibold text-slate-200">
            {projeto.nome}
          </h3>

          <div className="mt-1 text-[10px] text-slate-600">
            {projeto.cliente?.nome ?? "Cliente não informado"}

            {projeto.cliente?.cidade
              ? ` · ${projeto.cliente.cidade}`
              : ""}
          </div>
        </div>

        <button
          type="button"
          onClick={() => onOpenProjeto(projeto.id)}
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 text-[10px] font-medium text-slate-400 transition hover:border-emerald-400/15 hover:bg-emerald-400/[0.06] hover:text-emerald-300"
        >
          Projeto 360
          <ArrowRight size={12} />
        </button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Info
          label="Etapa"
          value={projeto.etapa?.nome ?? "Sem etapa"}
        />

        <Info
          label="Responsável"
          value={
            projeto.responsavel_nome ?? "Não definido"
          }
          icon={<UserRound size={11} />}
        />

        <Info
          label="Início"
          value={formatDate(projeto.data_inicio)}
        />

        <Info
          label="Prazo"
          value={formatDate(projeto.data_fim)}
          danger={atrasado}
        />
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between">
          <span className="text-[9px] uppercase tracking-[0.12em] text-slate-600">
            Andamento
          </span>

          <span className="text-[10px] font-semibold text-slate-400">
            {percentual}%
          </span>
        </div>

        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
          <div
            className="h-full rounded-full bg-emerald-400/70 transition-all duration-700"
            style={{ width: `${percentual}%` }}
          />
        </div>
      </div>

      {projeto.observacoes && (
        <div className="mt-4 rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-2.5">
          <div className="text-[8px] font-semibold uppercase tracking-[0.12em] text-slate-700">
            Contexto / Pendência
          </div>

          <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-slate-500">
            {projeto.observacoes}
          </p>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between border-t border-white/[0.05] pt-3">
        <div className="flex items-center gap-2 text-[9px] text-slate-600">
          <CheckCircle2
            size={11}
            className="text-slate-700"
          />

          <span>
            {projeto.plataforma ??
              "Plataforma não informada"}
          </span>
        </div>

        <span className="text-[9px] text-slate-700">
          {projeto.setor ?? "Suporte"}
        </span>
      </div>
    </article>
  );
}

function Info({
  label,
  value,
  icon,
  danger = false,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-2.5">
      <div className="text-[8px] font-semibold uppercase tracking-[0.12em] text-slate-700">
        {label}
      </div>

      <div
        className={[
          "mt-1 flex min-w-0 items-center gap-1 text-[10px] font-medium",
          danger ? "text-red-300" : "text-slate-400",
        ].join(" ")}
      >
        {icon}

        <span className="truncate">{value}</span>
      </div>
    </div>
  );
}