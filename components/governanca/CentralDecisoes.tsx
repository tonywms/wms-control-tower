"use client";

import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Gavel,
  History,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
  UserRound,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type Decisao = {
  id: string;
  projeto_id: string;
  projeto_nome: string;
  cliente_nome: string;
  tipo: string;
  valor_anterior: string | null;
  valor_novo: string | null;
  justificativa: string | null;
  recomendacao: string | null;
  carga_origem: string | null;
  carga_destino: string | null;
  usuario_id: string | null;
  usuario_nome: string;
  created_at: string;
  detalhes: string | null;
};

type ResponseData = {
  success: boolean;
  atualizado_em?: string;
  resumo?: {
    total: number;
    projetos_impactados: number;
    ultimos_7_dias: number;
    decisores: number;
  };
  decisoes?: Decisao[];
  error?: string;
};

type Props = {
  onOpenProjeto?: (projetoId: string) => void;
};

function formatarDataHora(value: string) {
  const data = new Date(value);

  if (Number.isNaN(data.getTime())) return value;

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(data);
}

export default function CentralDecisoes({ onOpenProjeto }: Props) {
  const [decisoes, setDecisoes] = useState<Decisao[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busca, setBusca] = useState("");

  const carregar = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("/api/governanca/decisoes", {
        cache: "no-store",
        credentials: "same-origin",
      });

      const data = (await response.json()) as ResponseData;

      if (!response.ok || !data.success) {
        throw new Error(
          data.error || `Erro HTTP ${response.status}`,
        );
      }

      setDecisoes(data.decisoes ?? []);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Erro ao carregar decisões gerenciais.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();

    if (!q) return decisoes;

    return decisoes.filter((item) =>
      [
        item.projeto_nome,
        item.cliente_nome,
        item.tipo,
        item.valor_anterior,
        item.valor_novo,
        item.justificativa,
        item.recomendacao,
        item.usuario_nome,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [busca, decisoes]);

  const resumo = useMemo(() => {
    const agora = Date.now();
    const seteDias = 7 * 24 * 60 * 60 * 1000;

    return {
      total: decisoes.length,
      projetos: new Set(decisoes.map((item) => item.projeto_id)).size,
      ultimos7dias: decisoes.filter((item) => {
        const data = new Date(item.created_at).getTime();
        return Number.isFinite(data) && agora - data <= seteDias;
      }).length,
      decisores: new Set(decisoes.map((item) => item.usuario_nome)).size,
    };
  }, [decisoes]);

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-400">
            <Gavel size={13} />
            Governança • Auditoria executiva
          </div>

          <h2 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-white">
            Central de Decisões
          </h2>

          <p className="mt-1 text-xs text-slate-500">
            Histórico consolidado das decisões gerenciais efetivamente aplicadas à carteira.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void carregar()}
          disabled={loading}
          className="flex h-9 items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 text-[10px] font-medium text-slate-400 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-50"
        >
          <RefreshCw
            size={13}
            className={loading ? "animate-spin" : ""}
          />
          Atualizar
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          icon={Gavel}
          label="Decisões aplicadas"
          value={resumo.total}
          tone="text-violet-300"
        />
        <Kpi
          icon={Sparkles}
          label="Projetos impactados"
          value={resumo.projetos}
          tone="text-sky-300"
        />
        <Kpi
          icon={Clock3}
          label="Últimos 7 dias"
          value={resumo.ultimos7dias}
          tone="text-amber-300"
        />
        <Kpi
          icon={UserRound}
          label="Decisores"
          value={resumo.decisores}
          tone="text-emerald-300"
        />
      </div>

      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-3">
        <div className="relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600"
          />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar projeto, cliente, responsável, justificativa ou decisor..."
            className="h-9 w-full rounded-xl border border-white/[0.06] bg-black/20 pl-9 pr-3 text-xs text-slate-200 outline-none placeholder:text-slate-700 focus:border-violet-400/20"
          />
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-400/15 bg-red-400/[0.05] p-4 text-xs text-red-300">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.025]">
        <div className="flex items-center justify-between border-b border-white/[0.05] px-4 py-3">
          <div className="flex items-center gap-2">
            <History size={13} className="text-violet-300" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">
              Registro executivo
            </span>
          </div>

          <div className="text-[10px] text-slate-600">
            {filtradas.length} decisão(ões)
          </div>
        </div>

        {loading && decisoes.length === 0 ? (
          <div className="flex min-h-[180px] items-center justify-center text-xs text-slate-600">
            <Loader2 size={15} className="mr-2 animate-spin" />
            Carregando decisões...
          </div>
        ) : filtradas.length === 0 ? (
          <div className="flex min-h-[180px] items-center justify-center text-center">
            <div>
              <CheckCircle2
                size={24}
                className="mx-auto text-emerald-300"
              />
              <div className="mt-2 text-sm font-medium text-slate-300">
                Nenhuma decisão encontrada
              </div>
              <div className="mt-1 text-[10px] text-slate-600">
                As decisões aplicadas pela Governança aparecerão aqui.
              </div>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {filtradas.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onOpenProjeto?.(item.projeto_id)}
                className="grid w-full gap-4 px-4 py-4 text-left transition hover:bg-white/[0.025] xl:grid-cols-[minmax(180px,1.15fr)_minmax(260px,1.7fr)_minmax(170px,1fr)_145px_24px] xl:items-center"
              >
                <div className="min-w-0">
                  <div className="truncate text-xs font-semibold text-white">
                    {item.projeto_nome}
                  </div>
                  <div className="mt-1 truncate text-[9px] text-slate-600">
                    {item.cliente_nome}
                  </div>
                </div>

                <div className="min-w-0">
                  <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-violet-300">
                    {item.tipo}
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="rounded-lg border border-white/[0.06] bg-white/[0.035] px-2.5 py-1 text-[10px] text-slate-400">
                      {item.valor_anterior ?? "Não informado"}
                    </span>

                    <ArrowRight size={12} className="text-slate-700" />

                    <span className="rounded-lg border border-emerald-400/15 bg-emerald-400/[0.06] px-2.5 py-1 text-[10px] font-medium text-emerald-300">
                      {item.valor_novo ?? "Não informado"}
                    </span>
                  </div>

                  {item.justificativa && (
                    <div className="mt-2 line-clamp-2 text-[10px] leading-4 text-slate-500">
                      <span className="font-semibold text-slate-400">
                        Justificativa:
                      </span>{" "}
                      {item.justificativa}
                    </div>
                  )}
                </div>

                <div className="min-w-0">
                  <div className="truncate text-[10px] font-medium text-slate-300">
                    {item.usuario_nome}
                  </div>

                  {item.recomendacao && (
                    <div className="mt-1 text-[9px] text-sky-300">
                      {item.recomendacao}
                    </div>
                  )}

                  {(item.carga_origem || item.carga_destino) && (
                    <div className="mt-1 text-[9px] text-slate-600">
                      {item.carga_origem
                        ? `Origem ${item.carga_origem}`
                        : ""}
                      {item.carga_origem && item.carga_destino
                        ? " • "
                        : ""}
                      {item.carga_destino
                        ? `Destino ${item.carga_destino}`
                        : ""}
                    </div>
                  )}
                </div>

                <div className="text-[9px] text-slate-600">
                  {formatarDataHora(item.created_at)}
                </div>

                <ChevronRight
                  size={15}
                  className="hidden text-slate-700 xl:block"
                />
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between border-t border-white/[0.05] px-4 py-3 text-[9px] text-slate-600">
          <span>Fonte: histórico de governança do Control Tower</span>
          <span>Clique em uma decisão para abrir o Projeto 360</span>
        </div>
      </div>
    </section>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Gavel;
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4">
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-600">
          {label}
        </span>
        <Icon size={14} className={tone} />
      </div>
      <div className="mt-3 text-2xl font-semibold text-white">
        {value}
      </div>
    </div>
  );
}
