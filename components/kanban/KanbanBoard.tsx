"use client";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AlertCircle,
  Ban,
  Check,
  ChevronDown,
  Circle,
  Clock3,
  GripVertical,
  Loader2,
  Lock,
  Pause,
  Play,
  RotateCcw,
  ShieldAlert,
  Target,
  X,
} from "lucide-react";
import { usePermissions } from "@/components/auth/usePermissions";
type Status =
  | "Não iniciado"
  | "Planejado"
  | "Em andamento"
  | "Pausado"
  | "Bloqueado"
  | "Finalizado"
  | "Cancelado";
type Projeto = {
  id: string;
  nome: string;
  status: string;
  prioridade?: string | null;
  percentual?: number | null;
  plataforma?: string | null;
  setor?: string | null;
  responsavel_nome?: string | null;
  data_inicio?: string | null;
  data_fim?: string | null;
  observacoes?: string | null;
  cliente?: {
    id?: string;
    nome?: string;
  } | null;
  etapa?: {
    id?: string;
    nome?: string;
  } | null;
};
type KanbanBoardProps = {
  projetos: Projeto[];
  onUpdated?: () => void | Promise<void>;
  onEdit?: (projeto: Projeto) => void;
  onOpen360?: (projeto: Projeto) => void;
};
const STATUS_COLUNAS: Status[] = [
  "Não iniciado",
  "Planejado",
  "Em andamento",
  "Pausado",
  "Bloqueado",
  "Finalizado",
  "Cancelado",
];
/**
 * Matriz oficial de transições permitidas pelo Kanban.
 *
 * Finalizado e Cancelado são estados finais.
 */
const TRANSICOES_PERMITIDAS: Record<
  Status,
  Status[]
> = {
  // O Kanban executivo permite reposicionar o projeto livremente
  // entre os status operacionais. Finalizado e Cancelado continuam
  // como estados finais e não são usados como origem de drag.
  "Não iniciado": [
    "Planejado",
    "Em andamento",
    "Pausado",
    "Bloqueado",
    "Finalizado",
    "Cancelado",
  ],
  Planejado: [
    "Não iniciado",
    "Em andamento",
    "Pausado",
    "Bloqueado",
    "Finalizado",
    "Cancelado",
  ],
  "Em andamento": [
    "Não iniciado",
    "Planejado",
    "Pausado",
    "Bloqueado",
    "Finalizado",
    "Cancelado",
  ],
  Pausado: [
    "Não iniciado",
    "Planejado",
    "Em andamento",
    "Bloqueado",
    "Finalizado",
    "Cancelado",
  ],
  Bloqueado: [
    "Não iniciado",
    "Planejado",
    "Em andamento",
    "Pausado",
    "Finalizado",
    "Cancelado",
  ],
  Finalizado: [],
  Cancelado: [],
};
/**
 * Estados que não podem ser arrastados.
 */
const STATUS_BLOQUEADOS_PARA_DRAG: Status[] = [
  "Finalizado",
  "Cancelado",
];
const STATUS_CONFIG: Record<
  Status,
  {
    label: string;
    description: string;
    icon: typeof Circle;
    accent: string;
  }
> = {
  "Não iniciado": {
    label: "Não iniciado",
    description: "Projetos ainda não iniciados",
    icon: Circle,
    accent: "slate",
  },
  Planejado: {
    label: "Planejado",
    description: "Projetos planejados para execução",
    icon: Target,
    accent: "indigo",
  },
  "Em andamento": {
    label: "Em andamento",
    description: "Projetos em execução",
    icon: Play,
    accent: "blue",
  },
  Pausado: {
    label: "Pausado",
    description: "Projetos temporariamente pausados",
    icon: Pause,
    accent: "amber",
  },
  Bloqueado: {
    label: "Bloqueado",
    description: "Projetos com impedimentos",
    icon: Lock,
    accent: "red",
  },
  Finalizado: {
    label: "Finalizado",
    description: "Projetos concluídos",
    icon: Check,
    accent: "emerald",
  },
  Cancelado: {
    label: "Cancelado",
    description: "Projetos cancelados",
    icon: Ban,
    accent: "zinc",
  },
};
const STATUS_CARD_STYLES: Record<
  Status,
  string
> = {
  "Não iniciado":
    "border-white/[0.08] bg-white/[0.025] hover:border-white/[0.14]",
  Planejado:
    "border-indigo-400/20 bg-indigo-500/[0.045] hover:border-indigo-400/35",
  "Em andamento":
    "border-blue-400/20 bg-blue-500/[0.045] hover:border-blue-400/35",
  Pausado:
    "border-amber-400/20 bg-amber-500/[0.045] hover:border-amber-400/35",
  Bloqueado:
    "border-red-400/20 bg-red-500/[0.045] hover:border-red-400/35",
  Finalizado:
    "border-emerald-400/20 bg-emerald-500/[0.045] hover:border-emerald-400/35",
  Cancelado:
    "border-white/[0.06] bg-white/[0.015] hover:border-white/[0.1]",
};
function isStatus(
  value: string,
): value is Status {
  return (
    value === "Não iniciado" ||
    value === "Planejado" ||
    value === "Em andamento" ||
    value === "Pausado" ||
    value === "Bloqueado" ||
    value === "Finalizado" ||
    value === "Cancelado"
  );
}
function getInitials(
  name?: string | null,
) {
  if (!name) {
    return "—";
  }
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 1) {
    return parts[0]
      .slice(0, 2)
      .toUpperCase();
  }
  return (
    parts[0][0] +
    parts[parts.length - 1][0]
  ).toUpperCase();
}
function formatDate(
  value?: string | null,
) {
  if (!value) {
    return "Sem data";
  }
  const date = new Date(
    `${value}T00:00:00`,
  );
  if (Number.isNaN(date.getTime())) {
    return "Sem data";
  }
  return date.toLocaleDateString(
    "pt-BR",
    {
      day: "2-digit",
      month: "2-digit",
    },
  );
}
function getPriorityStyle(
  prioridade?: string | null,
) {
  switch (
    prioridade?.toLowerCase()
  ) {
    case "alta":
      return "border-red-400/20 bg-red-400/10 text-red-300";
    case "média":
    case "media":
      return "border-amber-400/20 bg-amber-400/10 text-amber-300";
    case "baixa":
      return "border-emerald-400/20 bg-emerald-400/10 text-emerald-300";
    default:
      return "border-white/10 bg-white/[0.04] text-white/50";
  }
}
export default function KanbanBoard({
  projetos,
  onUpdated,
  onEdit,
  onOpen360,
}: KanbanBoardProps) {
  const {
    can,
    loading: permissionsLoading,
  } = usePermissions();
  const canChangeStatus =
    can("alterar_status");
  // Mantemos uma cópia local para que o Kanban seja atualizado imediatamente
  // após um PATCH 200, mesmo quando o componente pai ainda não atualizou
  // a prop `projetos`. O pai continua sendo a fonte externa e é sincronizado
  // sempre que seus dados realmente mudarem.
  const [projetosLocais, setProjetosLocais] =
    useState<Projeto[]>(projetos);
  const [draggingId, setDraggingId] =
    useState<string | null>(null);
  // Ref síncrono do drag: evita depender do timing assíncrono do setState.
  const draggingIdRef = useRef<string | null>(null);
  const [dragOverStatus, setDragOverStatus] =
    useState<Status | null>(null);
  const [updatingId, setUpdatingId] =
    useState<string | null>(null);
  const [error, setError] =
    useState("");
  const [success, setSuccess] =
    useState("");
  const [modalAberto, setModalAberto] =
    useState(false);
  const [projetoPendente, setProjetoPendente] =
    useState<Projeto | null>(null);
  const [statusPendente, setStatusPendente] =
    useState<Status | null>(null);
  const [motivo, setMotivo] =
    useState("");
  // Sincroniza alterações vindas do componente pai/refresh da API.
  useEffect(() => {
    setProjetosLocais(projetos);
  }, [projetos]);
  /**
   * Agrupa os projetos pelas colunas.
   */
  const projetosPorStatus =
    useMemo(() => {
      const agrupados: Record<
        Status,
        Projeto[]
      > = {
        "Não iniciado": [],
        Planejado: [],
        "Em andamento": [],
        Pausado: [],
        Bloqueado: [],
        Finalizado: [],
        Cancelado: [],
      };
      for (const projeto of projetosLocais) {
        if (!isStatus(projeto.status)) {
          continue;
        }
        agrupados[projeto.status].push(
          projeto,
        );
      }
      return agrupados;
    }, [projetosLocais]);
  /**
   * Limpa mensagens automaticamente.
   */
  useEffect(() => {
    if (!success) {
      return;
    }
    const timer = window.setTimeout(() => {
      setSuccess("");
    }, 3500);
    return () => {
      window.clearTimeout(timer);
    };
  }, [success]);
  useEffect(() => {
    if (!error) {
      return;
    }
    const timer = window.setTimeout(() => {
      setError("");
    }, 5000);
    return () => {
      window.clearTimeout(timer);
    };
  }, [error]);
  /**
   * Retorna se uma transição é permitida.
   */
  const podeMover = useCallback(
    (
      statusAtual: string,
      novoStatus: Status,
    ) => {
      if (!isStatus(statusAtual)) {
        return false;
      }
      if (statusAtual === novoStatus) {
        return false;
      }
      return TRANSICOES_PERMITIDAS[
        statusAtual
      ].includes(novoStatus);
    },
    [],
  );
  /**
   * Verifica se a nova situação exige motivo.
   */
  const exigeMotivo = useCallback(
    (status: Status) => {
      return (
        status === "Pausado" ||
        status === "Bloqueado" ||
        status === "Cancelado"
      );
    },
    [],
  );
  /**
   * Executa a alteração real de status.
   *
   * IMPORTANTE:
   * Usamos PATCH /status para passar pelo RPC
   * alterar_status_projeto, garantindo histórico,
   * timestamps e regras do backend.
   */
  const alterarStatus = useCallback(
    async (
      projeto: Projeto,
      novoStatus: Status,
      motivoAlteracao?: string,
    ) => {
      if (!canChangeStatus) {
        setError(
          "Seu perfil não possui permissão para alterar status.",
        );
        return;
      }
      if (
        !podeMover(
          projeto.status,
          novoStatus,
        )
      ) {
        setError(
          `A transição de "${projeto.status}" para "${novoStatus}" não é permitida.`,
        );
        return;
      }
      if (
        exigeMotivo(novoStatus) &&
        !motivoAlteracao?.trim()
      ) {
        setError(
          `Informe o motivo para mover o projeto para "${novoStatus}".`,
        );
        return;
      }
      setUpdatingId(projeto.id);
      setError("");
      setSuccess("");
      try {
        const response =
          await fetch(
            `/api/projetos/${projeto.id}/status`,
            {
              method: "PATCH",
              headers: {
                "Content-Type":
                  "application/json",
              },
              credentials:
                "same-origin",
              body: JSON.stringify({
                status: novoStatus,
                motivo:
                  motivoAlteracao?.trim() ||
                  undefined,
              }),
            },
          );
        const data =
          await response.json();
        if (!response.ok) {
          throw new Error(
            data?.error ||
              "Não foi possível alterar o status.",
          );
        }
        const projetoAtualizado =
          data?.projeto ??
          data?.data ??
          data;
        const projetoFinal: Projeto = {
          ...projeto,
          ...(projetoAtualizado || {}),
          status: novoStatus,
        };
        // Atualização otimista/local: garante que o card saia da coluna
        // antiga imediatamente após o backend confirmar o PATCH.
        setProjetosLocais((atuais) =>
          atuais.map((item) =>
            item.id === projeto.id
              ? projetoFinal
              : item,
          ),
        );
        // Mantém a atualização local imediata e também sincroniza
        // a fonte oficial do app/page.tsx.
        if (onUpdated) {
          await onUpdated();
        }
        setSuccess(
          `${projeto.nome} → ${novoStatus}`,
        );
      } catch (err) {
        const mensagem =
          err instanceof Error
            ? err.message
            : "Erro ao alterar status.";
        setError(mensagem);
      } finally {
        draggingIdRef.current = null;
        setUpdatingId(null);
        setDraggingId(null);
        setDragOverStatus(null);
      }
    },
    [
      canChangeStatus,
      exigeMotivo,
      onUpdated,
      podeMover,
    ],
  );
  /**
   * Inicia o drag.
   *
   * CORREÇÃO PRINCIPAL:
   * guardamos o ID no estado draggingId.
   *
   * NÃO dependemos exclusivamente de
   * dataTransfer.getData() durante dragover.
   */
  function handleDragStart(
    event: React.DragEvent,
    projeto: Projeto,
  ) {
    if (
      STATUS_BLOQUEADOS_PARA_DRAG.includes(
        projeto.status as Status,
      )
    ) {
      event.preventDefault();
      setError(
        `Projetos "${projeto.status}" não podem ser movimentados pelo Kanban.`,
      );
      return;
    }
    if (!isStatus(projeto.status)) {
      event.preventDefault();
      setError(
        `O projeto "${projeto.nome}" possui um status inválido.`,
      );
      return;
    }
    setError("");
    setSuccess("");
    /**
     * ESSA É A CORREÇÃO:
     * o ID fica disponível durante todo o drag.
     */
    draggingIdRef.current = projeto.id;
    setDraggingId(projeto.id);
    event.dataTransfer.effectAllowed =
      "move";
    /**
     * Mantemos o dataTransfer como fallback.
     */
    event.dataTransfer.setData(
      "text/plain",
      projeto.id,
    );
  }
  /**
   * Durante o drag sobre uma coluna.
   *
   * CORREÇÃO PRINCIPAL:
   * NÃO usa:
   *
   * event.dataTransfer.getData("text/plain")
   *
   * porque em vários navegadores isso pode
   * retornar vazio durante dragover.
   *
   * Usamos draggingId.
   */
  function handleDragOver(
    event: React.DragEvent,
    novoStatus: Status,
  ) {
    event.preventDefault();
    if (!canChangeStatus) {
      event.dataTransfer.dropEffect =
        "none";
      return;
    }
    /**
     * Usa o ID salvo no estado.
     */
    const projetoId = draggingIdRef.current || draggingId;
    if (!projetoId) {
      event.dataTransfer.dropEffect =
        "none";
      return;
    }
    const projeto = projetosLocais.find(
      (item) => item.id === projetoId,
    );
    if (!projeto) {
      event.dataTransfer.dropEffect =
        "none";
      return;
    }
    if (!isStatus(projeto.status)) {
      event.dataTransfer.dropEffect =
        "none";
      return;
    }
    const permitido =
      projeto.status !== novoStatus &&
      TRANSICOES_PERMITIDAS[
        projeto.status
      ].includes(novoStatus);
    if (!permitido) {
      event.dataTransfer.dropEffect =
        "none";
      setDragOverStatus(null);
      return;
    }
    /**
     * Agora o navegador sabe que a coluna
     * aceita o drop.
     */
    event.dataTransfer.dropEffect =
      "move";
    setDragOverStatus(novoStatus);
  }
  /**
   * Sai de uma coluna.
   *
   * Evita limpar o estado quando o cursor
   * simplesmente passa sobre um elemento filho.
   */
  function handleDragLeave(
    event: React.DragEvent,
    status: Status,
  ) {
    const currentTarget =
      event.currentTarget;
    const relatedTarget =
      event.relatedTarget;
    if (
      relatedTarget instanceof Node &&
      currentTarget.contains(
        relatedTarget,
      )
    ) {
      return;
    }
    if (dragOverStatus === status) {
      setDragOverStatus(null);
    }
  }
  /**
   * Drop.
   *
   * CORREÇÃO:
   * usa draggingId primeiro.
   * dataTransfer fica apenas como fallback.
   */
  function handleDrop(
    event: React.DragEvent,
    novoStatus: Status,
  ) {
    event.preventDefault();
    setDragOverStatus(null);
    if (!canChangeStatus) {
      setError(
        "Seu perfil não possui permissão para alterar status.",
      );
      setDraggingId(null);
      return;
    }
    /**
     * PRIMEIRO usamos o estado.
     *
     * Só usamos dataTransfer como fallback.
     */
    const projetoId =
      draggingIdRef.current ||
      draggingId ||
      event.dataTransfer.getData(
        "text/plain",
      );
    if (!projetoId) {
      setError(
        "Não foi possível identificar o projeto arrastado.",
      );
      setDraggingId(null);
      return;
    }
    const projeto = projetosLocais.find(
      (item) => item.id === projetoId,
    );
    if (!projeto) {
      setError(
        "Projeto não encontrado para movimentação.",
      );
      setDraggingId(null);
      return;
    }
    if (!isStatus(projeto.status)) {
      setError(
        `O projeto "${projeto.nome}" possui um status inválido.`,
      );
      setDraggingId(null);
      return;
    }
    if (
      !podeMover(
        projeto.status,
        novoStatus,
      )
    ) {
      setError(
        `Não é permitido mover "${projeto.status}" para "${novoStatus}".`,
      );
      setDraggingId(null);
      return;
    }
    /**
     * Se exige motivo, abrimos modal.
     */
    if (exigeMotivo(novoStatus)) {
      setProjetoPendente(projeto);
      setStatusPendente(novoStatus);
      setMotivo("");
      setModalAberto(true);
      return;
    }
    /**
     * Transição sem motivo.
     */
    void alterarStatus(
      projeto,
      novoStatus,
    );
  }
  function handleDragEnd() {
    draggingIdRef.current = null;
    setDraggingId(null);
    setDragOverStatus(null);
  }
  /**
   * Confirma o modal de motivo.
   */
  async function confirmarMotivo() {
    if (
      !projetoPendente ||
      !statusPendente
    ) {
      return;
    }
    if (!motivo.trim()) {
      setError(
        `Informe o motivo para mover o projeto para "${statusPendente}".`,
      );
      return;
    }
    setModalAberto(false);
    const projeto =
      projetoPendente;
    const novoStatus =
      statusPendente;
    setProjetoPendente(null);
    setStatusPendente(null);
    await alterarStatus(
      projeto,
      novoStatus,
      motivo,
    );
    setMotivo("");
  }
  function fecharModal() {
    setModalAberto(false);
    setProjetoPendente(null);
    setStatusPendente(null);
    setMotivo("");
    draggingIdRef.current = null;
    setDraggingId(null);
    setDragOverStatus(null);
  }
  return (
    <section className="relative overflow-hidden rounded-[28px] border border-white/[0.08] bg-[#070b12] shadow-[0_30px_90px_rgba(0,0,0,0.28)]">
      {/* HEADER */}
      <div className="border-b border-white/[0.07] px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-blue-400/20 bg-blue-500/10">
                <RotateCcw className="h-5 w-5 text-blue-300" />
              </div>
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-white">
                  Kanban operacional
                </h2>
                <p className="mt-0.5 text-xs text-white/40">
                  Arraste os projetos entre os
                  status permitidos.
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2 text-[11px] text-white/45">
              <GripVertical className="h-3.5 w-3.5" />
              Arraste para mover
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2 text-[11px] text-white/45">
              <ShieldAlert className="h-3.5 w-3.5" />
              Histórico automático
            </div>
            {!permissionsLoading &&
              !canChangeStatus && (
                <div className="flex items-center gap-2 rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-[11px] text-amber-300">
                  <Lock className="h-3.5 w-3.5" />
                  Somente visualização
                </div>
              )}
          </div>
        </div>
        {/* MENSAGENS */}
        <div className="mt-4 space-y-2">
          {error && (
            <div className="flex items-start gap-3 rounded-2xl border border-red-400/20 bg-red-500/[0.07] px-4 py-3 text-sm text-red-200">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-300" />
              <span className="min-w-0 flex-1">
                {error}
              </span>
              <button
                type="button"
                onClick={() =>
                  setError("")
                }
                className="rounded-lg p-1 text-red-300/70 transition hover:bg-white/5 hover:text-red-200"
                aria-label="Fechar mensagem"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
          {success && (
            <div className="flex items-center gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-500/[0.07] px-4 py-3 text-sm text-emerald-200">
              <Check className="h-4 w-4 text-emerald-300" />
              <span>
                {success}
              </span>
            </div>
          )}
        </div>
      </div>
      {/* KANBAN */}
      <div className="overflow-x-auto">
        <div className="grid min-w-[1750px] grid-cols-7 gap-3 p-4 sm:p-5">
          {STATUS_COLUNAS.map(
            (status) => {
              const config =
                STATUS_CONFIG[status];
              const Icon =
                config.icon;
              const cards =
                projetosPorStatus[
                  status
                ];
              const isDropTarget =
                dragOverStatus ===
                status;
              return (
                <div
                  key={status}
                  className={[
                    "flex min-h-[520px] min-w-0 flex-col rounded-[22px] border transition-all duration-200",
                    isDropTarget
                      ? "border-blue-400/50 bg-blue-500/[0.07] shadow-[0_0_0_1px_rgba(96,165,250,0.16),0_20px_60px_rgba(37,99,235,0.10)]"
                      : "border-white/[0.06] bg-white/[0.015]",
                  ].join(" ")}
                  onDragOver={(event) =>
                    handleDragOver(
                      event,
                      status,
                    )
                  }
                  onDragLeave={(event) =>
                    handleDragLeave(
                      event,
                      status,
                    )
                  }
                  onDrop={(event) =>
                    handleDrop(
                      event,
                      status,
                    )
                  }
                >
                  {/* COLUNA HEADER */}
                  <div className="border-b border-white/[0.06] px-3.5 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.035]">
                          <Icon className="h-4 w-4 text-white/65" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="truncate text-xs font-semibold text-white">
                            {config.label}
                          </h3>
                          <p className="mt-0.5 truncate text-[9px] text-white/30">
                            {config.description}
                          </p>
                        </div>
                      </div>
                      <div className="flex h-7 min-w-7 shrink-0 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.035] px-2 text-[10px] font-semibold text-white/55">
                        {cards.length}
                      </div>
                    </div>
                    {draggingId &&
                      !podeMover(
                        projetosLocais.find(
                          (item) =>
                            item.id ===
                            draggingId,
                        )?.status || "",
                        status,
                      ) && (
                        <div className="mt-2 flex items-center gap-1.5 text-[9px] text-white/20">
                          <Lock className="h-3 w-3" />
                          Transição não permitida
                        </div>
                      )}
                  </div>
                  {/* CARDS */}
                  <div className="flex flex-1 flex-col gap-2.5 p-2.5">
                    {cards.length ===
                    0 ? (
                      <div
                        className={[
                          "flex min-h-[150px] flex-1 items-center justify-center rounded-2xl border border-dashed text-center transition-all",
                          isDropTarget
                            ? "border-blue-400/40 bg-blue-500/[0.05]"
                            : "border-white/[0.06] bg-white/[0.01]",
                        ].join(" ")}
                      >
                        <div>
                          <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.025]">
                            {isDropTarget ? (
                              <ChevronDown className="h-4 w-4 text-blue-300" />
                            ) : (
                              <Circle className="h-4 w-4 text-white/15" />
                            )}
                          </div>
                          <p className="text-[10px] text-white/25">
                            {isDropTarget
                              ? "Solte aqui"
                              : "Nenhum projeto"}
                          </p>
                        </div>
                      </div>
                    ) : (
                      cards.map(
                        (projeto) => {
                          const isDragging =
                            draggingId ===
                            projeto.id;
                          const updating =
                            updatingId ===
                            projeto.id;
                          const dragDisabled =
                            STATUS_BLOQUEADOS_PARA_DRAG.includes(
                              projeto.status as Status,
                            ) || updating;
                          const cliente =
                            projeto
                              .cliente
                              ?.nome ||
                            "Cliente não informado";
                          const percentual =
                            Math.min(
                              100,
                              Math.max(
                                0,
                                Number(
                                  projeto.percentual ??
                                    0,
                                ),
                              ),
                            );
                          return (
                            <article
                              key={
                                projeto.id
                              }
                              draggable={!dragDisabled}
                              onDragStart={(
                                event,
                              ) =>
                                handleDragStart(
                                  event,
                                  projeto,
                                )
                              }
                              onDragEnd={
                                handleDragEnd
                              }
                              onClick={() => {
                                if (
                                  !updating &&
                                  onOpen360
                                ) {
                                  onOpen360(
                                    projeto,
                                  );
                                }
                              }}
                              className={[
                                "group relative rounded-2xl border p-3 transition-all duration-200",
                                STATUS_CARD_STYLES[
                                  isStatus(
                                    projeto.status,
                                  )
                                    ? projeto.status
                                    : "Não iniciado"
                                ],
                                dragDisabled
                                  ? "cursor-default"
                                  : "cursor-grab active:cursor-grabbing",
                                isDragging
                                  ? "scale-[0.98] opacity-40"
                                  : "opacity-100",
                                updating
                                  ? "pointer-events-none opacity-60"
                                  : "",
                              ].join(
                                " ",
                              )}
                            >
                              {/* INDICADOR SUPERIOR */}
                              <div className="absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                              <div className="flex items-start gap-2">
                                {!dragDisabled && (
                                  <div className="mt-0.5 shrink-0 text-white/15 transition-colors group-hover:text-white/35">
                                    <GripVertical className="h-4 w-4" />
                                  </div>
                                )}
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                      <h4 className="line-clamp-2 text-[12px] font-semibold leading-4 text-white">
                                        {
                                          projeto.nome
                                        }
                                      </h4>
                                      <p className="mt-1 truncate text-[10px] text-white/40">
                                        {
                                          cliente
                                        }
                                      </p>
                                    </div>
                                    {updating && (
                                      <Loader2 className="h-4 w-4 shrink-0 animate-spin text-blue-300" />
                                    )}
                                  </div>
                                  {/* META */}
                                  <div className="mt-3 flex flex-wrap gap-1.5">
                                    {projeto.prioridade && (
                                      <span
                                        className={[
                                          "rounded-lg border px-1.5 py-1 text-[8px] font-medium",
                                          getPriorityStyle(
                                            projeto.prioridade,
                                          ),
                                        ].join(
                                          " ",
                                        )}
                                      >
                                        {
                                          projeto.prioridade
                                        }
                                      </span>
                                    )}
                                    {projeto.etapa
                                      ?.nome && (
                                      <span className="max-w-[130px] truncate rounded-lg border border-white/[0.07] bg-white/[0.03] px-1.5 py-1 text-[8px] text-white/45">
                                        {
                                          projeto
                                            .etapa
                                            .nome
                                        }
                                      </span>
                                    )}
                                    {projeto.setor && (
                                      <span className="max-w-[100px] truncate rounded-lg border border-white/[0.07] bg-white/[0.03] px-1.5 py-1 text-[8px] text-white/35">
                                        {
                                          projeto.setor
                                        }
                                      </span>
                                    )}
                                  </div>
                                  {/* RESPONSÁVEL */}
                                  {projeto.responsavel_nome && (
                                    <div className="mt-3 flex items-center gap-2">
                                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.05] text-[8px] font-semibold text-white/60">
                                        {getInitials(
                                          projeto.responsavel_nome,
                                        )}
                                      </div>
                                      <div className="min-w-0">
                                        <p className="truncate text-[9px] font-medium text-white/55">
                                          {
                                            projeto.responsavel_nome
                                          }
                                        </p>
                                        <p className="text-[8px] text-white/25">
                                          Responsável
                                        </p>
                                      </div>
                                    </div>
                                  )}
                                  {/* PROGRESSO */}
                                  <div className="mt-3">
                                    <div className="mb-1.5 flex items-center justify-between">
                                      <span className="text-[8px] uppercase tracking-[0.12em] text-white/25">
                                        Progresso
                                      </span>
                                      <span className="text-[9px] font-semibold text-white/55">
                                        {
                                          percentual
                                        }
                                        %
                                      </span>
                                    </div>
                                    <div className="h-1 overflow-hidden rounded-full bg-white/[0.06]">
                                      <div
                                        className="h-full rounded-full bg-blue-400/70 transition-all duration-500"
                                        style={{
                                          width: `${percentual}%`,
                                        }}
                                      />
                                    </div>
                                  </div>
                                  {/* DATAS */}
                                  {(projeto.data_inicio ||
                                    projeto.data_fim) && (
                                    <div className="mt-3 flex items-center gap-1.5 text-[8px] text-white/25">
                                      <Clock3 className="h-3 w-3 shrink-0" />
                                      <span>
                                        {
                                          formatDate(
                                            projeto.data_inicio,
                                          )
                                        }
                                      </span>
                                      <span className="text-white/10">
                                        →
                                      </span>
                                      <span>
                                        {
                                          formatDate(
                                            projeto.data_fim,
                                          )
                                        }
                                      </span>
                                    </div>
                                  )}
                                  {/* EDITAR */}
                                  {onEdit &&
                                    can(
                                      "editar",
                                    ) && (
                                      <button
                                        type="button"
                                        onClick={(
                                          event,
                                        ) => {
                                          event.stopPropagation();
                                          onEdit(
                                            projeto,
                                          );
                                        }}
                                        className="mt-3 w-full rounded-xl border border-white/[0.06] bg-white/[0.025] px-2.5 py-2 text-[9px] font-medium text-white/35 opacity-0 transition-all hover:border-white/[0.12] hover:bg-white/[0.05] hover:text-white/70 group-hover:opacity-100"
                                      >
                                        Editar projeto
                                      </button>
                                    )}
                                </div>
                              </div>
                            </article>
                          );
                        },
                      )
                    )}
                  </div>
                </div>
              );
            },
          )}
        </div>
      </div>
      {/* LEGENDA DE TRANSIÇÕES */}
      <div className="border-t border-white/[0.06] px-5 py-4 sm:px-6">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2 text-[10px] text-white/30">
            <ShieldAlert className="h-3.5 w-3.5 text-blue-300/60" />
            <span>
              Transições controladas pelo
              fluxo operacional.
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <span className="rounded-lg border border-white/[0.06] bg-white/[0.025] px-2 py-1 text-[8px] text-white/30">
              Planejado → Em andamento
            </span>
            <span className="rounded-lg border border-white/[0.06] bg-white/[0.025] px-2 py-1 text-[8px] text-white/30">
              Em andamento → Finalizado
            </span>
            <span className="rounded-lg border border-white/[0.06] bg-white/[0.025] px-2 py-1 text-[8px] text-white/30">
              Em andamento → Pausado
            </span>
            <span className="rounded-lg border border-white/[0.06] bg-white/[0.025] px-2 py-1 text-[8px] text-white/30">
              Bloqueado → Em andamento
            </span>
          </div>
        </div>
      </div>
      {/* MODAL DE MOTIVO */}
      {modalAberto &&
        projetoPendente &&
        statusPendente && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-md">
            <div className="w-full max-w-lg overflow-hidden rounded-[26px] border border-white/[0.1] bg-[#0a0f18] shadow-[0_40px_120px_rgba(0,0,0,0.65)]">
              {/* MODAL HEADER */}
              <div className="border-b border-white/[0.07] px-5 py-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-400/20 bg-amber-500/10">
                      <AlertCircle className="h-5 w-5 text-amber-300" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-white">
                        Motivo da alteração
                      </h3>
                      <p className="mt-1 text-xs leading-5 text-white/40">
                        O status{" "}
                        <span className="font-medium text-white/65">
                          {statusPendente}
                        </span>{" "}
                        exige justificativa.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={
                      fecharModal
                    }
                    className="rounded-xl p-2 text-white/30 transition hover:bg-white/[0.05] hover:text-white/70"
                    aria-label="Fechar"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>
              {/* PROJETO */}
              <div className="px-5 pt-5">
                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
                  <p className="text-[9px] uppercase tracking-[0.14em] text-white/25">
                    Projeto
                  </p>
                  <p className="mt-1.5 text-sm font-semibold text-white">
                    {
                      projetoPendente.nome
                    }
                  </p>
                  <div className="mt-3 flex items-center gap-2 text-[10px] text-white/35">
                    <span>
                      {
                        projetoPendente.status
                      }
                    </span>
                    <span className="text-white/15">
                      →
                    </span>
                    <span className="text-amber-300/80">
                      {
                        statusPendente
                      }
                    </span>
                  </div>
                </div>
              </div>
              {/* TEXTAREA */}
              <div className="px-5 py-5">
                <label
                  htmlFor="kanban-motivo"
                  className="mb-2 block text-xs font-medium text-white/65"
                >
                  Motivo
                </label>
                <textarea
                  id="kanban-motivo"
                  value={motivo}
                  onChange={(event) =>
                    setMotivo(
                      event.target.value,
                    )
                  }
                  placeholder="Descreva o motivo da alteração..."
                  rows={5}
                  autoFocus
                  className="w-full resize-none rounded-2xl border border-white/[0.08] bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-white/20 transition focus:border-blue-400/40 focus:bg-black/30 focus:ring-2 focus:ring-blue-400/10"
                />
                <p className="mt-2 text-[9px] text-white/25">
                  Essa informação será
                  registrada no histórico do
                  projeto.
                </p>
              </div>
              {/* ACTIONS */}
              <div className="flex flex-col-reverse gap-2 border-t border-white/[0.07] bg-white/[0.015] px-5 py-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={
                    fecharModal
                  }
                  className="rounded-xl border border-white/[0.08] bg-white/[0.025] px-4 py-2.5 text-xs font-medium text-white/55 transition hover:bg-white/[0.05] hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() =>
                    void confirmarMotivo()
                  }
                  disabled={
                    !motivo.trim() ||
                    updatingId !== null
                  }
                  className="flex items-center justify-center gap-2 rounded-xl border border-blue-400/20 bg-blue-500/15 px-4 py-2.5 text-xs font-semibold text-blue-200 transition hover:bg-blue-500/25 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {updatingId ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  Confirmar alteração
                </button>
              </div>
            </div>
          </div>
        )}
    </section>
  );
}