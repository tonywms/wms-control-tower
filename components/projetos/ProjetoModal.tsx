"use client";

import { useCallback, useEffect, useState } from "react";
import {
  X,
  Save,
  Loader2,
  History,
  PencilLine,
  ArrowRight,
  CircleDot,
  RefreshCw,
} from "lucide-react";

type Projeto = {
  id: string;
  cliente_id?: string | null;
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
};

type Etapa = {
  id: string;
  nome: string;
  ordem?: number;
};

type Responsavel = {
  id: string;
  nome: string;
};

type Cliente = {
  id: string;
  nome: string;
  cidade?: string | null;
};

type HistoricoItem = {
  id: string;
  tipo: "alteracao" | "status";
  campo: string;
  valor_anterior: string | null;
  valor_novo: string | null;
  motivo: string | null;
  usuario_id: string | null;
  usuario_nome: string;
  origem: string;
  created_at: string;
};

type AbaModal = "dados" | "historico";

type ProjetoModalProps = {
  projeto: Projeto | null;
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
};

const STATUS = [
  "Não iniciado",
  "Planejado",
  "Em andamento",
  "Pausado",
  "Bloqueado",
  "Finalizado",
  "Cancelado",
];

const PRIORIDADES = [
  "Baixa",
  "Normal",
  "Alta",
  "Crítica",
];

const PLATAFORMAS = [
  "Web SaaS",
  "LegaWeb",
  "Legado",
];

const SETORES = [
  "Comercial",
  "Planejamento",
  "Implantação",
  "Desenvolvimento",
  "Suporte",
];

export default function ProjetoModal({
  projeto,
  open,
  onClose,
  onSaved,
}: ProjetoModalProps) {
  const [form, setForm] = useState({
    cliente_id: "",
    nome: "",
    plataforma: "",
    etapa_id: "",
    setor: "",
    responsavel_id: "",
    responsavel_nome: "",
    status: "Não iniciado",
    prioridade: "Normal",
    data_inicio: "",
    data_fim: "",
    observacoes: "",
    fase_origem: "",
    percentual: 0,
  });

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [etapas, setEtapas] = useState<Etapa[]>([]);
  const [responsaveis, setResponsaveis] = useState<
    Responsavel[]
  >([]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [aba, setAba] = useState<AbaModal>("dados");
  const [historico, setHistorico] = useState<HistoricoItem[]>([]);
  const [historicoLoading, setHistoricoLoading] = useState(false);
  const [historicoError, setHistoricoError] = useState("");

  /*
   * ============================================================
   * CARREGAR DADOS DO PROJETO
   * ============================================================
   */

  useEffect(() => {
    if (!open) return;

    if (!projeto) {
      setForm({
        cliente_id: "",
        nome: "",
        plataforma: "",
        etapa_id: "",
        setor: "",
        responsavel_id: "",
        responsavel_nome: "",
        status: "Não iniciado",
        prioridade: "Normal",
        data_inicio: "",
        data_fim: "",
        observacoes: "",
        fase_origem: "",
        percentual: 0,
      });
    } else {
      setForm({
        cliente_id: projeto.cliente_id ?? "",
        nome: projeto.nome ?? "",
        plataforma: projeto.plataforma ?? "",
        etapa_id: projeto.etapa_id ?? "",
        setor: projeto.setor ?? "",
        responsavel_id: projeto.responsavel_id ?? "",
        responsavel_nome: projeto.responsavel_nome ?? "",
        status: projeto.status ?? "Não iniciado",
        prioridade: projeto.prioridade ?? "Normal",
        data_inicio: projeto.data_inicio ?? "",
        data_fim: projeto.data_fim ?? "",
        observacoes: projeto.observacoes ?? "",
        fase_origem: projeto.fase_origem ?? "",
        percentual: projeto.percentual ?? 0,
      });
    }

    setError("");
    setAba("dados");
    setHistorico([]);
    setHistoricoError("");
  }, [projeto, open]);

  /*
   * ============================================================
   * CARREGAR ETAPAS E RESPONSÁVEIS
   * ============================================================
   */

  useEffect(() => {
    if (!open) return;

    async function carregarOpcoes() {
      try {
        const [opcoesResponse, clientesResponse] = await Promise.all([
          fetch("/api/opcoes", {
            cache: "no-store",
            credentials: "same-origin",
          }),
          fetch("/api/clientes", {
            cache: "no-store",
            credentials: "same-origin",
          }),
        ]);

        if (!opcoesResponse.ok) {
          throw new Error(
            "Não foi possível carregar as opções.",
          );
        }

        if (!clientesResponse.ok) {
          throw new Error(
            "Não foi possível carregar os clientes.",
          );
        }

        const [opcoesResult, clientesResult] = await Promise.all([
          opcoesResponse.json(),
          clientesResponse.json(),
        ]);

        setEtapas(opcoesResult.etapas ?? []);
        setResponsaveis(opcoesResult.responsaveis ?? []);
        setClientes(clientesResult.clientes ?? []);
      } catch {
        setEtapas([]);
        setResponsaveis([]);
        setClientes([]);
      }
    }

    carregarOpcoes();
  }, [open]);

  const carregarHistorico = useCallback(async () => {
    if (!projeto) return;

    try {
      setHistoricoLoading(true);
      setHistoricoError("");

      const response = await fetch(
        `/api/projetos/${projeto.id}/historico`,
        { cache: "no-store", credentials: "same-origin" },
      );
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Não foi possível carregar o histórico.");
      }

      setHistorico(result.historico ?? []);
    } catch (err) {
      setHistoricoError(
        err instanceof Error ? err.message : "Erro ao carregar histórico.",
      );
      setHistorico([]);
    } finally {
      setHistoricoLoading(false);
    }
  }, [projeto]);

  useEffect(() => {
    if (!open || !projeto || aba !== "historico") return;
    void carregarHistorico();
  }, [open, projeto, aba, carregarHistorico]);

  if (!open) {
    return null;
  }

  /*
   * ============================================================
   * ATUALIZAR CAMPO
   * ============================================================
   */

  function atualizar(
    campo: keyof typeof form,
    valor: string | number,
  ) {
    setForm((atual) => ({
      ...atual,
      [campo]: valor,
    }));
  }

  /*
   * ============================================================
   * ALTERAÇÃO DA ETAPA
   *
   * A ETAPA é a fase atual do projeto.
   *
   * Exemplo:
   * Go-Live -> Suporte
   *
   * significa:
   *
   * etapa_id = UUID da etapa Suporte
   *
   * ============================================================
   */

  function alterarEtapa(etapaId: string) {
    const etapaSelecionada = etapas.find(
      (etapa) => etapa.id === etapaId,
    );

    setForm((atual) => ({
      ...atual,

      etapa_id: etapaId,

      /*
       * Mantemos fase_origem sincronizada com a etapa atual.
       * Isso evita que a tela fique mostrando uma origem antiga
       * depois que o projeto mudou de fase.
       */
      fase_origem:
        etapaSelecionada?.nome ?? atual.fase_origem,
    }));
  }

  /*
   * ============================================================
   * ALTERAÇÃO DA FASE DE ORIGEM
   *
   * Compatibilidade com o campo antigo.
   *
   * Se o usuário digitar/selecionar o nome de uma etapa existente,
   * encontramos automaticamente o UUID correspondente e também
   * alteramos etapa_id.
   * ============================================================
   */

  function alterarFaseOrigem(valor: string) {
    const etapaCorrespondente = etapas.find(
      (etapa) =>
        etapa.nome.toLowerCase().trim() ===
        valor.toLowerCase().trim(),
    );

    setForm((atual) => ({
      ...atual,

      fase_origem: valor,

      ...(etapaCorrespondente
        ? {
            etapa_id: etapaCorrespondente.id,
          }
        : {}),
    }));
  }

  /*
   * ============================================================
   * SALVAR
   * ============================================================
   */

  async function salvar() {
    const projetoAtual = projeto;
    const criando = !projetoAtual;

    try {
      setSaving(true);
      setError("");

      if (!form.nome.trim()) {
        throw new Error(
          "Informe o nome do projeto.",
        );
      }

      if (!form.cliente_id) {
        throw new Error(
          "Selecione o cliente do projeto.",
        );
      }

      /*
       * Garante que o etapa_id realmente corresponda
       * à etapa selecionada.
       */
      let etapaIdFinal = form.etapa_id;

      /*
       * Se por algum motivo o etapa_id estiver vazio,
       * mas a fase_origem corresponder a uma etapa existente,
       * recuperamos automaticamente o ID.
       */
      if (!etapaIdFinal && form.fase_origem.trim()) {
        const etapaCorrespondente = etapas.find(
          (etapa) =>
            etapa.nome.toLowerCase().trim() ===
            form.fase_origem
              .toLowerCase()
              .trim(),
        );

        if (etapaCorrespondente) {
          etapaIdFinal = etapaCorrespondente.id;
        }
      }

      /*
       * Se existe etapa_id, buscamos o nome real da etapa
       * para manter fase_origem coerente.
       */
      let faseOrigemFinal = form.fase_origem;

      if (etapaIdFinal) {
        const etapaSelecionada = etapas.find(
          (etapa) => etapa.id === etapaIdFinal,
        );

        if (etapaSelecionada) {
          faseOrigemFinal = etapaSelecionada.nome;
        }
      }

      const payload = {
        ...form,

        /*
         * ESTE É O CAMPO PRINCIPAL DA FASE ATUAL.
         */
        etapa_id: etapaIdFinal || null,

        /*
         * Mantém compatibilidade com o campo existente.
         */
        fase_origem:
          faseOrigemFinal.trim() || null,

        usuario_nome: "Tony Moreira",
      };

      console.log(
        "[ProjetoModal] Salvando projeto:",
        {
          modo: criando ? "criacao" : "edicao",
          projeto_id: projetoAtual?.id ?? null,
          cliente_id: payload.cliente_id,
          etapa_id: payload.etapa_id,
          fase_origem: payload.fase_origem,
        },
      );

      const response = await fetch(
        criando
          ? "/api/projetos"
          : `/api/projetos/${projetoAtual.id}`,
        {
          method: criando ? "POST" : "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "same-origin",
          body: JSON.stringify(payload),
        },
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error ||
            "Não foi possível salvar o projeto.",
        );
      }

      /*
       * Confirma no console exatamente o que a API devolveu.
       */
      console.log(
        criando
          ? "[ProjetoModal] Projeto criado:"
          : "[ProjetoModal] Projeto atualizado:",
        result.projeto,
      );

      onClose();

      /*
       * Recarrega a carteira para que o card receba
       * a nova etapa do banco.
       */
      onSaved?.();
    } catch (err) {
      console.error(
        "[ProjetoModal] Erro ao salvar:",
        err,
      );

      setError(
        err instanceof Error
          ? err.message
          : "Erro ao salvar projeto.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center overflow-hidden bg-black/70 p-4 backdrop-blur-sm">
      <div className="flex max-h-[86vh] w-full max-w-2xl flex-col overflow-hidden rounded-[24px] border border-white/[0.09] bg-[#080d16] shadow-2xl shadow-black/70"
        style={{ animation: "none" }}>

        {/* HEADER */}

        <div className="flex shrink-0 items-center justify-between border-b border-white/[0.06] px-5 py-4">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-sky-400">
              Control Tower
            </div>

            <h2 className="mt-0.5 text-lg font-semibold text-white">
              {projeto ? "Editar projeto" : "Novo projeto"}
            </h2>

            <p className="mt-0.5 max-w-[520px] truncate text-xs text-slate-500">
              {projeto
                ? projeto.nome
                : "Cadastre um novo projeto na Control Tower"}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-slate-400 transition hover:bg-white/[0.07] hover:text-white"
          >
            <X size={17} />
          </button>
        </div>

        {/* ABAS */}
        <div className="flex shrink-0 items-center gap-1 border-b border-white/[0.06] px-5">
          <button
            type="button"
            onClick={() => setAba("dados")}
            className={[
              "relative flex items-center gap-2 px-3 py-3 text-xs font-semibold transition",
              aba === "dados" ? "text-sky-300" : "text-slate-500 hover:text-slate-300",
            ].join(" ")}
          >
            <PencilLine size={14} />
            Dados do projeto
            {aba === "dados" && (
              <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-sky-400" />
            )}
          </button>

          {projeto && (
          <button
            type="button"
            onClick={() => setAba("historico")}
            className={[
              "relative flex items-center gap-2 px-3 py-3 text-xs font-semibold transition",
              aba === "historico" ? "text-sky-300" : "text-slate-500 hover:text-slate-300",
            ].join(" ")}
          >
            <History size={14} />
            Histórico
            {historico.length > 0 && (
              <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-1.5py-0.5 text-[9px] text-slate-400">
                {historico.length}
              </span>
            )}
            {aba === "historico" && (
              <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-sky-400" />
            )}
          </button>
          )}
        </div>

        {/* CONTEÚDO */}

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {aba === "dados" ? (
            <>
          <div className="grid grid-cols-1 gap-x-4 gap-y-3.5 md:grid-cols-2">

            <Field label="Cliente">
              <select
                value={form.cliente_id}
                onChange={(e) =>
                  atualizar(
                    "cliente_id",
                    e.target.value,
                  )
                }
                className="input"
              >
                <option value="">Selecione</option>
                {clientes.map((cliente) => (
                  <option
                    key={cliente.id}
                    value={cliente.id}
                  >
                    {cliente.nome}
                    {cliente.cidade ? ` - ${cliente.cidade}` : ""}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Projeto">
              <input
                value={form.nome}
                onChange={(e) =>
                  atualizar(
                    "nome",
                    e.target.value,
                  )
                }
                className="input"
              />
            </Field>

            <Field label="Plataforma">
              <select
                value={form.plataforma}
                onChange={(e) =>
                  atualizar(
                    "plataforma",
                    e.target.value,
                  )
                }
                className="input"
              >
                <option value="">
                  Selecione
                </option>

                {PLATAFORMAS.map((item) => (
                  <option
                    key={item}
                    value={item}
                  >
                    {item}
                  </option>
                ))}
              </select>
            </Field>

            {/* ETAPA ATUAL */}

            <Field label="Etapa atual">
              <select
                value={form.etapa_id}
                onChange={(e) =>
                  alterarEtapa(
                    e.target.value,
                  )
                }
                className="input"
              >
                <option value="">
                  Selecione
                </option>

                {etapas.map((etapa) => (
                  <option
                    key={etapa.id}
                    value={etapa.id}
                  >
                    {etapa.nome}
                  </option>
                ))}
              </select>

              <div className="mt-1.5 text-[10px] text-slate-600">
                A etapa atual define onde o projeto
                aparece na Control Tower.
              </div>
            </Field>

            <Field label="Setor">
              <select
                value={form.setor}
                onChange={(e) =>
                  atualizar(
                    "setor",
                    e.target.value,
                  )
                }
                className="input"
              >
                <option value="">
                  Selecione
                </option>

                {SETORES.map((item) => (
                  <option
                    key={item}
                    value={item}
                  >
                    {item}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Responsável">
              <select
                value={form.responsavel_id}
                onChange={(e) => {
                  const id =
                    e.target.value;

                  const responsavel =
                    responsaveis.find(
                      (item) =>
                        item.id === id,
                    );

                  setForm((atual) => ({
                    ...atual,
                    responsavel_id: id,
                    responsavel_nome:
                      responsavel?.nome ??
                      "",
                  }));
                }}
                className="input"
              >
                <option value="">
                  Selecione
                </option>

                {responsaveis.map(
                  (item) => (
                    <option
                      key={item.id}
                      value={item.id}
                    >
                      {item.nome}
                    </option>
                  ),
                )}
              </select>
            </Field>

            <Field label="Status">
              <select
                value={form.status}
                onChange={(e) =>
                  atualizar(
                    "status",
                    e.target.value,
                  )
                }
                className="input"
              >
                {STATUS.map((item) => (
                  <option
                    key={item}
                    value={item}
                  >
                    {item}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Prioridade">
              <select
                value={form.prioridade}
                onChange={(e) =>
                  atualizar(
                    "prioridade",
                    e.target.value,
                  )
                }
                className="input"
              >
                {PRIORIDADES.map(
                  (item) => (
                    <option
                      key={item}
                      value={item}
                    >
                      {item}
                    </option>
                  ),
                )}
              </select>
            </Field>

            <Field label="Progresso">
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={form.percentual}
                  onChange={(e) =>
                    atualizar(
                      "percentual",
                      Number(
                        e.target.value,
                      ),
                    )
                  }
                  className="w-full accent-sky-400"
                />

                <span className="w-12 text-right text-sm font-semibold text-white">
                  {form.percentual}%
                </span>
              </div>
            </Field>

            <Field label="Data inicial">
              <input
                type="date"
                value={form.data_inicio}
                onChange={(e) =>
                  atualizar(
                    "data_inicio",
                    e.target.value,
                  )
                }
                className="input"
              />
            </Field>

            <Field label="Data final">
              <input
                type="date"
                value={form.data_fim}
                onChange={(e) =>
                  atualizar(
                    "data_fim",
                    e.target.value,
                  )
                }
                className="input"
              />
            </Field>

            {/* FASE DE ORIGEM */}

            <Field label="Fase de origem">
              <input
                value={form.fase_origem}
                onChange={(e) =>
                  alterarFaseOrigem(
                    e.target.value,
                  )
                }
                className="input"
                placeholder="Ex.: Suporte"
              />

              <div className="mt-1.5 text-[10px] text-slate-600">
                Se o nome informado corresponder a uma
                etapa existente, a etapa atual também será
                atualizada automaticamente.
              </div>
            </Field>
          </div>

          <div className="mt-3.5">
            <Field label="Observações">
              <textarea
                rows={3}
                value={form.observacoes}
                onChange={(e) =>
                  atualizar(
                    "observacoes",
                    e.target.value,
                  )
                }
                className="input min-h-[84px] resize-y"
                placeholder="Observações, próximos passos, contexto..."
              />
            </Field>
          </div>

          {error && (
            <div className="mt-3.5 rounded-2xl border border-red-500/20 bg-red-500/[0.07] px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}
            </>
          ) : (
            <div>
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-white">
                    <History size={16} className="text-sky-400" />
                    Linha do tempo
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Alterações de dados e movimentações de status do projeto.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void carregarHistorico()}
                  disabled={historicoLoading}
                  className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs font-medium text-slate-400 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-50"
                >
                  <RefreshCw size={13} className={historicoLoading ? "animate-spin" : ""} />
                  Atualizar
                </button>
              </div>

              {historicoLoading && historico.length === 0 ? (
                <div className="flex min-h-[260px] items-center justify-center">
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <Loader2 size={16} className="animate-spin" />
                    Carregando histórico...
                  </div>
                </div>
              ) : historicoError ? (
                <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.07] px-4 py-3 text-sm text-red-300">
                  {historicoError}
                </div>
              ) : historico.length === 0 ? (
                <div className="flex min-h-[260px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.015] px-6 text-center">
                  <History size={28} className="mb-3 text-slate-600" />
                  <div className="text-sm font-medium text-slate-300">
                    Nenhum histórico registrado
                  </div>
                </div>
              ) : (
                <div className="relative">
                  <div className="absolute bottom-3 left-[15px] top-3 w-px bg-white/[0.07]" />                  <div className="space-y-3">
                    {historico.map((item) => (
                      <HistoricoCard key={item.id} item={item} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* FOOTER */}

        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-white/[0.06] px-5 py-3.5">
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-white/[0.06] hover:text-white"
          >
            {aba === "historico" ? "Fechar" : "Cancelar"}
          </button>

          {aba === "dados" && (
            <button
              type="button"
              disabled={saving}
              onClick={salvar}
              className="flex items-center gap-2 rounded-xl bg-sky-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {saving
                ? "Salvando..."
                : projeto
                  ? "Salvar alterações"
                  : "Criar projeto"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function formatarDataHistorico(value: string) {
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

function textoValor(value: string | null) {
  return value === null || value === undefined || value === ""
    ? "Não informado"
    : value;
}

function HistoricoCard({ item }: { item: HistoricoItem }) {
  const status = item.tipo === "status";

  return (
    <div className="relative pl-11">
      <div
        className={[
          "absolute left-0 top-4 z-10 flex h-[31px] w-[31px] items-center justify-center rounded-xl border",
          status
            ? "border-violet-400/20 bg-violet-500/10 text-violet-300"
            : "border-sky-400/20 bg-sky-500/10 text-sky-300",
        ].join(" ")}
      >
        {status ? <CircleDot size={14} /> : <PencilLine size={14} />}
      </div>

      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] px-4 py-3.5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-sm font-semibold text-white">
              {item.usuario_nome || "Sistema"}
              <span className="font-normal text-slate-500"> alterou </span>
              <span className={status ? "text-violet-300" : "text-sky-300"}>
                {item.campo}
              </span>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <span className="max-w-[260px] truncate rounded-lg border border-white/[0.06] bg-black/20 px-2.5 py-1.5 text-slate-400">
                {textoValor(item.valor_anterior)}
              </span>
              <ArrowRight size={13} className="text-slate-600" />
              <span className="max-w-[260px] truncate rounded-lg border border-emerald-400/10bg-emerald-500/[0.06] px-2.5 py-1.5 font-medium text-emerald-300">
                {textoValor(item.valor_novo)}
              </span>
            </div>

            {item.motivo && (
              <div className="mt-2.5 rounded-xl border border-amber-400/10 bg-amber-500/[0.05] px-3 py-2 text-xs leading-5 text-amber-200/80">
                <span className="font-semibold text-amber-300">Motivo:</span>{" "}
                {item.motivo}
              </div>
            )}
          </div>

          <div className="shrink-0 text-[10px] font-medium text-slate-600">
            {formatarDataHistorico(item.created_at)}
          </div>
        </div>
      </div>
    </div>
  );
}

/*
 * ============================================================
 * FIELD
 * ============================================================
 */

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.13em] text-slate-500">
        {label}
      </label>

      {children}
    </div>
  );
}