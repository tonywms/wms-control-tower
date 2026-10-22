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
  Scale,
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
  origem: string;
  created_at: string;
};

type AcompanhamentoGerencial = {
  decisao_id: string;
  acao: "manter" | "encerrar";
  justificativa: string | null;
  usuario_nome: string;
  created_at: string;
  efetividade?: string | null;
  score_atual?: number | null;
  urgencia_atual?: number | null;
  saude_atual?: string | null;
  progresso_atual?: number | null;
};

type AcompanhamentoTimeline = AcompanhamentoGerencial & {
  historico_id: string;
};

function parseAcompanhamentoGerencial(
  item: HistoricoItem,
): AcompanhamentoTimeline | null {
  if (item.campo !== "Acompanhamento gerencial" || !item.valor_novo) {
    return null;
  }

  try {
    const parsed = JSON.parse(item.valor_novo) as Partial<AcompanhamentoGerencial>;

    if (
      typeof parsed.decisao_id !== "string" ||
      (parsed.acao !== "manter" && parsed.acao !== "encerrar")
    ) {
      return null;
    }

    return {
      historico_id: item.id,
      decisao_id: parsed.decisao_id,
      acao: parsed.acao,
      justificativa:
        typeof parsed.justificativa === "string" ? parsed.justificativa : null,
      usuario_nome:
        typeof parsed.usuario_nome === "string"
          ? parsed.usuario_nome
          : item.usuario_nome || "Sistema",
      created_at:
        typeof parsed.created_at === "string"
          ? parsed.created_at
          : item.created_at,
      efetividade:
        typeof parsed.efetividade === "string" ? parsed.efetividade : null,
      score_atual:
        typeof parsed.score_atual === "number" ? parsed.score_atual : null,
      urgencia_atual:
        typeof parsed.urgencia_atual === "number" ? parsed.urgencia_atual : null,
      saude_atual:
        typeof parsed.saude_atual === "string" ? parsed.saude_atual : null,
      progresso_atual:
        typeof parsed.progresso_atual === "number"
          ? parsed.progresso_atual
          : null,
    };
  } catch {
    return null;
  }
}

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
  const [agoraReferencia, setAgoraReferencia] = useState(0);

  useEffect(() => {
    if (!open || !projeto) {
      return;
    }

    setAgoraReferencia(Date.now());

    let cancelado = false;
    const projetoAtual = projeto;

    async function carregar() {
      try {
        setLoadingHistorico(true);
        setErroHistorico("");

        const response = await fetch(
          `/api/projetos/${projetoAtual.id}/historico`,
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
    return agoraReferencia > 0 && prazo.getTime() < agoraReferencia;
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
    return agoraReferencia > 0 && prazo.getTime() < agoraReferencia;
  };

  const marcoAtrasado = marcosProjeto.some(marcoEstaAtrasado);

  const acaoEstaVencida = (item: AcaoProjeto) => {
    if (!item.prazo) return false;
    if (item.status === "Concluída" || item.status === "Cancelada") {
      return false;
    }

    const prazo = new Date(`${item.prazo}T23:59:59`);
    return agoraReferencia > 0 && prazo.getTime() < agoraReferencia;
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

  const decisoesGerenciais = historico.filter(
    (item) => item.campo === "Decisão gerencial",
  );

  const acompanhamentosGerenciais = historico
    .map(parseAcompanhamentoGerencial)
    .filter((item): item is AcompanhamentoTimeline => Boolean(item))
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() -
        new Date(a.created_at).getTime(),
    );

  const cicloGovernancaEncerrado = acompanhamentosGerenciais.some(
    (item) => item.acao === "encerrar",
  );

  const ultimoAcompanhamento = acompanhamentosGerenciais[0] ?? null;

  const atividadeOperacional = historico.filter((item) => {
    if (
      item.campo === "Decisão gerencial" ||
      item.campo === "Acompanhamento gerencial"
    ) {
      return false;
    }

    if (
      ["Responsável", "Data final", "Prioridade"].includes(item.campo) &&
      item.origem === "governanca"
    ) {
      const decisaoRelacionada = decisoesGerenciais.some(
        (decisao) =>
          Math.abs(
            new Date(decisao.created_at).getTime() -
              new Date(item.created_at).getTime(),
          ) < 2000,
      );

      if (decisaoRelacionada) return false;
    }

    return true;
  });

  const alteracaoDaDecisao = (
    decisao: HistoricoItem,
    campo: "Responsável" | "Data final" | "Prioridade",
  ) =>
    historico.find(
      (item) =>
        item.campo === campo &&
        item.origem === "governanca" &&
        Math.abs(
          new Date(item.created_at).getTime() -
            new Date(decisao.created_at).getTime(),
        ) < 2000,
    );

  const extrairDetalhe = (valor: string | null, rotulo: string) => {
    if (!valor) return null;
    const escapado = rotulo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = valor.match(new RegExp(`${escapado}:\\s*([^.]*)\\.?`, "i"));
    return match?.[1]?.trim() || null;
  };

  const acoesAbertas = acoesProjeto.filter(
    (item) => item.status !== "Concluída" && item.status !== "Cancelada",
  );

  const acoesVencidas = acoesAbertas.filter(acaoEstaVencida);
  const acoesSemResponsavel = acoesAbertas.filter((item) => !item.responsavel_id);
  const acoesSemPrazo = acoesAbertas.filter((item) => !item.prazo);

  const proximasAcoes = [...acoesAbertas]
    .sort((a, b) => {
      if (acaoEstaVencida(a) !== acaoEstaVencida(b)) {
        return acaoEstaVencida(a) ? -1 : 1;
      }
      if (!!a.prazo !== !!b.prazo) return a.prazo ? -1 : 1;
      if (a.prazo && b.prazo && a.prazo !== b.prazo) {
        return a.prazo.localeCompare(b.prazo);
      }
      return (Number(a.ordem) || 0) - (Number(b.ordem) || 0);
    })
    .slice(0, 4);

  const resumoExecutivo = (() => {
    const partes: string[] = [];

    if (projeto.status === "Pausado") {
      partes.push("Projeto pausado e com retomada operacional pendente.");
    } else if (projeto.status === "Bloqueado") {
      partes.push("Projeto bloqueado e exigindo atuação para retorno ao fluxo.");
    } else if (projeto.status === "Finalizado" && acoesAbertas.length > 0) {
      partes.push(`Projeto finalizado, porém ainda possui ${acoesAbertas.length} ação(ões) aberta(s).`);
    } else {
      partes.push(`Projeto ${projeto.status.toLowerCase()} com ${acoesAbertas.length} ação(ões) aberta(s).`);
    }

    if (acoesVencidas.length > 0) {
      partes.push(`${acoesVencidas.length} ação(ões) estão vencidas e exigem priorização.`);
    } else if (proximasAcoes[0]?.prazo) {
      partes.push(`Próximo compromisso em ${formatDate(proximasAcoes[0].prazo)}: ${proximasAcoes[0].titulo}.`);
    }

    if (impedimentoAberto) {
      partes.push("Existe impedimento aberto no projeto.");
    }

    if (acoesSemResponsavel.length > 0) {
      partes.push(`${acoesSemResponsavel.length} ação(ões) ainda estão sem responsável.`);
    }

    if (acoesSemPrazo.length > 0) {
      partes.push(`${acoesSemPrazo.length} ação(ões) estão sem prazo definido.`);
    }

    return partes.join(" ");
  })();

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

          {/* LEITURA EXECUTIVA / PLANO DE AÇÃO */}
          <section className="mt-4 rounded-2xl border border-sky-400/15 bg-gradient-to-br from-sky-500/[0.055] via-cyan-500/[0.025] to-violet-500/[0.035] p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-sky-400">
                  Leitura executiva
                </div>
                <h3 className="mt-1 text-base font-semibold text-white">
                  Plano de ação do projeto
                </h3>
              </div>

              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-white/[0.08] bg-black/15 px-2.5 py-1 text-[10px] font-semibold text-slate-300">
                  {acoesAbertas.length} aberta(s)
                </span>
                {acoesVencidas.length > 0 && (
                  <span className="rounded-full border border-rose-400/20 bg-rose-500/[0.08] px-2.5 py-1 text-[10px] font-semibold text-rose-300">
                    {acoesVencidas.length} vencida(s)
                  </span>
                )}
                {acoesSemPrazo.length > 0 && (
                  <span className="rounded-full border border-amber-400/20 bg-amber-500/[0.07] px-2.5 py-1 text-[10px] font-semibold text-amber-300">
                    {acoesSemPrazo.length} sem prazo
                  </span>
                )}
              </div>
            </div>

            <p className="mt-3 text-sm leading-6 text-slate-300">
              {resumoExecutivo}
            </p>

            {proximasAcoes.length > 0 ? (
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {proximasAcoes.map((acao) => {
                  const vencida = acaoEstaVencida(acao);
                  return (
                    <div
                      key={acao.id}
                      className={[
                        "rounded-xl border px-3.5 py-3",
                        vencida
                          ? "border-rose-400/20 bg-rose-500/[0.055]"
                          : "border-white/[0.06] bg-black/15",
                      ].join(" ")}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 text-xs font-semibold text-white">
                          {acao.titulo}
                        </div>
                        {vencida && (
                          <span className="shrink-0 rounded-md bg-rose-500/[0.1] px-1.5 py-0.5 text-[9px] font-bold text-rose-300">
                            Vencida
                          </span>
                        )}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-500">
                        <span>{acao.responsavel?.nome ?? "Sem responsável"}</span>
                        <span>•</span>
                        <span className={vencida ? "text-rose-300" : ""}>
                          {acao.prazo ? formatDate(acao.prazo) : "Sem prazo"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-dashed border-white/[0.08] px-4 py-4 text-center text-xs text-slate-500">
                Nenhuma ação operacional aberta para este projeto.
              </div>
            )}
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

            <div className="space-y-4">
              {(decisoesGerenciais.length > 0 ||
                acompanhamentosGerenciais.length > 0) && (
                <section className="rounded-2xl border border-cyan-400/20 bg-gradient-to-br from-cyan-500/[0.055] via-sky-500/[0.035] to-violet-500/[0.055] p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Scale size={15} className="text-cyan-300" />
                      <div>
                        <h3 className="text-sm font-semibold text-white">
                          Governança Executiva
                        </h3>
                        <p className="mt-1 text-[11px] text-slate-500">
                          Decisões, reavaliações e encerramentos do ciclo gerencial.
                        </p>
                      </div>
                    </div>

                    <span
                      className={[
                        "rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.12em]",
                        cicloGovernancaEncerrado
                          ? "border-emerald-400/25 bg-emerald-500/[0.09] text-emerald-300"
                          : ultimoAcompanhamento?.acao === "manter"
                            ? "border-amber-400/25 bg-amber-500/[0.08] text-amber-300"
                            : "border-sky-400/25 bg-sky-500/[0.08] text-sky-300",
                      ].join(" ")}
                    >
                      {cicloGovernancaEncerrado
                        ? "Ciclo encerrado"
                        : ultimoAcompanhamento?.acao === "manter"
                          ? "Em monitoramento"
                          : "Decisão aplicada"}
                    </span>
                  </div>

                  <div className="mt-5 space-y-0">
                    {[
                      ...decisoesGerenciais.map((item) => ({
                        id: `decisao-${item.id}`,
                        tipo: "decisao" as const,
                        created_at: item.created_at,
                        usuario_nome: item.usuario_nome || "Sistema",
                        titulo: "Decisão gerencial aplicada",
                        descricao: item.valor_novo || "Decisão executiva registrada.",
                        justificativa: extrairDetalhe(
                          item.valor_novo,
                          "Justificativa",
                        ),
                        acompanhamento: null as AcompanhamentoTimeline | null,
                      })),
                      ...acompanhamentosGerenciais.map((item) => ({
                        id: `acompanhamento-${item.historico_id}`,
                        tipo: "acompanhamento" as const,
                        created_at: item.created_at,
                        usuario_nome: item.usuario_nome || "Sistema",
                        titulo:
                          item.acao === "encerrar"
                            ? "Acompanhamento encerrado"
                            : "Reavaliação gerencial",
                        descricao:
                          item.acao === "encerrar"
                            ? "A gestão encerrou formalmente o ciclo de acompanhamento desta decisão."
                            : "A decisão foi reavaliada e permanece em monitoramento.",
                        justificativa: item.justificativa,
                        acompanhamento: item,
                      })),
                    ]
                      .sort(
                        (a, b) =>
                          new Date(a.created_at).getTime() -
                          new Date(b.created_at).getTime(),
                      )
                      .map((evento, index, eventos) => {
                        const encerramento =
                          evento.tipo === "acompanhamento" &&
                          evento.acompanhamento?.acao === "encerrar";
                        const monitoramento =
                          evento.tipo === "acompanhamento" &&
                          evento.acompanhamento?.acao === "manter";

                        return (
                          <div
                            key={evento.id}
                            className="relative grid grid-cols-[28px_1fr] gap-3"
                          >
                            <div className="flex flex-col items-center">
                              <div
                                className={[
                                  "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border",
                                  encerramento
                                    ? "border-emerald-400/30 bg-emerald-500/[0.12] text-emerald-300"
                                    : monitoramento
                                      ? "border-amber-400/30 bg-amber-500/[0.10] text-amber-300"
                                      : "border-violet-400/30 bg-violet-500/[0.10] text-violet-300",
                                ].join(" ")}
                              >
                                {encerramento ? (
                                  <CheckCircle2 size={13} />
                                ) : monitoramento ? (
                                  <RefreshCw size={12} />
                                ) : (
                                  <Scale size={12} />
                                )}
                              </div>

                              {index < eventos.length - 1 && (
                                <div className="min-h-8 w-px flex-1 bg-gradient-to-b from-white/[0.12] to-white/[0.035]" />
                              )}
                            </div>

                            <div className="pb-4">
                              <div
                                className={[
                                  "rounded-xl border p-3.5",
                                  encerramento
                                    ? "border-emerald-400/15 bg-emerald-500/[0.045]"
                                    : monitoramento
                                      ? "border-amber-400/15 bg-amber-500/[0.035]"
                                      : "border-violet-400/15 bg-black/15",
                                ].join(" ")}
                              >
                                <div className="flex flex-wrap items-start justify-between gap-2">
                                  <div>
                                    <div
                                      className={[
                                        "text-[10px] font-bold uppercase tracking-[0.13em]",
                                        encerramento
                                          ? "text-emerald-300"
                                          : monitoramento
                                            ? "text-amber-300"
                                            : "text-violet-300",
                                      ].join(" ")}
                                    >
                                      {evento.titulo}
                                    </div>
                                    <div className="mt-1 text-[10px] text-slate-500">
                                      {evento.usuario_nome}
                                    </div>
                                  </div>

                                  <div className="text-[9px] text-slate-600">
                                    {formatDateTime(evento.created_at)}
                                  </div>
                                </div>

                                <p className="mt-2 text-[11px] leading-5 text-slate-400">
                                  {evento.descricao}
                                </p>

                                {evento.justificativa && (
                                  <div className="mt-3 rounded-lg border border-white/[0.05] bg-black/10 px-3 py-2.5">
                                    <div className="text-[9px] font-bold uppercase tracking-[0.11em] text-slate-600">
                                      {encerramento
                                        ? "Parecer de encerramento"
                                        : monitoramento
                                          ? "Parecer da reavaliação"
                                          : "Justificativa"}
                                    </div>
                                    <div className="mt-1 text-[11px] leading-5 text-slate-300">
                                      {evento.justificativa}
                                    </div>
                                  </div>
                                )}

                                {evento.acompanhamento && (
                                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                    {evento.acompanhamento.saude_atual && (
                                      <DecisionInfo
                                        label="Saúde"
                                        value={evento.acompanhamento.saude_atual}
                                      />
                                    )}

                                    {evento.acompanhamento.progresso_atual !== null &&
                                      evento.acompanhamento.progresso_atual !== undefined && (
                                        <DecisionInfo
                                          label="Progresso"
                                          value={`${evento.acompanhamento.progresso_atual}%`}
                                        />
                                      )}

                                    {evento.acompanhamento.score_atual !== null &&
                                      evento.acompanhamento.score_atual !== undefined && (
                                        <DecisionInfo
                                          label="Score"
                                          value={String(evento.acompanhamento.score_atual)}
                                        />
                                      )}

                                    {evento.acompanhamento.urgencia_atual !== null &&
                                      evento.acompanhamento.urgencia_atual !== undefined && (
                                        <DecisionInfo
                                          label="Urgência"
                                          value={String(evento.acompanhamento.urgencia_atual)}
                                        />
                                      )}

                                    {evento.acompanhamento.efetividade && (
                                      <DecisionInfo
                                        label="Efetividade"
                                        value={evento.acompanhamento.efetividade}
                                      />
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </section>
              )}

              {decisoesGerenciais.length > 0 && (
                <section className="rounded-2xl border border-violet-400/20 bg-violet-500/[0.045] p-5">
                  <div className="flex items-center gap-2">
                    <Scale size={15} className="text-violet-300" />
                    <div>
                      <h3 className="text-sm font-semibold text-white">
                        Decisões gerenciais
                      </h3>
                      <p className="mt-1 text-[11px] text-slate-600">
                        Decisões executivas aplicadas ao projeto.
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 space-y-3">
                    {decisoesGerenciais.slice(0, 4).map((decisao) => {
                      const textoDecisao = decisao.valor_novo ?? "";
                      const isPrazo = textoDecisao.startsWith("Reprogramação de prazo:");
                      const isPrioridade = textoDecisao.startsWith("Alteração de prioridade:");
                      const campoRelacionado = isPrazo
                        ? "Data final"
                        : isPrioridade
                          ? "Prioridade"
                          : "Responsável";
                      const alteracao = alteracaoDaDecisao(decisao, campoRelacionado);
                      const justificativa = extrairDetalhe(decisao.valor_novo, "Justificativa");
                      const recomendacao = extrairDetalhe(decisao.valor_novo, "Recomendação simulada");
                      const cargaOrigem = extrairDetalhe(decisao.valor_novo, "Carga origem");
                      const cargaDestino = extrairDetalhe(decisao.valor_novo, "Carga destino");
                      const score = extrairDetalhe(decisao.valor_novo, "Score");
                      const urgencia = extrairDetalhe(decisao.valor_novo, "Urgência");
                      const quadrante = extrairDetalhe(decisao.valor_novo, "Quadrante");
                      const tituloDecisao = isPrazo
                        ? "Reprogramação de prazo"
                        : isPrioridade
                          ? "Alteração gerencial de prioridade"
                          : "Redistribuição de responsabilidade";

                      return (
                        <div key={decisao.id} className="rounded-xl border border-violet-400/15 bg-black/15 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-violet-300">
                                {tituloDecisao}
                              </div>
                              <div className="mt-1 text-[11px] text-slate-500">
                                Decidido por <span className="font-semibold text-slate-300">{decisao.usuario_nome || "Sistema"}</span>
                              </div>
                            </div>
                            <div className="shrink-0 text-[9px] text-slate-600">
                              {formatDateTime(decisao.created_at)}
                            </div>
                          </div>

                          {alteracao && (
                            <div className="mt-4 flex flex-wrap items-center gap-2">
                              <span className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-xs font-semibold text-slate-300">
                                {isPrazo ? formatDate(alteracao.valor_anterior) : valueText(alteracao.valor_anterior)}
                              </span>
                              <ArrowRight size={14} className="text-violet-400" />
                              <span className="rounded-lg border border-violet-400/20 bg-violet-500/[0.08] px-3 py-2 text-xs font-semibold text-violet-200">
                                {isPrazo ? formatDate(alteracao.valor_novo) : valueText(alteracao.valor_novo)}
                              </span>
                            </div>
                          )}

                          {justificativa && (
                            <div className="mt-4 rounded-lg border border-white/[0.05] bg-white/[0.025] px-3 py-2.5">
                              <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-600">Justificativa</div>
                              <div className="mt-1 text-xs leading-5 text-slate-300">{justificativa}</div>
                            </div>
                          )}

                          <div className="mt-3 grid gap-2 sm:grid-cols-3">
                            {!isPrazo && !isPrioridade && recomendacao && (
                              <DecisionInfo label="Recomendação" value={recomendacao} />
                            )}
                            {!isPrazo && !isPrioridade && cargaOrigem && (
                              <DecisionInfo label="Carga origem" value={cargaOrigem} />
                            )}
                            {!isPrazo && !isPrioridade && cargaDestino && (
                              <DecisionInfo label="Carga destino" value={cargaDestino} />
                            )}
                            {(isPrazo || isPrioridade) && score && (
                              <DecisionInfo label="Score" value={score} />
                            )}
                            {(isPrazo || isPrioridade) && urgencia && (
                              <DecisionInfo label="Urgência" value={urgencia} />
                            )}
                            {(isPrazo || isPrioridade) && quadrante && (
                              <DecisionInfo label="Quadrante" value={quadrante} />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              <section className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <History size={15} className="text-sky-400" />
                      <h3 className="text-sm font-semibold text-white">Atividade recente</h3>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-600">
                      Últimas movimentações operacionais registradas no projeto.
                    </p>
                  </div>

                  <button type="button" onClick={() => void atualizarHistorico()} disabled={loadingHistorico} className="flex items-center gap-1.5 rounded-lg border border-white/[0.07] bg-white/[0.03] px-2.5 py-2 text-[10px] text-slate-400 transition hover:text-white disabled:opacity-50">
                    <RefreshCw size={12} className={loadingHistorico ? "animate-spin" : ""} />
                    Atualizar
                  </button>
                </div>

                {loadingHistorico && historico.length === 0 ? (
                  <div className="flex min-h-[260px] items-center justify-center text-sm text-slate-500">
                    <Loader2 size={16} className="mr-2 animate-spin" /> Carregando...
                  </div>
                ) : erroHistorico ? (
                  <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/[0.06] p-3 text-xs text-red-300">{erroHistorico}</div>
                ) : atividadeOperacional.length === 0 ? (
                  <div className="flex min-h-[260px] flex-col items-center justify-center text-center">
                    <History size={25} className="text-slate-700" />
                    <div className="mt-3 text-sm text-slate-400">Sem atividade operacional registrada</div>
                  </div>
                ) : (
                  <div className="mt-4 space-y-2.5">
                    {atividadeOperacional.slice(0, 6).map((item) => (
                      <div key={item.id} className="rounded-xl border border-white/[0.06] bg-black/10 px-3.5 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-xs text-slate-300">
                              <span className="font-semibold text-white">{item.usuario_nome || "Sistema"}</span>{" "}
                              alterou <span className={item.tipo === "status" ? "text-violet-300" : "text-sky-300"}>{item.campo}</span>
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px]">
                              <span className="rounded-md bg-white/[0.04] px-2 py-1 text-slate-500">{valueText(item.valor_anterior)}</span>
                              <ArrowRight size={11} className="text-slate-700" />
                              <span className="rounded-md border border-emerald-400/10 bg-emerald-500/[0.06] px-2 py-1 text-emerald-300">{valueText(item.valor_novo)}</span>
                            </div>
                            {item.motivo && (
                              <div className="mt-2 text-[10px] leading-4 text-amber-300/70">Motivo: {item.motivo}</div>
                            )}
                          </div>
                          <div className="shrink-0 text-[9px] text-slate-700">{formatDateTime(item.created_at)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
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

function DecisionInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-violet-400/10 bg-violet-500/[0.04] px-3 py-2.5">
      <div className="text-[9px] font-bold uppercase tracking-[0.11em] text-slate-600">{label}</div>
      <div className="mt-1 text-[11px] font-semibold text-violet-200">{value}</div>
    </div>
  );
}