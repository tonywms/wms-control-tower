"use client";

import {
  AlertTriangle,
  Building2,
  Check,
  ChevronLeft,
  CircleOff,
  Edit3,
  MapPin,
  Plus,
  Power,
  Search,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePermissions } from "@/components/auth/usePermissions";

type Cliente = {
  id: string;
  nome: string;
  cidade: string | null;
  ativo: boolean;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
  quantidade_projetos: number;
};

type ApiResponse = {
  success: boolean;
  total?: number;
  clientes?: Cliente[];
  cliente?: Cliente;
  message?: string;
  error?: string;
};

type FormularioCliente = {
  nome: string;
  cidade: string;
  observacoes: string;
};

const FORMULARIO_INICIAL: FormularioCliente = {
  nome: "",
  cidade: "",
  observacoes: "",
};

export default function ClientesPage() {
  const { can, loading: permissionsLoading } =
    usePermissions();

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [mostrarInativos, setMostrarInativos] =
    useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [clienteSelecionado, setClienteSelecionado] =
    useState<Cliente | null>(null);

  const [formulario, setFormulario] =
    useState<FormularioCliente>(FORMULARIO_INICIAL);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [confirmacao, setConfirmacao] = useState<{
    tipo: "inativar" | "excluir";
    cliente: Cliente;
  } | null>(null);

  const loadClientes = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const params = new URLSearchParams();

      if (search.trim()) {
        params.set("search", search.trim());
      }

      params.set(
        "includeInactive",
        String(mostrarInativos),
      );

      const response = await fetch(
        `/api/clientes?${params.toString()}`,
        {
          cache: "no-store",
        },
      );

      const data =
        (await response.json()) as ApiResponse;

      if (!response.ok || !data.success) {
        throw new Error(
          data.error ||
            `Erro HTTP ${response.status}`,
        );
      }

      setClientes(data.clientes ?? []);
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Erro ao carregar clientes.",
      );
    } finally {
      setLoading(false);
    }
  }, [search, mostrarInativos]);

  useEffect(() => {
    if (!permissionsLoading) {
      loadClientes();
    }
  }, [
    loadClientes,
    permissionsLoading,
  ]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!permissionsLoading) {
        loadClientes();
      }
    }, 250);

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    search,
    permissionsLoading,
    loadClientes,
  ]);

  const clientesAtivos = useMemo(
    () =>
      clientes.filter(
        (cliente) => cliente.ativo,
      ).length,
    [clientes],
  );

  const clientesInativos = useMemo(
    () =>
      clientes.filter(
        (cliente) => !cliente.ativo,
      ).length,
    [clientes],
  );

  const totalProjetos = useMemo(
    () =>
      clientes.reduce(
        (total, cliente) =>
          total +
          cliente.quantidade_projetos,
        0,
      ),
    [clientes],
  );

  function abrirNovoCliente() {
    setClienteSelecionado(null);
    setFormulario(FORMULARIO_INICIAL);
    setError("");
    setSuccess("");
    setModalOpen(true);
  }

  function abrirEdicao(cliente: Cliente) {
    setClienteSelecionado(cliente);

    setFormulario({
      nome: cliente.nome,
      cidade: cliente.cidade ?? "",
      observacoes:
        cliente.observacoes ?? "",
    });

    setError("");
    setSuccess("");
    setModalOpen(true);
  }

  function fecharModal() {
    if (saving) {
      return;
    }

    setModalOpen(false);
    setClienteSelecionado(null);
    setFormulario(FORMULARIO_INICIAL);
  }

  async function salvarCliente(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!can("editar")) {
      setError(
        "Seu perfil não possui permissão para editar clientes.",
      );
      return;
    }

    if (!formulario.nome.trim()) {
      setError(
        "Informe o nome do cliente.",
      );
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const editing = Boolean(
        clienteSelecionado,
      );

      const response = await fetch(
        editing
          ? `/api/clientes/${clienteSelecionado?.id}`
          : "/api/clientes",
        {
          method: editing ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            nome: formulario.nome,
            cidade: formulario.cidade,
            observacoes:
              formulario.observacoes,
          }),
        },
      );

      const data =
        (await response.json()) as ApiResponse;

      if (!response.ok || !data.success) {
        throw new Error(
          data.error ||
            "Não foi possível salvar o cliente.",
        );
      }

      setSuccess(
        editing
          ? "Cliente atualizado com sucesso."
          : "Cliente criado com sucesso.",
      );

      setModalOpen(false);
      setClienteSelecionado(null);
      setFormulario(FORMULARIO_INICIAL);

      await loadClientes();
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Erro ao salvar cliente.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function alterarAtivo(
    cliente: Cliente,
  ) {
    if (!can("editar")) {
      setError(
        "Seu perfil não possui permissão para alterar clientes.",
      );
      return;
    }

    try {
      setSaving(true);
      setError("");

      const response = await fetch(
        `/api/clientes/${cliente.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ativo: !cliente.ativo,
          }),
        },
      );

      const data =
        (await response.json()) as ApiResponse;

      if (!response.ok || !data.success) {
        throw new Error(
          data.error ||
            "Não foi possível alterar o status do cliente.",
        );
      }

      setSuccess(
        cliente.ativo
          ? `Cliente "${cliente.nome}" foi inativado.`
          : `Cliente "${cliente.nome}" foi reativado.`,
      );

      setConfirmacao(null);

      await loadClientes();
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Erro ao alterar status do cliente.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function excluirCliente(
    cliente: Cliente,
  ) {
    if (!can("excluir")) {
      setError(
        "Seu perfil não possui permissão para excluir clientes.",
      );
      return;
    }

    try {
      setSaving(true);
      setError("");

      const response = await fetch(
        `/api/clientes/${cliente.id}`,
        {
          method: "DELETE",
        },
      );

      const data =
        (await response.json()) as ApiResponse;

      if (!response.ok || !data.success) {
        throw new Error(
          data.error ||
            "Não foi possível excluir o cliente.",
        );
      }

      setSuccess(
        `Cliente "${cliente.nome}" excluído com sucesso.`,
      );

      setConfirmacao(null);

      await loadClientes();
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Erro ao excluir cliente.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (permissionsLoading) {
    return (
      <div className="min-h-screen bg-[#05080d] text-slate-200">
        <div className="flex min-h-screen items-center justify-center">
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] px-6 py-5 text-sm text-slate-400">
            Carregando permissões...
          </div>
        </div>
      </div>
    );
  }

  if (!can("visualizar")) {
    return (
      <div className="min-h-screen bg-[#05080d] text-slate-200">
        <div className="flex min-h-screen items-center justify-center p-6">
          <div className="w-full max-w-md rounded-3xl border border-red-500/15 bg-red-500/[0.04] p-7 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/10 text-red-300">
              <AlertTriangle size={21} />
            </div>

            <h1 className="mt-5 text-lg font-semibold text-slate-100">
              Acesso não autorizado
            </h1>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              Seu perfil não possui permissão para
              visualizar o cadastro de clientes.
            </p>

            <Link
              href="/"
              className="mt-6 inline-flex h-10 items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 text-xs font-medium text-slate-300 transition hover:bg-white/[0.07]"
            >
              <ChevronLeft size={15} />
              Voltar ao Control Tower
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#05080d] text-slate-200">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-sky-500/[0.035] blur-3xl" />
        <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-blue-500/[0.025] blur-3xl" />
      </div>

      <div className="relative mx-auto w-full max-w-[1500px] px-5 py-6 sm:px-8 lg:px-10">
        <header className="flex flex-col gap-5 border-b border-white/[0.06] pb-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Link
              href="/"
              className="mb-4 inline-flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.18em] text-slate-600 transition hover:text-slate-300"
            >
              <ChevronLeft size={13} />
              Control Tower
            </Link>

            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-sky-400/10 bg-sky-400/[0.06] text-sky-300">
                <Building2 size={21} />
              </div>

              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-sky-400/70">
                  Administração
                </div>

                <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-100">
                  Clientes
                </h1>

                <p className="mt-1 text-xs text-slate-600">
                  Cadastro mestre dos clientes do WMS
                  Expert Control Tower.
                </p>
              </div>
            </div>
          </div>

          {can("editar") && (
            <button
              type="button"
              onClick={abrirNovoCliente}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-sky-400/20 bg-sky-400/[0.08] px-5 text-xs font-semibold text-sky-200 shadow-[0_10px_40px_rgba(14,165,233,0.06)] transition hover:border-sky-400/30 hover:bg-sky-400/[0.13]"
            >
              <Plus size={16} />
              Novo cliente
            </button>
          )}
        </header>

        {error && (
          <div className="mt-5 flex items-start gap-3 rounded-2xl border border-red-500/15 bg-red-500/[0.045] px-4 py-3.5 text-xs text-red-300">
            <AlertTriangle
              size={16}
              className="mt-0.5 shrink-0"
            />

            <span className="flex-1">
              {error}
            </span>

            <button
              type="button"
              onClick={() => setError("")}
              className="text-red-400/60 transition hover:text-red-300"
            >
              <X size={15} />
            </button>
          </div>
        )}

        {success && (
          <div className="mt-5 flex items-center gap-3 rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.04] px-4 py-3.5 text-xs text-emerald-300">
            <Check size={16} />

            <span className="flex-1">
              {success}
            </span>

            <button
              type="button"
              onClick={() => setSuccess("")}
              className="text-emerald-400/60 transition hover:text-emerald-300"
            >
              <X size={15} />
            </button>
          </div>
        )}

        <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard
            label="Clientes exibidos"
            value={clientes.length}
            icon={Building2}
          />

          <MetricCard
            label="Ativos"
            value={clientesAtivos}
            icon={Check}
          />

          <MetricCard
            label="Inativos"
            value={clientesInativos}
            icon={CircleOff}
          />

          <MetricCard
            label="Projetos vinculados"
            value={totalProjetos}
            icon={Users}
          />
        </section>

        <section className="mt-6 overflow-hidden rounded-3xl border border-white/[0.06] bg-white/[0.018] shadow-[0_20px_80px_rgba(0,0,0,0.18)]">
          <div className="flex flex-col gap-4 border-b border-white/[0.06] p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-md">
              <Search
                size={15}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600"
              />

              <input
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Buscar cliente ou cidade..."
                className="h-10 w-full rounded-xl border border-white/[0.07] bg-white/[0.025] pl-10 pr-4 text-xs text-slate-300 outline-none transition placeholder:text-slate-700 focus:border-sky-400/25 focus:bg-white/[0.04]"
              />
            </div>

            <label className="flex cursor-pointer items-center gap-2 text-[10px] text-slate-500">
              <input
                type="checkbox"
                checked={mostrarInativos}
                onChange={(event) =>
                  setMostrarInativos(
                    event.target.checked,
                  )
                }
                className="h-3.5 w-3.5 rounded border-white/10 bg-white/5 accent-sky-400"
              />

              Mostrar inativos
            </label>
          </div>

          <div className="hidden grid-cols-[minmax(260px,1.5fr)_minmax(180px,1fr)_130px_130px_110px] gap-4 border-b border-white/[0.045] px-5 py-3 text-[9px] font-semibold uppercase tracking-[0.15em] text-slate-700 lg:grid">
            <span>Cliente</span>
            <span>Localização</span>
            <span>Projetos</span>
            <span>Status</span>
            <span className="text-right">
              Ações
            </span>
          </div>

          {loading ? (
            <div className="space-y-px">
              {Array.from({
                length: 6,
              }).map((_, index) => (
                <div
                  key={index}
                  className="h-[78px] animate-pulse border-b border-white/[0.035] bg-white/[0.01]"
                />
              ))}
            </div>
          ) : clientes.length === 0 ? (
            <div className="px-6 py-20 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-white/[0.06] bg-white/[0.025] text-slate-600">
                <Building2 size={20} />
              </div>

              <h2 className="mt-4 text-sm font-medium text-slate-400">
                Nenhum cliente encontrado
              </h2>

              <p className="mt-1 text-xs text-slate-700">
                Ajuste a busca ou cadastre um novo
                cliente.
              </p>
            </div>
          ) : (
            <div>
              {clientes.map((cliente) => (
                <ClienteRow
                  key={cliente.id}
                  cliente={cliente}
                  canEdit={can("editar")}
                  canDelete={can("excluir")}
                  onEdit={() =>
                    abrirEdicao(cliente)
                  }
                  onToggle={() =>
                    setConfirmacao({
                      tipo: "inativar",
                      cliente,
                    })
                  }
                  onDelete={() =>
                    setConfirmacao({
                      tipo: "excluir",
                      cliente,
                    })
                  }
                />
              ))}
            </div>
          )}
        </section>
      </div>

      {modalOpen && (
        <ClienteModal
          cliente={clienteSelecionado}
          formulario={formulario}
          saving={saving}
          onChange={setFormulario}
          onClose={fecharModal}
          onSubmit={salvarCliente}
        />
      )}

      {confirmacao && (
        <ConfirmacaoModal
          confirmacao={confirmacao}
          saving={saving}
          onClose={() =>
            !saving &&
            setConfirmacao(null)
          }
          onConfirm={() => {
            if (
              confirmacao.tipo ===
              "excluir"
            ) {
              excluirCliente(
                confirmacao.cliente,
              );
            } else {
              alterarAtivo(
                confirmacao.cliente,
              );
            }
          }}
        />
      )}
    </main>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: typeof Building2;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.018] p-4">
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-semibold uppercase tracking-[0.15em] text-slate-700">
          {label}
        </span>

        <Icon
          size={14}
          className="text-slate-700"
        />
      </div>

      <div className="mt-3 text-2xl font-semibold tracking-tight text-slate-200">
        {value}
      </div>
    </div>
  );
}

function ClienteRow({
  cliente,
  canEdit,
  canDelete,
  onEdit,
  onToggle,
  onDelete,
}: {
  cliente: Cliente;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const initials = cliente.nome
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <div
      className={[
        "group grid grid-cols-1 gap-4 border-b border-white/[0.035] px-5 py-4 transition",
        "hover:bg-white/[0.018]",
        "lg:grid-cols-[minmax(260px,1.5fr)_minmax(180px,1fr)_130px_130px_110px] lg:items-center",
        !cliente.ativo
          ? "opacity-55"
          : "",
      ].join(" ")}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.025] text-[10px] font-semibold text-slate-500">
          {initials || "CL"}
        </div>

        <div className="min-w-0">
          <div className="truncate text-xs font-semibold text-slate-300">
            {cliente.nome}
          </div>

          <div className="mt-1 flex items-center gap-2 text-[9px] text-slate-700">
            <span>
              Criado em{" "}
              {formatDate(
                cliente.created_at,
              )}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs text-slate-500">
        <MapPin
          size={13}
          className="text-slate-700"
        />

        <span>
          {cliente.cidade ||
            "Local não informado"}
        </span>
      </div>

      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Users
          size={13}
          className="text-slate-700"
        />

        {cliente.quantidade_projetos}
        <span className="text-[9px] text-slate-700">
          projeto(s)
        </span>
      </div>

      <div>
        {cliente.ativo ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/10 bg-emerald-400/[0.05] px-2.5 py-1 text-[9px] font-medium text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Ativo
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-500/10 bg-slate-500/[0.05] px-2.5 py-1 text-[9px] font-medium text-slate-500">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
            Inativo
          </span>
        )}
      </div>

      <div className="flex items-center justify-start gap-1 lg:justify-end">
        {canEdit && (
          <>
            <button
              type="button"
              onClick={onEdit}
              title="Editar cliente"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 transition hover:bg-white/[0.05] hover:text-sky-300"
            >
              <Edit3 size={14} />
            </button>

            <button
              type="button"
              onClick={onToggle}
              title={
                cliente.ativo
                  ? "Inativar cliente"
                  : "Reativar cliente"
              }
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 transition hover:bg-white/[0.05] hover:text-amber-300"
            >
              <Power size={14} />
            </button>
          </>
        )}

        {canDelete && (
          <button
            type="button"
            onClick={onDelete}
            title="Excluir cliente"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-700 transition hover:bg-red-500/[0.06] hover:text-red-300"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

function ClienteModal({
  cliente,
  formulario,
  saving,
  onChange,
  onClose,
  onSubmit,
}: {
  cliente: Cliente | null;
  formulario: FormularioCliente;
  saving: boolean;
  onChange: (
    formulario: FormularioCliente,
  ) => void;
  onClose: () => void;
  onSubmit: (
    event: FormEvent<HTMLFormElement>,
  ) => void;
}) {
  const editing = Boolean(cliente);

  function update(
    field: keyof FormularioCliente,
    value: string,
  ) {
    onChange({
      ...formulario,
      [field]: value,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl overflow-hidden rounded-3xl border border-white/[0.08] bg-[#090e15] shadow-[0_30px_120px_rgba(0,0,0,0.55)]">
        <div className="flex items-start justify-between border-b border-white/[0.06] px-6 py-5">
          <div>
            <div className="text-[9px] font-semibold uppercase tracking-[0.2em] text-sky-400/70">
              Cadastro mestre
            </div>

            <h2 className="mt-1 text-lg font-semibold text-slate-100">
              {editing
                ? "Editar cliente"
                : "Novo cliente"}
            </h2>

            <p className="mt-1 text-xs text-slate-600">
              Os dados serão gravados diretamente
              no Control Tower.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 transition hover:bg-white/[0.05] hover:text-slate-300 disabled:opacity-40"
          >
            <X size={16} />
          </button>
        </div>

        <form
          onSubmit={onSubmit}
          className="space-y-5 px-6 py-6"
        >
          <Field
            label="Nome do cliente"
            required
          >
            <input
              value={formulario.nome}
              onChange={(event) =>
                update(
                  "nome",
                  event.target.value,
                )
              }
              placeholder="Ex.: Alvoar"
              maxLength={150}
              autoFocus
              className="input"
            />
          </Field>

          <Field label="Cidade / UF">
            <input
              value={formulario.cidade}
              onChange={(event) =>
                update(
                  "cidade",
                  event.target.value,
                )
              }
              placeholder="Ex.: Fortaleza-CE"
              maxLength={150}
              className="input"
            />
          </Field>

          <Field label="Observações">
            <textarea
              value={formulario.observacoes}
              onChange={(event) =>
                update(
                  "observacoes",
                  event.target.value,
                )
              }
              placeholder="Informações complementares sobre o cliente..."
              rows={4}
              className="input resize-none py-3"
            />
          </Field>

          <div className="flex flex-col-reverse gap-2 border-t border-white/[0.06] pt-5 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="h-10 rounded-xl border border-white/[0.07] bg-white/[0.025] px-5 text-xs font-medium text-slate-500 transition hover:bg-white/[0.05] hover:text-slate-300 disabled:opacity-40"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-sky-400/20 bg-sky-400/[0.09] px-5 text-xs font-semibold text-sky-200 transition hover:bg-sky-400/[0.14] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? (
                "Salvando..."
              ) : (
                <>
                  <Check size={14} />
                  {editing
                    ? "Salvar alterações"
                    : "Criar cliente"}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.13em] text-slate-600">
        {label}
        {required && (
          <span className="ml-1 text-sky-400">
            *
          </span>
        )}
      </span>

      {children}
    </label>
  );
}

function ConfirmacaoModal({
  confirmacao,
  saving,
  onClose,
  onConfirm,
}: {
  confirmacao: {
    tipo: "inativar" | "excluir";
    cliente: Cliente;
  };
  saving: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const excluir =
    confirmacao.tipo === "excluir";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl border border-white/[0.08] bg-[#090e15] p-6 shadow-[0_30px_120px_rgba(0,0,0,0.6)]">
        <div
          className={[
            "flex h-11 w-11 items-center justify-center rounded-2xl border",
            excluir
              ? "border-red-400/15 bg-red-400/[0.06] text-red-300"
              : "border-amber-400/15 bg-amber-400/[0.06] text-amber-300",
          ].join(" ")}
        >
          {excluir ? (
            <Trash2 size={18} />
          ) : (
            <Power size={18} />
          )}
        </div>

        <h2 className="mt-5 text-base font-semibold text-slate-100">
          {excluir
            ? "Excluir cliente?"
            : confirmacao.cliente.ativo
              ? "Inativar cliente?"
              : "Reativar cliente?"}
        </h2>

        <p className="mt-2 text-xs leading-6 text-slate-500">
          {excluir
            ? `O cliente "${confirmacao.cliente.nome}" será excluído somente se não possuir projetos vinculados.`
            : confirmacao.cliente.ativo
              ? `O cliente "${confirmacao.cliente.nome}" ficará inativo e não aparecerá nos novos cadastros.`
              : `O cliente "${confirmacao.cliente.nome}" voltará a ficar ativo no Control Tower.`}
        </p>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="h-10 rounded-xl border border-white/[0.07] bg-white/[0.025] px-5 text-xs font-medium text-slate-500 transition hover:bg-white/[0.05] hover:text-slate-300 disabled:opacity-40"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={saving}
            className={[
              "h-10 rounded-xl px-5 text-xs font-semibold transition disabled:opacity-50",
              excluir
                ? "border border-red-400/20 bg-red-400/[0.08] text-red-300 hover:bg-red-400/[0.13]"
                : "border border-amber-400/20 bg-amber-400/[0.08] text-amber-300 hover:bg-amber-400/[0.13]",
            ].join(" ")}
          >
            {saving
              ? "Processando..."
              : excluir
                ? "Excluir cliente"
                : confirmacao.cliente.ativo
                  ? "Inativar"
                  : "Reativar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function formatDate(
  date: string,
) {
  if (!date) {
    return "—";
  }

  const parsed =
    new Date(date);

  if (
    Number.isNaN(
      parsed.getTime(),
    )
  ) {
    return "—";
  }

  return parsed.toLocaleDateString(
    "pt-BR",
  );
}