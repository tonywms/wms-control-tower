"use client";

import {
  CheckCircle2,
  CirclePause,
  Play,
  RotateCcw,
  ShieldAlert,
  XCircle,
  Pencil,
  MoreHorizontal,
} from "lucide-react";
import { useState } from "react";
import { usePermissions } from "@/components/auth/usePermissions";

type Status =
  | "Não iniciado"
  | "Planejado"
  | "Em andamento"
  | "Pausado"
  | "Bloqueado"
  | "Finalizado"
  | "Cancelado";

type ProjetoActionsProps = {
  projetoId: string;
  status: Status;
  onEdit?: () => void;
  onUpdated?: () => void;
};

const STATUS_ACTIONS: Record<
  Status,
  Array<{
    label: string;
    status: Status;
    icon: typeof Play;
    danger?: boolean;
  }>
> = {
  "Não iniciado": [
    {
      label: "Iniciar projeto",
      status: "Em andamento",
      icon: Play,
    },
    {
      label: "Bloquear",
      status: "Bloqueado",
      icon: ShieldAlert,
      danger: true,
    },
  ],

  Planejado: [
    {
      label: "Iniciar projeto",
      status: "Em andamento",
      icon: Play,
    },
    {
      label: "Bloquear",
      status: "Bloqueado",
      icon: ShieldAlert,
      danger: true,
    },
  ],

  "Em andamento": [
    {
      label: "Pausar",
      status: "Pausado",
      icon: CirclePause,
    },
    {
      label: "Bloquear",
      status: "Bloqueado",
      icon: ShieldAlert,
      danger: true,
    },
    {
      label: "Finalizar",
      status: "Finalizado",
      icon: CheckCircle2,
    },
  ],

  Pausado: [
    {
      label: "Retomar",
      status: "Em andamento",
      icon: RotateCcw,
    },
    {
      label: "Bloquear",
      status: "Bloqueado",
      icon: ShieldAlert,
      danger: true,
    },
  ],

  Bloqueado: [
    {
      label: "Retomar",
      status: "Em andamento",
      icon: RotateCcw,
    },
    {
      label: "Cancelar",
      status: "Cancelado",
      icon: XCircle,
      danger: true,
    },
  ],

  Finalizado: [],

  Cancelado: [],
};

export default function ProjetoActions({
  projetoId,
  status,
  onEdit,
  onUpdated,
}: ProjetoActionsProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [motivoOpen, setMotivoOpen] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [pendingStatus, setPendingStatus] =
    useState<Status | null>(null);
  const [error, setError] = useState("");

  const {
    can,
    loading: permissionsLoading,
  } = usePermissions();

  const canEdit = can("editar");
  const canChangeStatus = can("alterar_status");

  const actions = canChangeStatus
    ? STATUS_ACTIONS[status] ?? []
    : [];

  const hasPermission =
    permissionsLoading ||
    canEdit ||
    canChangeStatus;

  function selecionarStatus(novoStatus: Status) {
    if (!canChangeStatus) {
      return;
    }

    setError("");

    if (
      novoStatus === "Pausado" ||
      novoStatus === "Bloqueado" ||
      novoStatus === "Cancelado"
    ) {
      setPendingStatus(novoStatus);
      setMotivo("");
      setMotivoOpen(true);
      setOpen(false);
      return;
    }

    executarStatus(novoStatus);
  }

  async function executarStatus(
    novoStatus: Status,
    motivoAtual = "",
  ) {
    if (!canChangeStatus) {
      return;
    }

    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `/api/projetos/${projetoId}/status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status: novoStatus,
            motivo: motivoAtual || null,
            usuario_nome: "Tony Moreira",
          }),
        },
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error ||
            "Não foi possível alterar o status.",
        );
      }

      setMotivoOpen(false);
      setPendingStatus(null);
      setMotivo("");
      setOpen(false);

      onUpdated?.();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Erro ao alterar status.",
      );
    } finally {
      setLoading(false);
    }
  }

  if (!hasPermission) {
    return null;
  }

  return (
    <>
      <div className="relative">
        <button
          type="button"
          disabled={permissionsLoading}
          onClick={() => {
            if (!permissionsLoading) {
              setOpen((value) => !value);
            }
          }}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-slate-400 transition hover:border-white/[0.14] hover:bg-white/[0.06] hover:text-white disabled:cursor-wait disabled:opacity-50"
          title={
            permissionsLoading
              ? "Carregando permissões..."
              : "Ações"
          }
        >
          <MoreHorizontal size={17} />
        </button>

        {open && !permissionsLoading && (
          <div className="absolute right-0 top-11 z-50 w-56 overflow-hidden rounded-2xl border border-white/[0.09] bg-[#0a0f18]/95 p-1.5 shadow-2xl shadow-black/50 backdrop-blur-xl">
            {canEdit && (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onEdit?.();
                }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-slate-300 transition hover:bg-white/[0.06] hover:text-white"
              >
                <Pencil size={15} />
                Editar projeto
              </button>
            )}

            {canEdit && actions.length > 0 && (
              <div className="my-1 border-t border-white/[0.06]" />
            )}

            {actions.map((action) => {
              const Icon = action.icon;

              return (
                <button
                  key={action.label}
                  type="button"
                  disabled={loading}
                  onClick={() =>
                    selecionarStatus(action.status)
                  }
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                    action.danger
                      ? "text-red-300 hover:bg-red-500/[0.08] hover:text-red-200"
                      : "text-slate-300 hover:bg-white/[0.06] hover:text-white"
                  } disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  <Icon size={15} />
                  {action.label}
                </button>
              );
            })}

            {!canEdit &&
              !canChangeStatus && (
                <div className="px-3 py-2.5 text-sm text-slate-500">
                  Você não possui ações disponíveis.
                </div>
              )}
          </div>
        )}
      </div>

      {motivoOpen && pendingStatus && canChangeStatus && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-white/[0.09] bg-[#090e17] p-6 shadow-2xl shadow-black/70">
            <div className="mb-5">
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-sky-400">
                Alteração de status
              </div>

              <h3 className="text-xl font-semibold text-white">
                {pendingStatus}
              </h3>

              <p className="mt-2 text-sm leading-6 text-slate-400">
                Registre o motivo desta alteração. Essa
                informação ficará salva no histórico do projeto.
              </p>
            </div>

            <textarea
              value={motivo}
              onChange={(event) =>
                setMotivo(event.target.value)
              }
              rows={4}
              autoFocus
              placeholder="Informe o motivo..."
              className="w-full resize-none rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-sky-500/40 focus:bg-white/[0.045]"
            />

            {error && (
              <div className="mt-3 rounded-xl border border-red-500/20 bg-red-500/[0.07] px-3 py-2 text-sm text-red-300">
                {error}
              </div>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={loading}
                onClick={() => {
                  setMotivoOpen(false);
                  setPendingStatus(null);
                  setMotivo("");
                }}
                className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-white/[0.06] hover:text-white"
              >
                Cancelar
              </button>

              <button
                type="button"
                disabled={
                  loading ||
                  !motivo.trim()
                }
                onClick={() =>
                  executarStatus(
                    pendingStatus,
                    motivo.trim(),
                  )
                }
                className="rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {loading
                  ? "Salvando..."
                  : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}