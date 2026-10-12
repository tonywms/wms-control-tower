"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Edit3,
  Layers3,
  Plus,
  Power,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { usePermissions } from "@/components/auth/usePermissions";

type Etapa = {
  id: string;
  nome: string;
  descricao: string | null;
  ordem: number;
  ativo: boolean;
  created_at: string;
  updated_at: string;
};

type ModalMode = "create" | "edit" | null;

const EMPTY_FORM = {
  nome: "",
  descricao: "",
  ordem: "0",
  ativo: true,
};

export default function EtapasPage() {
  const { can, loading: permissionsLoading } =
    usePermissions();

  const [etapas, setEtapas] = useState<Etapa[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [includeInactive, setIncludeInactive] =
    useState(true);

  const [modal, setModal] = useState<ModalMode>(null);
  const [editingId, setEditingId] = useState<string | null>(
    null,
  );

  const [form, setForm] = useState(EMPTY_FORM);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [confirmAction, setConfirmAction] = useState<
    | {
        type: "toggle" | "delete";
        etapa: Etapa;
      }
    | null
  >(null);

  const loadEtapas = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const params = new URLSearchParams();

      if (search.trim()) {
        params.set("search", search.trim());
      }

      if (includeInactive) {
        params.set("includeInactive", "true");
      }

      const response = await fetch(
        `/api/etapas?${params.toString()}`,
        {
          method: "GET",
          cache: "no-store",
        },
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error || "Não foi possível carregar as etapas.",
        );
      }

      setEtapas(data.etapas ?? []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível carregar as etapas.",
      );
    } finally {
      setLoading(false);
    }
  }, [search, includeInactive]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadEtapas();
    }, 250);

    return () => window.clearTimeout(timer);
  }, [loadEtapas]);

  const metrics = useMemo(() => {
    const total = etapas.length;

    const ativas = etapas.filter(
      (etapa) => etapa.ativo,
    ).length;

    const inativas = etapas.filter(
      (etapa) => !etapa.ativo,
    ).length;

    return {
      total,
      ativas,
      inativas,
    };
  }, [etapas]);

  const abrirCriacao = () => {
    setError("");
    setSuccess("");
    setEditingId(null);
    setForm(EMPTY_FORM);
    setModal("create");
  };

  const abrirEdicao = (etapa: Etapa) => {
    setError("");
    setSuccess("");
    setEditingId(etapa.id);

    setForm({
      nome: etapa.nome,
      descricao: etapa.descricao ?? "",
      ordem: String(etapa.ordem ?? 0),
      ativo: etapa.ativo,
    });

    setModal("edit");
  };

  const fecharModal = () => {
    if (saving) {
      return;
    }

    setModal(null);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const salvar = async () => {
    if (!can("editar")) {
      setError(
        "Seu perfil não possui permissão para editar etapas.",
      );
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const payload = {
        nome: form.nome,
        descricao: form.descricao,
        ordem: Number(form.ordem) || 0,
        ativo: form.ativo,
      };

      const url =
        modal === "edit" && editingId
          ? `/api/etapas/${editingId}`
          : "/api/etapas";

      const method = modal === "edit" ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error ||
            "Não foi possível salvar a etapa.",
        );
      }

      setSuccess(
        modal === "edit"
          ? "Etapa atualizada com sucesso."
          : "Etapa criada com sucesso.",
      );

      fecharModal();
      await loadEtapas();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível salvar a etapa.",
      );
    } finally {
      setSaving(false);
    }
  };

  const executarConfirmacao = async () => {
    if (!confirmAction) {
      return;
    }

    const { type, etapa } = confirmAction;

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      if (type === "toggle") {
        if (!can("editar")) {
          throw new Error(
            "Seu perfil não possui permissão para alterar etapas.",
          );
        }

        const response = await fetch(
          `/api/etapas/${etapa.id}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              nome: etapa.nome,
              descricao: etapa.descricao ?? "",
              ordem: etapa.ordem,
              ativo: !etapa.ativo,
            }),
          },
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(
            data.error ||
              "Não foi possível alterar a etapa.",
          );
        }

        setSuccess(
          etapa.ativo
            ? "Etapa desativada com sucesso."
            : "Etapa ativada com sucesso.",
        );
      }

      if (type === "delete") {
        if (!can("excluir")) {
          throw new Error(
            "Seu perfil não possui permissão para excluir etapas.",
          );
        }

        const response = await fetch(
          `/api/etapas/${etapa.id}`,
          {
            method: "DELETE",
          },
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(
            data.error ||
              "Não foi possível excluir a etapa.",
          );
        }

        setSuccess("Etapa excluída com sucesso.");
      }

      setConfirmAction(null);
      await loadEtapas();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível concluir a operação.",
      );
    } finally {
      setSaving(false);
    }
  };

  const moverOrdem = async (
    etapa: Etapa,
    direction: "up" | "down",
  ) => {
    if (!can("editar")) {
      setError(
        "Seu perfil não possui permissão para reordenar etapas.",
      );
      return;
    }

    const index = etapas.findIndex(
      (item) => item.id === etapa.id,
    );

    if (index === -1) {
      return;
    }

    const targetIndex =
      direction === "up" ? index - 1 : index + 1;

    if (
      targetIndex < 0 ||
      targetIndex >= etapas.length
    ) {
      return;
    }

    const outra = etapas[targetIndex];

    try {
      setSaving(true);
      setError("");

      const ordemAtual = etapa.ordem;
      const ordemOutra = outra.ordem;

      const [responseA, responseB] =
        await Promise.all([
          fetch(`/api/etapas/${etapa.id}`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              nome: etapa.nome,
              descricao: etapa.descricao ?? "",
              ordem: ordemOutra,
              ativo: etapa.ativo,
            }),
          }),

          fetch(`/api/etapas/${outra.id}`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              nome: outra.nome,
              descricao: outra.descricao ?? "",
              ordem: ordemAtual,
              ativo: outra.ativo,
            }),
          }),
        ]);

      const dataA = await responseA.json();
      const dataB = await responseB.json();

      if (
        !responseA.ok ||
        !responseB.ok ||
        !dataA.success ||
        !dataB.success
      ) {
        throw new Error(
          dataA.error ||
            dataB.error ||
            "Não foi possível reordenar as etapas.",
        );
      }

      await loadEtapas();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível reordenar as etapas.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#070b12] text-white">
      <div className="mx-auto max-w-[1500px] px-6 py-8 lg:px-10">
        <header className="mb-8">
          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
            <div>
              <div className="mb-3 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-400/10">
                  <Layers3 className="h-5 w-5 text-cyan-300" />
                </div>

                <span className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-300/80">
                  Configurações
                </span>
              </div>

              <h1 className="text-3xl font-semibold tracking-tight lg:text-4xl">
                Etapas
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                Cadastre e organize as etapas oficiais do
                ciclo operacional do WMS Expert Control Tower.
              </p>
            </div>

            {!permissionsLoading && can("editar") && (
              <button
                type="button"
                onClick={abrirCriacao}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-5 text-sm font-semibold text-cyan-200 transition hover:border-cyan-300/50 hover:bg-cyan-400/15"
              >
                <Plus className="h-4 w-4" />
                Nova etapa
              </button>
            )}
          </div>
        </header>

        {error && (
          <div className="mb-5 flex items-start justify-between gap-4 rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200">
            <span>{error}</span>

            <button
              type="button"
              onClick={() => setError("")}
              className="text-red-300/70 hover:text-red-200"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {success && (
          <div className="mb-5 flex items-center justify-between gap-4 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              <span>{success}</span>
            </div>

            <button
              type="button"
              onClick={() => setSuccess("")}
              className="text-emerald-300/70 hover:text-emerald-200"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <section className="mb-6 grid gap-4 md:grid-cols-3">
          <MetricCard
            label="Total"
            value={metrics.total}
          />

          <MetricCard
            label="Ativas"
            value={metrics.ativas}
          />

          <MetricCard
            label="Inativas"
            value={metrics.inativas}
          />
        </section>

        <section className="overflow-hidden rounded-3xl border border-white/[0.07] bg-white/[0.025] shadow-2xl shadow-black/20">
          <div className="border-b border-white/[0.07] p-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="relative max-w-xl flex-1">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />

                <input
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                  placeholder="Pesquisar etapa..."
                  className="h-11 w-full rounded-xl border border-white/[0.08] bg-black/20 pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-400/30"
                />
              </div>

              <label className="flex cursor-pointer items-center gap-3 text-sm text-slate-400">
                <input
                  type="checkbox"
                  checked={includeInactive}
                  onChange={(event) =>
                    setIncludeInactive(
                      event.target.checked,
                    )
                  }
                  className="h-4 w-4 accent-cyan-400"
                />

                Exibir inativas
              </label>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="border-b border-white/[0.06] text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  <th className="w-24 px-6 py-4">
                    Ordem
                  </th>

                  <th className="px-6 py-4">
                    Etapa
                  </th>

                  <th className="px-6 py-4">
                    Descrição
                  </th>

                  <th className="w-32 px-6 py-4">
                    Status
                  </th>

                  <th className="w-44 px-6 py-4 text-right">
                    Ações
                  </th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-6 py-16 text-center text-sm text-slate-500"
                    >
                      Carregando etapas...
                    </td>
                  </tr>
                ) : etapas.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-6 py-16 text-center"
                    >
                      <div className="mx-auto max-w-md">
                        <Layers3 className="mx-auto mb-4 h-8 w-8 text-slate-600" />

                        <p className="text-sm font-medium text-slate-300">
                          Nenhuma etapa encontrada.
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          Crie a primeira etapa para começar
                          a estruturar o fluxo operacional.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  etapas.map((etapa, index) => (
                    <tr
                      key={etapa.id}
                      className="border-b border-white/[0.045] transition hover:bg-white/[0.025]"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1">
                          <span className="w-8 text-center text-sm font-semibold text-slate-300">
                            {etapa.ordem}
                          </span>

                          {can("editar") && (
                            <div className="flex flex-col">
                              <button
                                type="button"
                                disabled={
                                  saving || index === 0
                                }
                                onClick={() =>
                                  moverOrdem(
                                    etapa,
                                    "up",
                                  )
                                }
                                className="text-slate-600 transition hover:text-cyan-300 disabled:cursor-not-allowed disabled:opacity-30"
                                title="Mover para cima"
                              >
                                <ChevronUp className="h-4 w-4" />
                              </button>

                              <button
                                type="button"
                                disabled={
                                  saving ||
                                  index ===
                                    etapas.length - 1
                                }
                                onClick={() =>
                                  moverOrdem(
                                    etapa,
                                    "down",
                                  )
                                }
                                className="text-slate-600 transition hover:text-cyan-300 disabled:cursor-not-allowed disabled:opacity-30"
                                title="Mover para baixo"
                              >
                                <ChevronDown className="h-4 w-4" />
                              </button>
                            </div>
                          )}
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-100">
                          {etapa.nome}
                        </div>

                        <div className="mt-1 text-xs text-slate-600">
                          ID {etapa.id.slice(0, 8)}
                        </div>
                      </td>

                      <td className="max-w-md px-6 py-4 text-sm text-slate-400">
                        {etapa.descricao || "—"}
                      </td>

                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${
                            etapa.ativo
                              ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
                              : "border-slate-400/10 bg-slate-400/5 text-slate-500"
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              etapa.ativo
                                ? "bg-emerald-300"
                                : "bg-slate-600"
                            }`}
                          />

                          {etapa.ativo
                            ? "Ativa"
                            : "Inativa"}
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex justify-end gap-2">
                          {can("editar") && (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  abrirEdicao(etapa)
                                }
                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.025] text-slate-400 transition hover:border-cyan-400/20 hover:bg-cyan-400/10 hover:text-cyan-300"
                                title="Editar"
                              >
                                <Edit3 className="h-4 w-4" />
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  setConfirmAction({
                                    type: "toggle",
                                    etapa,
                                  })
                                }
                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.025] text-slate-400 transition hover:border-amber-400/20 hover:bg-amber-400/10 hover:text-amber-300"
                                title={
                                  etapa.ativo
                                    ? "Desativar"
                                    : "Ativar"
                                }
                              >
                                <Power className="h-4 w-4" />
                              </button>
                            </>
                          )}

                          {can("excluir") && (
                            <button
                              type="button"
                              onClick={() =>
                                setConfirmAction({
                                  type: "delete",
                                  etapa,
                                })
                              }
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.025] text-slate-500 transition hover:border-red-400/20 hover:bg-red-400/10 hover:text-red-300"
                              title="Excluir"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-5 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-3xl border border-white/[0.08] bg-[#0b111a] shadow-2xl shadow-black/60">
            <div className="flex items-center justify-between border-b border-white/[0.07] px-6 py-5">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  {modal === "edit"
                    ? "Editar etapa"
                    : "Nova etapa"}
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  Defina as informações da etapa
                  operacional.
                </p>
              </div>

              <button
                type="button"
                onClick={fecharModal}
                disabled={saving}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-white/[0.05] hover:text-white disabled:opacity-40"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-5 px-6 py-6">
              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-slate-500">
                  Nome
                </label>

                <input
                  autoFocus
                  value={form.nome}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      nome: event.target.value,
                    }))
                  }
                  placeholder="Ex.: Go-Live"
                  className="input"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-slate-500">
                  Descrição
                </label>

                <textarea
                  value={form.descricao}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      descricao: event.target.value,
                    }))
                  }
                  placeholder="Descreva o objetivo da etapa..."
                  rows={4}
                  className="input resize-none"
                />
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-slate-500">
                    Ordem
                  </label>

                  <input
                    type="number"
                    min={0}
                    value={form.ordem}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        ordem: event.target.value,
                      }))
                    }
                    className="input"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-slate-500">
                    Status
                  </label>

                  <button
                    type="button"
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        ativo: !current.ativo,
                      }))
                    }
                    className={`flex h-11 w-full items-center justify-between rounded-xl border px-4 text-sm transition ${
                      form.ativo
                        ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
                        : "border-white/[0.08] bg-white/[0.025] text-slate-500"
                    }`}
                  >
                    <span>
                      {form.ativo
                        ? "Etapa ativa"
                        : "Etapa inativa"}
                    </span>

                    <span
                      className={`h-2 w-2 rounded-full ${
                        form.ativo
                          ? "bg-emerald-300"
                          : "bg-slate-600"
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-white/[0.07] px-6 py-5">
              <button
                type="button"
                onClick={fecharModal}
                disabled={saving}
                className="h-11 rounded-xl border border-white/[0.08] px-5 text-sm font-medium text-slate-400 transition hover:bg-white/[0.04] hover:text-white"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={salvar}
                disabled={
                  saving || !form.nome.trim()
                }
                className="h-11 rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-6 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-400/15 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {saving
                  ? "Salvando..."
                  : modal === "edit"
                    ? "Salvar alterações"
                    : "Criar etapa"}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmAction && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-5 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-white/[0.08] bg-[#0b111a] p-6 shadow-2xl shadow-black/60">
            <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-400/10 text-amber-300">
              <Power className="h-5 w-5" />
            </div>

            <h2 className="text-lg font-semibold text-white">
              {confirmAction.type === "delete"
                ? "Excluir etapa?"
                : confirmAction.etapa.ativo
                  ? "Desativar etapa?"
                  : "Ativar etapa?"}
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-400">
              {confirmAction.type === "delete"
                ? `A etapa "${confirmAction.etapa.nome}" será excluída definitivamente caso não possua projetos vinculados.`
                : confirmAction.etapa.ativo
                  ? `A etapa "${confirmAction.etapa.nome}" ficará inativa e não deverá aparecer nos novos projetos.`
                  : `A etapa "${confirmAction.etapa.nome}" voltará a ficar disponível para uso.`}
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                disabled={saving}
                onClick={() =>
                  setConfirmAction(null)
                }
                className="h-11 rounded-xl border border-white/[0.08] px-5 text-sm font-medium text-slate-400 transition hover:bg-white/[0.04] hover:text-white"
              >
                Cancelar
              </button>

              <button
                type="button"
                disabled={saving}
                onClick={executarConfirmacao}
                className={`h-11 rounded-xl px-5 text-sm font-semibold ${
                  confirmAction.type === "delete"
                    ? "border border-red-400/20 bg-red-400/10 text-red-300 hover:bg-red-400/15"
                    : "border border-amber-400/20 bg-amber-400/10 text-amber-300 hover:bg-amber-400/15"
                }`}
              >
                {saving
                  ? "Processando..."
                  : confirmAction.type === "delete"
                    ? "Excluir etapa"
                    : confirmAction.etapa.ativo
                      ? "Desativar"
                      : "Ativar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function MetricCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
      <div className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
        {label}
      </div>

      <div className="mt-3 text-3xl font-semibold tracking-tight text-white">
        {value}
      </div>
    </div>
  );
}