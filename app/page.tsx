"use client";

import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CircleDot,
  Clock3,
  Database,
  Gauge,
  KanbanSquare,
  Layers3,
  LayoutDashboard,
  LogOut,
  Menu,
  PackageCheck,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  X,
  Zap,
  Timer,
  GitBranch,
  CircleAlert,
  UserRoundX,
  BarChart3,
  Workflow,
  ShieldAlert,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import ProjetoActions from "@/components/projetos/ProjetoActions";
import ProjetoModal from "@/components/projetos/ProjetoModal";
import Projeto360Modal from "@/components/projetos/Projeto360Modal";
import KanbanBoard from "@/components/kanban/KanbanBoard";
import GanttBoard from "@/components/timeline/GanttBoard";
import DashboardExecutivo from "@/components/dashboard/DashboardExecutivo";
import GovernancaCentral from "@/components/governanca/GovernancaCentral";

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

  responsavel: {
    id: string;
    nome: string;
    setor: string | null;
    cargo: string | null;
  } | null;
};

type ApiResponse = {
  success: boolean;
  total: number;
  projetos: Projeto[];
  resumo: {
    total: number;
    emAndamento: number;
    planejados: number;
    bloqueados: number;
    pausados: number;
    finalizados: number;
    naoIniciados: number;
    cancelados: number;
    goLives: number;
    integracoes: number;
  };
};

const menuItems = [
  {
    label: "Overview",
    icon: LayoutDashboard,
    active: true,
  },
  {
    label: "Carteira",
    icon: Layers3,
  },
  {
    label: "Kanban",
    icon: KanbanSquare,
  },
  {
    label: "Gantt / Timeline",
    icon: CalendarDays,
  },
  {
    label: "Implantação",
    icon: PackageCheck,
  },
  {
    label: "Desenvolvimento",
    icon: Database,
  },
  {
    label: "Suporte",
    icon: ShieldCheck,
  },
  {
    label: "Comercial",
    icon: Target,
  },
];

const bottomMenu = [
  {
    label: "Governança",
    icon: Gauge,
  },
  {
    label: "Configurações",
    icon: Settings2,
  },
];

const statusConfig: Record<
  string,
  {
    label: string;
    dot: string;
    text: string;
  }
> = {
  "Em andamento": {
    label: "Em andamento",
    dot: "bg-sky-400",
    text: "text-sky-300",
  },

  Planejado: {
    label: "Planejado",
    dot: "bg-violet-400",
    text: "text-violet-300",
  },

  "Não iniciado": {
    label: "Não iniciado",
    dot: "bg-slate-500",
    text: "text-slate-400",
  },

  Bloqueado: {
    label: "Bloqueado",
    dot: "bg-red-400",
    text: "text-red-300",
  },

  Pausado: {
    label: "Pausado",
    dot: "bg-amber-400",
    text: "text-amber-300",
  },

  Finalizado: {
    label: "Finalizado",
    dot: "bg-emerald-400",
    text: "text-emerald-300",
  },

  Cancelado: {
    label: "Cancelado",
    dot: "bg-rose-500",
    text: "text-rose-300",
  },
};

function formatDate(date: string | null) {
  if (!date) return "Sem data";

  const [year, month, day] = date.split("-");

  if (!year || !month || !day) return date;

  return `${day}/${month}`;
}

function daysUntil(date: string | null) {
  if (!date) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const target = new Date(`${date}T00:00:00`);
  target.setHours(0, 0, 0, 0);

  return Math.round(
    (target.getTime() - today.getTime()) /
      (1000 * 60 * 60 * 24),
  );
}

function relativeDate(date: string | null) {
  const days = daysUntil(date);

  if (days === null) return "Sem previsão";
  if (days === 0) return "Hoje";
  if (days === 1) return "Amanhã";
  if (days === -1) return "Ontem";
  if (days < 0) return `${Math.abs(days)}d atrasado`;

  return `Em ${days}d`;
}

function statusClass(status: string) {
  return (
    statusConfig[status] ?? {
      label: status,
      dot: "bg-slate-500",
      text: "text-slate-400",
    }
  );
}

function getInitials(name: string | null) {
  if (!name) return "—";

  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export default function Home() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [resumo, setResumo] =
    useState<ApiResponse["resumo"] | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");

  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);

  const [hoje, setHoje] = useState<Date | null>(null);

  const [selectedMenu, setSelectedMenu] =
    useState("Overview");

  const [selectedProjeto, setSelectedProjeto] =
    useState<Projeto | null>(null);

  const [modalOpen, setModalOpen] = useState(false);

  // ============================================================
  // PROJETO 360
  // ============================================================

  const [projeto360, setProjeto360] =
    useState<Projeto | null>(null);

  const [projeto360Open, setProjeto360Open] =
    useState(false);

  const openProjeto360 = useCallback(
    (projeto: Projeto) => {
      setProjeto360(projeto);
      setProjeto360Open(true);
    },
    [],
  );

  const closeProjeto360 = useCallback(() => {
    setProjeto360Open(false);
    setProjeto360(null);
  }, []);

  const openProjeto360ById = useCallback(
    (projetoId: string) => {
      const projeto = projetos.find((item) => item.id === projetoId);

      if (!projeto) {
        console.warn(`[Control Tower] Projeto ${projetoId} não encontrado na carteira.`);
        return;
      }

      openProjeto360(projeto);
    },
    [projetos, openProjeto360],
  );

  const openEditProjeto = useCallback(
    (projeto: Projeto) => {
      setSelectedProjeto(projeto);
      setModalOpen(true);
    },
    [],
  );

  const closeEditProjeto = useCallback(() => {
    setModalOpen(false);
    setSelectedProjeto(null);
  }, []);

  const loadProjetos = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("/api/projetos", {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`Erro HTTP ${response.status}`);
      }

      const data = (await response.json()) as ApiResponse;

      if (!data.success) {
        throw new Error("A API não retornou sucesso.");
      }

      setProjetos(data.projetos ?? []);
      setResumo(data.resumo ?? null);
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Erro ao carregar carteira.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProjetos();
  }, [loadProjetos]);

  useEffect(() => {
    const atualizarHoje = () => {
      const data = new Date();
      data.setHours(0, 0, 0, 0);
      setHoje(data);
    };

    atualizarHoje();
  }, []);

  const projetosFiltrados = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) return projetos;

    return projetos.filter((projeto) => {
      const searchable = [
        projeto.nome,
        projeto.cliente?.nome,
        projeto.cliente?.cidade,
        projeto.responsavel_nome,
        projeto.etapa?.nome,
        projeto.setor,
        projeto.status,
        projeto.plataforma,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(term);
    });
  }, [projetos, search]);

  /*
   * ============================================================
   * GO-LIVES
   * ============================================================
   */

  const goLives = useMemo(() => {
    return projetos
      .filter(
        (projeto) =>
          projeto.etapa?.nome === "Go-Live" ||
          projeto.etapa?.nome === "GoLive",
      )
      .sort((a, b) => {
        if (!a.data_inicio) return 1;
        if (!b.data_inicio) return -1;

        return a.data_inicio.localeCompare(
          b.data_inicio,
        );
      })
      .slice(0, 5);
  }, [projetos]);

  /*
   * ============================================================
   * ALERTAS CRÍTICOS
   * ============================================================
   */

  const criticalAlerts = useMemo(() => {
    return projetos
      .filter(
        (projeto) =>
          projeto.status === "Bloqueado" ||
          projeto.prioridade === "Crítica" ||
          (projeto.data_fim &&
            daysUntil(projeto.data_fim) !== null &&
            (daysUntil(projeto.data_fim) ?? 0) < 0),
      )
      .slice(0, 5);
  }, [projetos]);

  /*
   * ============================================================
   * OPERAÇÕES EM ANDAMENTO
   * ============================================================
   */

  const liveOperations = useMemo(() => {
    return projetos
      .filter(
        (projeto) =>
          projeto.status === "Em andamento",
      )
      .slice(0, 6);
  }, [projetos]);

  /*
   * ============================================================
   * CAPACIDADE
   * ============================================================
   */

  const capacity = useMemo(() => {
    const map = new Map<
      string,
      {
        nome: string;
        total: number;
        andamento: number;
        bloqueados: number;
      }
    >();

    projetos.forEach((projeto) => {
      const nome =
        projeto.responsavel_nome ||
        "Sem responsável";

      const current = map.get(nome) ?? {
        nome,
        total: 0,
        andamento: 0,
        bloqueados: 0,
      };

      current.total += 1;

      if (projeto.status === "Em andamento") {
        current.andamento += 1;
      }

      if (projeto.status === "Bloqueado") {
        current.bloqueados += 1;
      }

      map.set(nome, current);
    });

    return Array.from(map.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [projetos]);

  /*
   * ============================================================
   * FLUXO OPERACIONAL
   * ============================================================
   */

  const operationalFlow = useMemo(() => {
    const stages = [
      "Comercial",
      "Planejamento",
      "Configuração e Parametrização",
      "Homologação e Testes",
      "Treinamento e Capacitação",
      "Go-Live",
      "Suporte",
      "Pós-venda",
    ];

    return stages.map((stage) => {
      const total = projetos.filter(
        (projeto) =>
          projeto.etapa?.nome === stage,
      ).length;

      return {
        stage,
        total,
      };
    });
  }, [projetos]);

  const maxFlow = Math.max(
    ...operationalFlow.map((item) => item.total),
    1,
  );

  /*
   * ============================================================
   * FASE 10 — EXECUTIVE CONTROL TOWER
   *
   * Todos os indicadores abaixo são calculados apenas a partir
   * dos dados que já existem em projetos.
   * ============================================================
   */

  const executiveMetrics = useMemo(() => {
    if (!hoje) {
      return {
        ativos: 0,
        wip: 0,
        bloqueados: 0,
        pausados: 0,
        criticos: 0,
        atrasados: 0,
        proximos7Dias: 0,
        semResponsavel: 0,
        percentualMedio: 0,
        healthScore: 0,
        healthLabel: "Calculando",
        healthTone: "sky",
        statusDistribution: [],
        setores: [],
        bottleneck: {
          stage: "Calculando",
          total: 0,
        },
        executiveRisks: [],
        finalizados7Dias: 0,
        finalizados30Dias: 0,
      };
    }

    const ativos = projetos.filter(
      (projeto) =>
        projeto.status !== "Finalizado" &&
        projeto.status !== "Cancelado",
    );

    const wip = projetos.filter(
      (projeto) =>
        projeto.status === "Em andamento",
    );

    const bloqueados = projetos.filter(
      (projeto) =>
        projeto.status === "Bloqueado",
    );

    const pausados = projetos.filter(
      (projeto) =>
        projeto.status === "Pausado",
    );

    const criticos = projetos.filter(
      (projeto) =>
        projeto.prioridade === "Crítica",
    );

    const atrasados = projetos.filter((projeto) => {
      if (!projeto.data_fim) return false;

      const dias = daysUntil(projeto.data_fim);

      return (
        dias !== null &&
        dias < 0 &&
        projeto.status !== "Finalizado" &&
        projeto.status !== "Cancelado"
      );
    });

    const proximos7Dias = projetos.filter(
      (projeto) => {
        if (!projeto.data_fim) return false;

        const dias = daysUntil(projeto.data_fim);

        return (
          dias !== null &&
          dias >= 0 &&
          dias <= 7 &&
          projeto.status !== "Finalizado" &&
          projeto.status !== "Cancelado"
        );
      },
    );

    const semResponsavel = ativos.filter(
      (projeto) =>
        !projeto.responsavel_nome ||
        projeto.responsavel_nome.trim() === "",
    );

    const percentualMedio =
      ativos.length > 0
        ? Math.round(
            ativos.reduce(
              (acc, projeto) =>
                acc + (projeto.percentual || 0),
              0,
            ) / ativos.length,
          )
        : 0;

    /*
     * Health Score:
     *
     * começa em 100
     * - bloqueados
     * - atrasados
     * - críticos
     * - sem responsável
     * - pausados
     *
     * É um indicador executivo de saúde, não um
     * KPI financeiro ou SLA.
     */

    let healthScore = 100;

    if (ativos.length > 0) {
      healthScore -=
        Math.min(
          30,
          Math.round(
            (bloqueados.length /
              ativos.length) *
              45,
          ),
        );

      healthScore -=
        Math.min(
          25,
          Math.round(
            (atrasados.length /
              ativos.length) *
              35,
          ),
        );

      healthScore -=
        Math.min(
          15,
          Math.round(
            (criticos.length /
              ativos.length) *
              20,
          ),
        );

      healthScore -=
        Math.min(
          10,
          Math.round(
            (semResponsavel.length /
              ativos.length) *
              15,
          ),
        );

      healthScore -=
        Math.min(
          10,
          Math.round(
            (pausados.length /
              ativos.length) *
              10,
          ),
        );
    }

    healthScore = Math.max(
      0,
      Math.min(100, healthScore),
    );

    const healthLabel =
      healthScore >= 85
        ? "Saudável"
        : healthScore >= 70
          ? "Atenção"
          : healthScore >= 50
            ? "Risco"
            : "Crítico";

    const healthTone =
      healthScore >= 85
        ? "emerald"
        : healthScore >= 70
          ? "sky"
          : healthScore >= 50
            ? "amber"
            : "red";

    /*
     * STATUS DISTRIBUTION
     */

    const statusDistribution = [
      {
        label: "Em andamento",
        value: projetos.filter(
          (p) => p.status === "Em andamento",
        ).length,
      },
      {
        label: "Planejado",
        value: projetos.filter(
          (p) => p.status === "Planejado",
        ).length,
      },
      {
        label: "Não iniciado",
        value: projetos.filter(
          (p) => p.status === "Não iniciado",
        ).length,
      },
      {
        label: "Pausado",
        value: pausados.length,
      },
      {
        label: "Bloqueado",
        value: bloqueados.length,
      },
      {
        label: "Finalizado",
        value: projetos.filter(
          (p) => p.status === "Finalizado",
        ).length,
      },
    ];

    /*
     * SETOR
     */

    const setorMap = new Map<string, number>();

    projetos.forEach((projeto) => {
      const setor =
        projeto.setor?.trim() ||
        "Sem setor";

      setorMap.set(
        setor,
        (setorMap.get(setor) ?? 0) + 1,
      );
    });

    const setores = Array.from(
      setorMap.entries(),
    )
      .map(([nome, total]) => ({
        nome,
        total,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);

    /*
     * BOTTLENECK
     */

    const bottleneck = [...operationalFlow]
      .filter((item) => item.total > 0)
      .sort((a, b) => b.total - a.total)[0] ?? {
      stage: "Sem concentração",
      total: 0,
    };

    /*
     * RISCO EXECUTIVO
     */

    const executiveRisks: {
      title: string;
      description: string;
      count: number;
      severity: "critical" | "high" | "medium";
      icon: typeof AlertTriangle;
    }[] = [];

    if (bloqueados.length > 0) {
      executiveRisks.push({
        title: "Projetos bloqueados",
        description:
          "Demandam decisão ou desbloqueio executivo.",
        count: bloqueados.length,
        severity: "critical",
        icon: ShieldAlert,
      });
    }

    if (atrasados.length > 0) {
      executiveRisks.push({
        title: "Prazos vencidos",
        description:
          "Projetos ativos com data final ultrapassada.",
        count: atrasados.length,
        severity: "critical",
        icon: Timer,
      });
    }

    if (criticos.length > 0) {
      executiveRisks.push({
        title: "Prioridade crítica",
        description:
          "Projetos marcados como prioridade Crítica.",
        count: criticos.length,
        severity: "high",
        icon: CircleAlert,
      });
    }

    if (proximos7Dias.length > 0) {
      executiveRisks.push({
        title: "Janela de 7 dias",
        description:
          "Projetos com prazo final nos próximos 7 dias.",
        count: proximos7Dias.length,
        severity: "high",
        icon: CalendarDays,
      });
    }

    if (semResponsavel.length > 0) {
      executiveRisks.push({
        title: "Sem responsável",
        description:
          "Projetos ativos sem ownership definido.",
        count: semResponsavel.length,
        severity: "medium",
        icon: UserRoundX,
      });
    }

    if (pausados.length > 0) {
      executiveRisks.push({
        title: "Projetos pausados",
        description:
          "Itens fora do fluxo ativo de execução.",
        count: pausados.length,
        severity: "medium",
        icon: Clock3,
      });
    }

    /*
     * THROUGHPUT DISPONÍVEL NA BASE ATUAL
     *
     * Como a base possui finished_at, podemos medir
     * quantos projetos foram finalizados no período
     * dos últimos 7 e 30 dias.
     */

    const finalizados7Dias = projetos.filter(
      (projeto) => {
        if (
          projeto.status !== "Finalizado" ||
          !projeto.updated_at
        ) {
          return false;
        }

        const data = new Date(
          projeto.updated_at,
        );

        const diff =
          hoje.getTime() - data.getTime();

        return (
          diff >= 0 &&
          diff <=
            7 *
              24 *
              60 *
              60 *
              1000
        );
      },
    ).length;

    const finalizados30Dias = projetos.filter(
      (projeto) => {
        if (
          projeto.status !== "Finalizado" ||
          !projeto.updated_at
        ) {
          return false;
        }

        const data = new Date(
          projeto.updated_at,
        );

        const diff =
          hoje.getTime() - data.getTime();

        return (
          diff >= 0 &&
          diff <=
            30 *
              24 *
              60 *
              60 *
              1000
        );
      },
    ).length;

    return {
      ativos: ativos.length,
      wip: wip.length,
      bloqueados: bloqueados.length,
      pausados: pausados.length,
      criticos: criticos.length,
      atrasados: atrasados.length,
      proximos7Dias: proximos7Dias.length,
      semResponsavel: semResponsavel.length,
      percentualMedio,
      healthScore,
      healthLabel,
      healthTone,
      statusDistribution,
      setores,
      bottleneck,
      executiveRisks: executiveRisks.slice(
        0,
        6,
      ),
      finalizados7Dias,
      finalizados30Dias,
    };
  }, [projetos, operationalFlow, hoje]);

  /*
   * ============================================================
   * RENDER
   * ============================================================
   */

  async function handleLogout() {
    if (logoutLoading) return;

    try {
      setLogoutLoading(true);

      const response = await fetch("/api/auth/logout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.success) {
        throw new Error(
          result?.error || "Não foi possível encerrar a sessão.",
        );
      }

      window.location.assign("/login");
    } catch (error) {
      console.error("[Control Tower] Erro ao sair:", error);
      setLogoutLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#05070b] text-slate-100">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute left-[15%] top-[-15%] h-[520px] w-[520px] rounded-full bg-sky-500/[0.035] blur-[120px]" />

        <div className="absolute right-[-10%] top-[20%] h-[480px] w-[480px] rounded-full bg-blue-600/[0.025] blur-[120px]" />

        <div className="absolute bottom-[-20%] left-[30%] h-[520px] w-[520px] rounded-full bg-cyan-500/[0.018] blur-[140px]" />
      </div>

      <div className="relative flex min-h-screen">
        {/* MOBILE OVERLAY */}

        {sidebarOpen && (
          <button
            aria-label="Fechar menu"
            onClick={() =>
              setSidebarOpen(false)
            }
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          />
        )}

        {/* SIDEBAR */}

        <aside
          className={[
            "fixed inset-y-0 left-0 z-50 flex w-[258px] flex-col border-r border-white/[0.06] bg-[#070a10]/95 backdrop-blur-xl transition-transform duration-300 lg:static lg:translate-x-0",
            sidebarOpen
              ? "translate-x-0"
              : "-translate-x-full",
          ].join(" ")}
        >
          <div className="flex h-[76px] items-center justify-between border-b border-white/[0.06] px-5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-sky-400/20 bg-sky-400/[0.08]">
                <Sparkles
                  size={17}
                  className="text-sky-300"
                />
              </div>

              <div>
                <div className="text-[13px] font-semibold tracking-[0.18em] text-white">
                  WMS EXPERT
                </div>

                <div className="mt-0.5 text-[10px] uppercase tracking-[0.2em] text-slate-500">
                  Control Tower
                </div>
              </div>
            </div>

            <button
              onClick={() =>
                setSidebarOpen(false)
              }
              className="rounded-lg p-2 text-slate-500 hover:bg-white/[0.04] hover:text-white lg:hidden"
            >
              <X size={17} />
            </button>
          </div>

          <div className="px-3 pt-6">
            <div className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">
              Workspace
            </div>

            <nav className="space-y-1">
              {menuItems.map((item) => {
                const Icon = item.icon;
                const active =
                  selectedMenu === item.label;

                return (
                  <button
                    key={item.label}
                    onClick={() => {
                      setSelectedMenu(
                        item.label,
                      );
                      setSidebarOpen(false);
                    }}
                    className={[
                      "group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] transition",
                      active
                        ? "border border-sky-400/10 bg-sky-400/[0.08] text-sky-200"
                        : "text-slate-500 hover:bg-white/[0.035] hover:text-slate-200",
                    ].join(" ")}
                  >
                    <Icon
                      size={16}
                      className={
                        active
                          ? "text-sky-300"
                          : "text-slate-600 group-hover:text-slate-300"
                      }
                    />

                    <span>{item.label}</span>

                    {item.label ===
                      "Carteira" && (
                      <span className="ml-auto rounded-full bg-white/[0.05] px-2 py-0.5 text-[10px] text-slate-500">
                        {resumo?.total ?? 24}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="mt-auto px-3 pb-4">
            <div className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">
              Sistema
            </div>

            <nav className="space-y-1">
              {bottomMenu.map((item) => {
                const Icon = item.icon;
                const active =
                  selectedMenu === item.label;

                return (
                  <button
                    key={item.label}
                    onClick={() => {
                      setSelectedMenu(
                        item.label,
                      );
                      setSidebarOpen(false);
                    }}
                    className={[
                      "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] transition",
                      active
                        ? "bg-white/[0.06] text-white"
                        : "text-slate-500 hover:bg-white/[0.035] hover:text-slate-200",
                    ].join(" ")}
                  >
                    <Icon size={16} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>

            <div className="mt-5 rounded-2xl border border-white/[0.06] bg-white/[0.025] p-3">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.45)]" />

                <span className="text-[11px] font-medium text-slate-300">
                  Supabase conectado
                </span>
              </div>

              <div className="mt-2 text-[10px] leading-4 text-slate-600">
                Dados operacionais sincronizados
                com a base central.
              </div>
            </div>
          </div>
        </aside>

        {/* MAIN */}

        <section className="min-w-0 flex-1">
          {/* TOPBAR */}

          <header className="flex h-[76px] items-center gap-4 border-b border-white/[0.06] px-4 sm:px-6 lg:px-8">
            <button
              onClick={() =>
                setSidebarOpen(true)
              }
              className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-2.5 text-slate-400 hover:text-white lg:hidden"
            >
              <Menu size={18} />
            </button>

            <div className="hidden items-center gap-2 text-[12px] text-slate-600 sm:flex">
              <Activity size={14} />
              <span>Executive workspace</span>
              <ArrowRight size={13} />
              <span className="text-slate-400">
                {selectedMenu}
              </span>
            </div>

            <div className="ml-auto flex items-center gap-2">
              <div className="relative hidden md:block">
                <Search
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600"
                />

                <input
                  value={search}
                  onChange={(event) =>
                    setSearch(
                      event.target.value,
                    )
                  }
                  placeholder="Buscar cliente, projeto..."
                  className="h-9 w-[240px] rounded-xl border border-white/[0.06] bg-white/[0.025] pl-9 pr-3 text-xs text-slate-200 outline-none transition placeholder:text-slate-700 focus:border-sky-400/20 focus:bg-white/[0.04]"
                />
              </div>

              <button className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.025] text-slate-500 hover:text-slate-200">
                <Bell size={16} />

                {criticalAlerts.length > 0 && (
                  <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-red-400" />
                )}
              </button>

              <div className="ml-1 hidden h-8 w-px bg-white/[0.06] sm:block" />

              <div className="relative hidden sm:block">
                <button
                  type="button"
                  onClick={() => setUserMenuOpen((open) => !open)}
                  aria-expanded={userMenuOpen}
                  aria-haspopup="menu"
                  className="flex items-center gap-2 rounded-xl border border-transparent px-2 py-1.5 transition hover:border-white/[0.06] hover:bg-white/[0.025]"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full border border-sky-400/15 bg-sky-400/[0.08] text-[10px] font-semibold text-sky-200">
                    TM
                  </div>

                  <div className="hidden xl:block text-left">
                    <div className="text-[11px] font-medium text-slate-300">
                      Tony Moreira
                    </div>

                    <div className="text-[9px] text-slate-600">
                      Product Owner · CEO
                    </div>
                  </div>

                  <ChevronDown
                    size={13}
                    className={`text-slate-600 transition-transform ${
                      userMenuOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {userMenuOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 top-[calc(100%+8px)] z-50 w-60 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0a1019]/95 p-1.5 shadow-2xl shadow-black/40 backdrop-blur-xl"
                  >
                    <div className="border-b border-white/[0.06] px-3 py-2.5">
                      <div className="text-[11px] font-medium text-slate-200">
                        Tony Moreira
                      </div>
                      <div className="mt-0.5 text-[9px] text-slate-500">
                        CEO · Product Owner / IUX / P&D
                      </div>
                    </div>

                    <button
                      type="button"
                      role="menuitem"
                      onClick={handleLogout}
                      disabled={logoutLoading}
                      className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-[11px] font-medium text-slate-300 transition hover:bg-red-400/[0.07] hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <LogOut size={15} />
                      <span>{logoutLoading ? "Encerrando sessão..." : "Sair do Control Tower"}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </header>

          <div className="px-4 pb-10 pt-6 sm:px-6 lg:px-8">
            {/* HERO */}

            <div className="relative overflow-hidden rounded-3xl border border-white/[0.07] bg-gradient-to-br from-white/[0.045] via-white/[0.018] to-transparent">
              <div className="absolute right-[-80px] top-[-100px] h-[300px] w-[300px] rounded-full bg-sky-400/[0.045] blur-[90px]" />

              <div className="relative flex flex-col gap-6 p-5 sm:p-7 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <div className="mb-3 flex items-center gap-2">
                    <span className="flex h-6 items-center gap-1.5 rounded-full border border-emerald-400/10 bg-emerald-400/[0.06] px-2.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-emerald-300">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      Live
                    </span>

                    <span className="text-[10px] uppercase tracking-[0.14em] text-slate-600">
                      Executive command center
                    </span>
                  </div>

                  <h1 className="text-2xl font-semibold tracking-[-0.035em] text-white sm:text-3xl">
                    Control Tower
                  </h1>

                  <p className="mt-2 max-w-xl text-xs leading-5 text-slate-500 sm:text-sm">
                    Visão executiva da operação WMS
                    Expert. Carteira, implantação,
                    desenvolvimento e suporte em
                    uma única camada operacional.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2.5">
                    <div className="text-[9px] uppercase tracking-[0.14em] text-slate-600">
                      Janela operacional
                    </div>

                    <div className="mt-1 text-xs font-medium text-slate-300">
                      05 — 09 OUT 2026
                    </div>
                  </div>

                  <button className="flex h-10 items-center gap-2 rounded-xl bg-sky-500 px-4 text-xs font-semibold text-slate-950 shadow-[0_8px_30px_rgba(14,165,233,0.12)] transition hover:bg-sky-400">
                    <Plus size={15} />
                    Novo projeto
                  </button>
                </div>
              </div>
            </div>

            {/* LOADING */}

            {loading && (
              <div className="mt-5 rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4 text-xs text-slate-500">
                Sincronizando carteira com o
                Supabase...
              </div>
            )}

            {/* ERROR */}

            {error && (
              <div className="mt-5 flex items-start gap-3 rounded-2xl border border-red-400/10 bg-red-400/[0.04] p-4">
                <AlertTriangle
                  size={17}
                  className="mt-0.5 shrink-0 text-red-300"
                />

                <div>
                  <div className="text-xs font-semibold text-red-200">
                    Não foi possível carregar a
                    carteira
                  </div>

                  <div className="mt-1 text-[11px] text-red-300/60">
                    {error}
                  </div>
                </div>
              </div>
            )}

            {/* CONTEÚDO DINÂMICO */}

            {selectedMenu === "Overview" && (
              <DashboardExecutivo onOpenProjeto={openProjeto360ById} />
            )}

            {selectedMenu === "Governança" ? (
              <GovernancaCentral onOpenProjeto={openProjeto360ById} />
            ) : selectedMenu === "Kanban" ? (
              <div className="mt-5">
                <KanbanBoard
                  projetos={projetos}
                  onUpdated={loadProjetos}
                  onEdit={openEditProjeto}
                  onOpen360={openProjeto360}
                />
              </div>
            ) : selectedMenu === "Gantt / Timeline" ? (
              <div className="mt-5">
                <GanttBoard
                  projetos={projetos}
                  onEdit={openEditProjeto}
                  onOpen360={openProjeto360}
                />
              </div>
            ) : (
              <>
                {/* =====================================================
                    FASE 10 — EXECUTIVE HEALTH
                   ===================================================== */}

                <section className="mt-5 grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
                  {/* HEALTH */}

                  <div className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-gradient-to-br from-white/[0.045] via-white/[0.025] to-transparent p-5">
                    <div className="absolute right-[-50px] top-[-70px] h-[220px] w-[220px] rounded-full bg-sky-400/[0.035] blur-[80px]" />

                    <div className="relative">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <ShieldCheck
                              size={14}
                              className="text-sky-300"
                            />

                            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                              Executive Health
                            </span>
                          </div>

                          <div className="mt-2 text-xs text-slate-600">
                            Saúde operacional da carteira
                          </div>
                        </div>

                        <span
                          className={[
                            "rounded-full border px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.12em]",
                            executiveMetrics.healthTone ===
                              "emerald"
                              ? "border-emerald-400/10 bg-emerald-400/[0.06] text-emerald-300"
                              : executiveMetrics.healthTone ===
                                  "sky"
                                ? "border-sky-400/10 bg-sky-400/[0.06] text-sky-300"
                                : executiveMetrics.healthTone ===
                                    "amber"
                                  ? "border-amber-400/10 bg-amber-400/[0.06] text-amber-300"
                                  : "border-red-400/10 bg-red-400/[0.06] text-red-300",
                          ].join(" ")}
                        >
                          {executiveMetrics.healthLabel}
                        </span>
                      </div>

                      <div className="mt-7 flex items-end gap-5">
                        <div className="text-5xl font-semibold tracking-[-0.06em] text-white">
                          {loading
                            ? "—"
                            : executiveMetrics.healthScore}
                        </div>

                        <div className="pb-1">
                          <div className="text-[10px] uppercase tracking-[0.14em] text-slate-600">
                            Score
                          </div>

                          <div className="mt-1 text-[11px] text-slate-500">
                            de 100 pontos
                          </div>
                        </div>
                      </div>

                      <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/[0.05]">
                        <div
                          className={[
                            "h-full rounded-full transition-all duration-700",
                            executiveMetrics.healthTone ===
                              "emerald"
                              ? "bg-emerald-400/70"
                              : executiveMetrics.healthTone ===
                                  "sky"
                                ? "bg-sky-400/70"
                                : executiveMetrics.healthTone ===
                                    "amber"
                                  ? "bg-amber-400/70"
                                  : "bg-red-400/70",
                          ].join(" ")}
                          style={{
                            width: `${executiveMetrics.healthScore}%`,
                          }}
                        />
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <MiniMetric
                          label="WIP"
                          value={
                            executiveMetrics.wip
                          }
                          icon={Workflow}
                        />

                        <MiniMetric
                          label="Bloqueados"
                          value={
                            executiveMetrics.bloqueados
                          }
                          icon={ShieldAlert}
                        />

                        <MiniMetric
                          label="Atrasados"
                          value={
                            executiveMetrics.atrasados
                          }
                          icon={Timer}
                        />

                        <MiniMetric
                          label="Próx. 7 dias"
                          value={
                            executiveMetrics.proximos7Dias
                          }
                          icon={CalendarDays}
                        />
                      </div>
                    </div>
                  </div>

                  {/* EXECUTIVE SUMMARY */}

                  <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-5">
                    <div className="flex items-center gap-2">
                      <BarChart3
                        size={14}
                        className="text-sky-300"
                      />

                      <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Executive snapshot
                      </span>
                    </div>

                    <div className="mt-5 grid grid-cols-2 gap-3">
                      <ExecutiveMetric
                        label="Carteira ativa"
                        value={
                          executiveMetrics.ativos
                        }
                        helper="Projetos não encerrados"
                      />

                      <ExecutiveMetric
                        label="Progresso médio"
                        value={`${executiveMetrics.percentualMedio}%`}
                        helper="Carteira ativa"
                      />

                      <ExecutiveMetric
                        label="Finalizados 7d"
                        value={
                          executiveMetrics.finalizados7Dias
                        }
                        helper="Throughput recente"
                      />

                      <ExecutiveMetric
                        label="Finalizados 30d"
                        value={
                          executiveMetrics.finalizados30Dias
                        }
                        helper="Throughput acumulado"
                      />
                    </div>

                    <div className="mt-4 rounded-xl border border-white/[0.05] bg-black/20 p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-[9px] uppercase tracking-[0.14em] text-slate-600">
                            Bottleneck atual
                          </div>

                          <div className="mt-1 text-xs font-medium text-slate-300">
                            {
                              executiveMetrics
                                .bottleneck.stage
                            }
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-lg font-semibold text-white">
                            {
                              executiveMetrics
                                .bottleneck.total
                            }
                          </div>

                          <div className="text-[8px] text-slate-600">
                            projetos
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                {/* =====================================================
                    FASE 10 — WIP / RISK / DEADLINE / OWNERSHIP
                   ===================================================== */}

                <section className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
                  <ExecutiveKpi
                    label="WIP"
                    value={
                      executiveMetrics.wip
                    }
                    helper="Em execução"
                    icon={Workflow}
                    tone="sky"
                  />

                  <ExecutiveKpi
                    label="Bloqueados"
                    value={
                      executiveMetrics.bloqueados
                    }
                    helper="Intervenção"
                    icon={ShieldAlert}
                    tone="red"
                  />

                  <ExecutiveKpi
                    label="Atrasados"
                    value={
                      executiveMetrics.atrasados
                    }
                    helper="Prazo vencido"
                    icon={Timer}
                    tone="red"
                  />

                  <ExecutiveKpi
                    label="Próx. 7 dias"
                    value={
                      executiveMetrics.proximos7Dias
                    }
                    helper="Deadline"
                    icon={CalendarDays}
                    tone="amber"
                  />

                  <ExecutiveKpi
                    label="Críticos"
                    value={
                      executiveMetrics.criticos
                    }
                    helper="Prioridade"
                    icon={CircleAlert}
                    tone="violet"
                  />

                  <ExecutiveKpi
                    label="Sem owner"
                    value={
                      executiveMetrics.semResponsavel
                    }
                    helper="Responsável"
                    icon={UserRoundX}
                    tone="slate"
                  />
                </section>

                {/* =====================================================
                    FASE 10 — RISK RADAR
                   ===================================================== */}

                <section className="mt-5 grid gap-5 xl:grid-cols-[1fr_1fr]">
                  {/* RISK RADAR */}

                  <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025]">
                    <div className="flex items-center justify-between border-b border-white/[0.05] px-4 py-4 sm:px-5">
                      <div>
                        <div className="flex items-center gap-2">
                          <ShieldAlert
                            size={14}
                            className="text-red-300"
                          />

                          <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">
                            Risk radar
                          </div>
                        </div>

                        <div className="mt-1 text-xs text-slate-600">
                          Exceções que podem exigir decisão
                        </div>
                      </div>

                      <span className="rounded-full bg-red-400/[0.07] px-2 py-1 text-[9px] text-red-300">
                        {executiveMetrics.executiveRisks.length}{" "}
                        sinais
                      </span>
                    </div>

                    <div className="divide-y divide-white/[0.04]">
                      {executiveMetrics.executiveRisks.length ===
                      0 ? (
                        <div className="flex min-h-[150px] items-center justify-center px-5 text-center">
                          <div>
                            <CheckCircle2
                              size={22}
                              className="mx-auto text-emerald-300"
                            />

                            <div className="mt-2 text-xs font-medium text-slate-300">
                              Nenhum risco relevante identificado
                            </div>

                            <div className="mt-1 text-[9px] text-slate-600">
                              A carteira atual não apresenta
                              exceções calculáveis.
                            </div>
                          </div>
                        </div>
                      ) : (
                        executiveMetrics.executiveRisks.map(
                          (risk) => {
                            const Icon = risk.icon;

                            return (
                              <div
                                key={risk.title}
                                className="flex items-center gap-3 px-4 py-3.5 sm:px-5"
                              >
                                <div
                                  className={[
                                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                                    risk.severity ===
                                      "critical"
                                      ? "bg-red-400/[0.07] text-red-300"
                                      : risk.severity ===
                                          "high"
                                        ? "bg-amber-400/[0.07] text-amber-300"
                                        : "bg-slate-400/[0.06] text-slate-400",
                                  ].join(" ")}
                                >
                                  <Icon size={14} />
                                </div>

                                <div className="min-w-0 flex-1">
                                  <div className="text-xs font-medium text-slate-300">
                                    {risk.title}
                                  </div>

                                  <div className="mt-1 truncate text-[9px] text-slate-600">
                                    {risk.description}
                                  </div>
                                </div>

                                <div className="text-lg font-semibold text-white">
                                  {risk.count}
                                </div>
                              </div>
                            );
                          },
                        )
                      )}
                    </div>
                  </div>

                  {/* STATUS DISTRIBUTION */}

                  <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025]">
                    <div className="flex items-center justify-between border-b border-white/[0.05] px-4 py-4 sm:px-5">
                      <div>
                        <div className="flex items-center gap-2">
                          <Activity
                            size={14}
                            className="text-sky-300"
                          />

                          <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">
                            Portfolio state
                          </div>
                        </div>

                        <div className="mt-1 text-xs text-slate-600">
                          Distribuição da carteira por status
                        </div>
                      </div>

                      <div className="text-[10px] text-slate-600">
                        {projetos.length} total
                      </div>
                    </div>

                    <div className="p-4 sm:p-5">
                      {executiveMetrics.statusDistribution.map(
                        (item) => {
                          const percentage =
                            projetos.length > 0
                              ? Math.round(
                                  (item.value /
                                    projetos.length) *
                                    100,
                                )
                              : 0;

                          const config =
                            statusClass(
                              item.label,
                            );

                          return (
                            <div
                              key={item.label}
                              className="mb-4 last:mb-0"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span
                                    className={[
                                      "h-1.5 w-1.5 rounded-full",
                                      config.dot,
                                    ].join(" ")}
                                  />

                                  <span className="text-[10px] text-slate-500">
                                    {item.label}
                                  </span>
                                </div>

                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-medium text-slate-300">
                                    {item.value}
                                  </span>

                                  <span className="w-8 text-right text-[8px] text-slate-700">
                                    {percentage}%
                                  </span>
                                </div>
                              </div>

                              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/[0.04]">
                                <div
                                  className={[
                                    "h-full rounded-full transition-all",
                                    config.dot.replace(
                                      "bg-",
                                      "bg-",
                                    ),
                                  ].join(" ")}
                                  style={{
                                    width: `${percentage}%`,
                                  }}
                                />
                              </div>
                            </div>
                          );
                        },
                      )}
                    </div>
                  </div>
                </section>

                {/* =====================================================
                    FASE 10 — EXECUTIVE FLOW
                   ===================================================== */}

                <section className="mt-5 rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4 sm:p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <GitBranch
                          size={14}
                          className="text-sky-300"
                        />

                        <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">
                          Executive flow
                        </div>
                      </div>

                      <div className="mt-1 text-xs text-slate-600">
                        Onde a carteira está concentrada neste momento
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-[9px] text-slate-600">
                        Bottleneck
                      </span>

                      <span className="rounded-full border border-amber-400/10 bg-amber-400/[0.05] px-2 py-1 text-[9px] text-amber-300">
                        {executiveMetrics.bottleneck.stage}
                      </span>
                    </div>
                  </div>

                  <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
                    {operationalFlow.map(
                      (item, index) => {
                        const isBottleneck =
                          item.stage ===
                          executiveMetrics
                            .bottleneck.stage;

                        return (
                          <div
                            key={item.stage}
                            className="relative"
                          >
                            <div
                              className={[
                                "rounded-xl border p-3 transition",
                                isBottleneck
                                  ? "border-amber-400/15 bg-amber-400/[0.04]"
                                  : "border-white/[0.05] bg-black/10",
                              ].join(" ")}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[8px] uppercase tracking-[0.08em] text-slate-600">
                                  0{index + 1}
                                </span>

                                {isBottleneck && (
                                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                                )}
                              </div>

                              <div className="mt-3 truncate text-[10px] font-medium text-slate-400">
                                {item.stage}
                              </div>

                              <div className="mt-2 text-xl font-semibold text-white">
                                {item.total}
                              </div>

                              <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.04]">
                                <div
                                  className={[
                                    "h-full rounded-full",
                                    isBottleneck
                                      ? "bg-amber-400/60"
                                      : "bg-sky-400/50",
                                  ].join(" ")}
                                  style={{
                                    width: `${Math.max(
                                      item.total ===
                                        0
                                        ? 0
                                        : (item.total /
                                            maxFlow) *
                                            100,
                                      item.total ===
                                        0
                                        ? 0
                                        : 8,
                                    )}%`,
                                  }}
                                />
                              </div>
                            </div>

                            {index <
                              operationalFlow.length -
                                1 && (
                              <ArrowRight
                                size={11}
                                className="absolute -right-2 top-1/2 hidden -translate-y-1/2 text-slate-800 xl:block"
                              />
                            )}
                          </div>
                        );
                      },
                    )}
                  </div>
                </section>

                {/* =====================================================
                    EXISTENTE — KPI GRID
                   ===================================================== */}

                <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <KpiCard
                    label="Carteira total"
                    value={
                      loading
                        ? "—"
                        : String(
                            resumo?.total ?? 0,
                          )
                    }
                    helper="Projetos ativos na base"
                    icon={Layers3}
                    accent="sky"
                  />

                  <KpiCard
                    label="Go-Lives"
                    value={
                      loading
                        ? "—"
                        : String(
                            resumo?.goLives ?? 0,
                          )
                    }
                    helper="Na janela operacional"
                    icon={Zap}
                    accent="emerald"
                  />

                  <KpiCard
                    label="Integrações"
                    value={
                      loading
                        ? "—"
                        : String(
                            resumo?.integracoes ?? 0,
                          )
                    }
                    helper="Demandas de integração"
                    icon={Database}
                    accent="violet"
                  />

                  <KpiCard
                    label="Bloqueados"
                    value={
                      loading
                        ? "—"
                        : String(
                            resumo?.bloqueados ?? 0,
                          )
                    }
                    helper="Exigem intervenção"
                    icon={AlertTriangle}
                    accent="red"
                  />
                </div>

                {/* =====================================================
                    EXISTENTE — FLOW
                   ===================================================== */}

                <section className="mt-5 rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4 sm:p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">
                        Operational flow
                      </div>

                      <div className="mt-1 text-xs text-slate-600">
                        Distribuição atual por etapa
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 text-[10px] text-slate-600">
                      <CircleDot
                        size={12}
                        className="text-sky-400"
                      />
                      Base real
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
                    {operationalFlow.map(
                      (item) => (
                        <div
                          key={item.stage}
                          className="min-w-0"
                        >
                          <div className="flex items-end justify-between gap-2">
                            <span className="truncate text-[9px] text-slate-600">
                              {item.stage}
                            </span>

                            <span className="text-[11px] font-semibold text-slate-300">
                              {item.total}
                            </span>
                          </div>

                          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.04]">
                            <div
                              className="h-full rounded-full bg-sky-400/60 transition-all"
                              style={{
                                width: `${Math.max(
                                  item.total === 0
                                    ? 0
                                    : (item.total /
                                        maxFlow) *
                                        100,
                                  item.total === 0
                                    ? 0
                                    : 7,
                                )}%`,
                              }}
                            />
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                </section>

                {/* =====================================================
                    EXISTENTE — MAIN GRID
                   ===================================================== */}

                <div className="mt-5 grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
                  {/* LIVE OPERATIONS */}

                  <section className="min-w-0 rounded-2xl border border-white/[0.06] bg-white/[0.025]">
                    <div className="flex items-center justify-between border-b border-white/[0.05] px-4 py-4 sm:px-5">
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">
                          Live operations
                        </div>

                        <div className="mt-1 text-xs text-slate-600">
                          Projetos em execução
                        </div>
                      </div>

                      <button
                        onClick={() =>
                          setSelectedMenu(
                            "Carteira",
                          )
                        }
                        className="text-[10px] font-medium text-sky-400 hover:text-sky-300"
                      >
                        Ver carteira
                      </button>
                    </div>

                    <div className="divide-y divide-white/[0.04]">
                      {liveOperations.length ===
                      0 ? (
                        <EmptyState text="Nenhum projeto em andamento." />
                      ) : (
                        liveOperations.map(
                          (projeto) => (
                            <ProjectRow
                              key={projeto.id}
                              projeto={projeto}
                              onOpen360={
                                openProjeto360
                              }
                              onEdit={
                                openEditProjeto
                              }
                              onUpdated={
                                loadProjetos
                              }
                            />
                          ),
                        )
                      )}
                    </div>
                  </section>

                  {/* ALERTS */}

                  <section className="rounded-2xl border border-white/[0.06] bg-white/[0.025]">
                    <div className="flex items-center justify-between border-b border-white/[0.05] px-4 py-4 sm:px-5">
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">
                          Critical alerts
                        </div>

                        <div className="mt-1 text-xs text-slate-600">
                          Pontos que exigem atenção
                        </div>
                      </div>

                      <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-red-400/[0.08] px-2 text-[10px] font-semibold text-red-300">
                        {criticalAlerts.length}
                      </span>
                    </div>

                    <div className="divide-y divide-white/[0.04]">
                      {criticalAlerts.length ===
                      0 ? (
                        <EmptyState text="Nenhum alerta crítico." />
                      ) : (
                        criticalAlerts.map(
                          (projeto) => (
                            <AlertRow
                              key={projeto.id}
                              projeto={projeto}
                            />
                          ),
                        )
                      )}
                    </div>
                  </section>
                </div>

                {/* =====================================================
                    FASE 10 — SETORES + THROUGHPUT
                   ===================================================== */}

                <div className="mt-5 grid gap-5 lg:grid-cols-2">
                  {/* SETORES */}

                  <section className="rounded-2xl border border-white/[0.06] bg-white/[0.025]">
                    <div className="flex items-center justify-between border-b border-white/[0.05] px-4 py-4 sm:px-5">
                      <div>
                        <div className="flex items-center gap-2">
                          <Layers3
                            size={14}
                            className="text-violet-300"
                          />

                          <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">
                            Carteira por setor
                          </div>
                        </div>

                        <div className="mt-1 text-xs text-slate-600">
                          Onde a demanda está concentrada
                        </div>
                      </div>
                    </div>

                    <div className="p-4 sm:p-5">
                      {executiveMetrics.setores.map(
                        (setor) => {
                          const percentage =
                            projetos.length > 0
                              ? Math.round(
                                  (setor.total /
                                    projetos.length) *
                                    100,
                                )
                              : 0;

                          return (
                            <div
                              key={setor.nome}
                              className="mb-4 last:mb-0"
                            >
                              <div className="flex items-center justify-between">
                                <span className="truncate text-[10px] text-slate-500">
                                  {setor.nome}
                                </span>

                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-semibold text-slate-300">
                                    {setor.total}
                                  </span>

                                  <span className="text-[8px] text-slate-700">
                                    {percentage}%
                                  </span>
                                </div>
                              </div>

                              <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.04]">
                                <div
                                  className="h-full rounded-full bg-violet-400/50"
                                  style={{
                                    width: `${percentage}%`,
                                  }}
                                />
                              </div>
                            </div>
                          );
                        },
                      )}

                      {executiveMetrics.setores
                        .length === 0 && (
                        <EmptyState text="Nenhum setor encontrado." />
                      )}
                    </div>
                  </section>

                  {/* THROUGHPUT */}

                  <section className="rounded-2xl border border-white/[0.06] bg-white/[0.025]">
                    <div className="flex items-center justify-between border-b border-white/[0.05] px-4 py-4 sm:px-5">
                      <div>
                        <div className="flex items-center gap-2">
                          <TrendingUp
                            size={14}
                            className="text-emerald-300"
                          />

                          <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">
                            Throughput
                          </div>
                        </div>

                        <div className="mt-1 text-xs text-slate-600">
                          Entregas identificadas pela base atual
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 p-4 sm:p-5">
                      <div className="rounded-xl border border-white/[0.05] bg-black/10 p-4">
                        <div className="flex items-center justify-between">
                          <div className="text-[9px] uppercase tracking-[0.12em] text-slate-600">
                            Últimos 7 dias
                          </div>

                          <ArrowUpRight
                            size={13}
                            className="text-emerald-300"
                          />
                        </div>

                        <div className="mt-4 text-3xl font-semibold tracking-[-0.05em] text-white">
                          {
                            executiveMetrics.finalizados7Dias
                          }
                        </div>

                        <div className="mt-1 text-[9px] text-slate-700">
                          finalizados
                        </div>
                      </div>

                      <div className="rounded-xl border border-white/[0.05] bg-black/10 p-4">
                        <div className="flex items-center justify-between">
                          <div className="text-[9px] uppercase tracking-[0.12em] text-slate-600">
                            Últimos 30 dias
                          </div>

                          <ArrowUpRight
                            size={13}
                            className="text-sky-300"
                          />
                        </div>

                        <div className="mt-4 text-3xl font-semibold tracking-[-0.05em] text-white">
                          {
                            executiveMetrics.finalizados30Dias
                          }
                        </div>

                        <div className="mt-1 text-[9px] text-slate-700">
                          finalizados
                        </div>
                      </div>
                    </div>

                    <div className="mx-4 mb-4 rounded-xl border border-white/[0.05] bg-black/10 p-3 sm:mx-5 sm:mb-5">
                      <div className="flex items-center gap-2">
                        <CircleDot
                          size={12}
                          className="text-emerald-300"
                        />

                        <span className="text-[9px] text-slate-500">
                          Indicador calculado com base em
                          projetos Finalizados e updated_at.
                        </span>
                      </div>
                    </div>
                  </section>
                </div>

                {/* =====================================================
                    EXISTENTE — BOTTOM GRID
                   ===================================================== */}

                <div className="mt-5 grid gap-5 lg:grid-cols-2">
                  {/* CAPACITY */}

                  <section className="rounded-2xl border border-white/[0.06] bg-white/[0.025]">
                    <div className="flex items-center justify-between border-b border-white/[0.05] px-4 py-4 sm:px-5">
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">
                          Capacity & agenda
                        </div>

                        <div className="mt-1 text-xs text-slate-600">
                          Distribuição por responsável
                        </div>
                      </div>

                      <Users
                        size={15}
                        className="text-slate-600"
                      />
                    </div>

                    <div className="p-4 sm:p-5">
                      {capacity.map(
                        (person) => {
                          const percentage =
                            Math.min(
                              person.total * 20,
                              100,
                            );

                          return (
                            <div
                              key={person.nome}
                              className="mb-4 last:mb-0"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                  <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.035] text-[9px] font-semibold text-slate-400">
                                    {getInitials(
                                      person.nome,
                                    )}
                                  </div>

                                  <div>
                                    <div className="text-[11px] font-medium text-slate-300">
                                      {person.nome}
                                    </div>

                                    <div className="text-[9px] text-slate-600">
                                      {person.total}{" "}
                                      projetos ·{" "}
                                      {
                                        person.andamento
                                      }{" "}
                                      em andamento
                                    </div>
                                  </div>
                                </div>

                                {person.bloqueados >
                                  0 && (
                                  <span className="text-[9px] text-red-300">
                                    {
                                      person.bloqueados
                                    }{" "}
                                    bloqueado
                                    {person.bloqueados >
                                    1
                                      ? "s"
                                      : ""}
                                  </span>
                                )}
                              </div>

                              <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.04]">
                                <div
                                  className="h-full rounded-full bg-sky-400/50"
                                  style={{
                                    width: `${percentage}%`,
                                  }}
                                />
                              </div>
                            </div>
                          );
                        },
                      )}

                      {capacity.length ===
                        0 && (
                        <EmptyState text="Nenhum responsável encontrado." />
                      )}
                    </div>
                  </section>

                  {/* UPCOMING */}

                  <section className="rounded-2xl border border-white/[0.06] bg-white/[0.025]">
                    <div className="flex items-center justify-between border-b border-white/[0.05] px-4 py-4 sm:px-5">
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">
                          Próximos Go-Lives
                        </div>

                        <div className="mt-1 text-xs text-slate-600">
                          Agenda operacional
                        </div>
                      </div>

                      <CalendarDays
                        size={15}
                        className="text-slate-600"
                      />
                    </div>

                    <div className="divide-y divide-white/[0.04]">
                      {goLives.length === 0 ? (
                        <EmptyState text="Nenhum Go-Live programado." />
                      ) : (
                        goLives.map(
                          (projeto) => (
                            <div
                              key={projeto.id}
                              className="flex items-center gap-3 px-4 py-3.5 sm:px-5"
                            >
                              <div className="flex h-9 w-9 shrink-0 flex-col items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.025]">
                                <span className="text-[8px] uppercase text-slate-600">
                                  {projeto.data_inicio
                                    ? projeto.data_inicio.slice(
                                        5,
                                        7,
                                      )
                                    : "--"}
                                </span>

                                <span className="text-[11px] font-semibold text-slate-300">
                                  {projeto.data_inicio
                                    ? projeto.data_inicio.slice(
                                        8,
                                        10,
                                      )
                                    : "--"}
                                </span>
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="truncate text-xs font-medium text-slate-300">
                                    {
                                      projeto.nome
                                    }
                                  </span>

                                  <span className="shrink-0 rounded-full bg-white/[0.04] px-1.5 py-0.5 text-[8px] text-slate-600">
                                    {
                                      projeto.status
                                    }
                                  </span>
                                </div>

                                <div className="mt-1 flex items-center gap-2 text-[9px] text-slate-600">
                                  <span>
                                    {projeto.responsavel_nome ||
                                      "Sem responsável"}
                                  </span>

                                  <span>•</span>

                                  <span>
                                    {projeto.data_fim
                                      ? formatDate(
                                          projeto.data_fim,
                                        )
                                      : "Sem fim"}
                                  </span>
                                </div>
                              </div>

                              <span className="hidden shrink-0 text-[9px] text-slate-600 sm:block">
                                {relativeDate(
                                  projeto.data_inicio,
                                )}
                              </span>
                            </div>
                          ),
                        )
                      )}
                    </div>
                  </section>
                </div>

                {/* =====================================================
                    DATABASE STATUS
                   ===================================================== */}

                <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.018] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-400/[0.07]">
                      <CheckCircle2
                        size={14}
                        className="text-emerald-300"
                      />
                    </div>

                    <div>
                      <div className="text-[10px] font-medium text-slate-400">
                        Conexão operacional
                      </div>

                      <div className="text-[9px] text-slate-600">
                        Supabase · {projetos.length}{" "}
                        projetos sincronizados
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-[9px] text-slate-600">
                    <span className="flex items-center gap-1.5">
                      <Clock3 size={11} />
                      Atualização em tempo real
                    </span>

                    <span className="flex items-center gap-1.5">
                      <TrendingUp size={11} />
                      Base operacional
                    </span>
                  </div>
                </div>

                {/* SEARCH RESULTS */}

                {search && (
                  <div className="mt-5 rounded-2xl border border-white/[0.06] bg-white/[0.025]">
                    <div className="flex items-center justify-between border-b border-white/[0.05] px-4 py-4">
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">
                          Resultado da busca
                        </div>

                        <div className="mt-1 text-xs text-slate-600">
                          {projetosFiltrados.length}{" "}
                          projeto
                          {projetosFiltrados.length ===
                          1
                            ? ""
                            : "s"}{" "}
                          encontrado
                          {projetosFiltrados.length ===
                          1
                            ? ""
                            : "s"}
                        </div>
                      </div>

                      <button
                        onClick={() =>
                          setSearch("")
                        }
                        className="text-slate-600 hover:text-slate-300"
                      >
                        <X size={15} />
                      </button>
                    </div>

                    <div className="divide-y divide-white/[0.04]">
                      {projetosFiltrados
                        .slice(0, 10)
                        .map((projeto) => (
                          <ProjectRow
                            key={projeto.id}
                            projeto={projeto}
                            onOpen360={
                              openProjeto360
                            }
                            onEdit={
                              openEditProjeto
                            }
                            onUpdated={
                              loadProjetos
                            }
                          />
                        ))}

                      {projetosFiltrados.length ===
                        0 && (
                        <EmptyState text="Nenhum projeto encontrado para essa busca." />
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      </div>

      <Projeto360Modal
        projeto={projeto360}
        open={projeto360Open}
        onClose={closeProjeto360}
        onEdit={(projeto) => {
          closeProjeto360();
          openEditProjeto(projeto);
        }}
      />

      <ProjetoModal
        projeto={selectedProjeto}
        open={modalOpen}
        onClose={closeEditProjeto}
        onSaved={async () => {
          await loadProjetos();
          closeEditProjeto();
        }}
      />
    </main>
  );
}

/*
 * ================================================================
 * COMPONENTES — FASE 10
 * ================================================================
 */

function MiniMetric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: typeof Workflow;
}) {
  return (
    <div className="rounded-xl border border-white/[0.05] bg-black/10 p-3">
      <div className="flex items-center gap-1.5">
        <Icon
          size={11}
          className="text-slate-600"
        />

        <span className="text-[8px] uppercase tracking-[0.1em] text-slate-600">
          {label}
        </span>
      </div>

      <div className="mt-2 text-lg font-semibold text-slate-200">
        {value}
      </div>
    </div>
  );
}

function ExecutiveMetric({
  label,
  value,
  helper,
}: {
  label: string;
  value: number | string;
  helper: string;
}) {
  return (
    <div className="rounded-xl border border-white/[0.05] bg-black/10 p-3">
      <div className="text-[9px] uppercase tracking-[0.12em] text-slate-600">
        {label}
      </div>

      <div className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-white">
        {value}
      </div>

      <div className="mt-1 text-[8px] text-slate-700">
        {helper}
      </div>
    </div>
  );
}

function ExecutiveKpi({
  label,
  value,
  helper,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number | string;
  helper: string;
  icon: typeof Workflow;
  tone:
    | "sky"
    | "red"
    | "amber"
    | "violet"
    | "slate";
}) {
  const styles = {
    sky: {
      icon: "text-sky-300",
      bg: "bg-sky-400/[0.06]",
      border: "border-sky-400/[0.08]",
    },

    red: {
      icon: "text-red-300",
      bg: "bg-red-400/[0.06]",
      border: "border-red-400/[0.08]",
    },

    amber: {
      icon: "text-amber-300",
      bg: "bg-amber-400/[0.06]",
      border: "border-amber-400/[0.08]",
    },

    violet: {
      icon: "text-violet-300",
      bg: "bg-violet-400/[0.06]",
      border: "border-violet-400/[0.08]",
    },

    slate: {
      icon: "text-slate-400",
      bg: "bg-slate-400/[0.04]",
      border: "border-white/[0.06]",
    },
  }[tone];

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4 transition hover:bg-white/[0.035]">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[9px] uppercase tracking-[0.13em] text-slate-600">
            {label}
          </div>

          <div className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-white">
            {value}
          </div>
        </div>

        <div
          className={[
            "flex h-8 w-8 items-center justify-center rounded-lg border",
            styles.bg,
            styles.border,
          ].join(" ")}
        >
          <Icon
            size={14}
            className={styles.icon}
          />
        </div>
      </div>

      <div className="mt-2 text-[8px] text-slate-600">
        {helper}
      </div>
    </div>
  );
}

/*
 * ================================================================
 * COMPONENTES EXISTENTES
 * ================================================================
 */

function KpiCard({
  label,
  value,
  helper,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  helper: string;
  icon: typeof Layers3;
  accent:
    | "sky"
    | "emerald"
    | "violet"
    | "red";
}) {
  const styles = {
    sky: {
      icon: "text-sky-300",
      bg: "bg-sky-400/[0.07]",
      border: "border-sky-400/[0.08]",
    },

    emerald: {
      icon: "text-emerald-300",
      bg: "bg-emerald-400/[0.07]",
      border: "border-emerald-400/[0.08]",
    },

    violet: {
      icon: "text-violet-300",
      bg: "bg-violet-400/[0.07]",
      border: "border-violet-400/[0.08]",
    },

    red: {
      icon: "text-red-300",
      bg: "bg-red-400/[0.07]",
      border: "border-red-400/[0.08]",
    },
  }[accent];

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4 transition hover:bg-white/[0.035]">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.13em] text-slate-600">
            {label}
          </div>

          <div className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-white">
            {value}
          </div>
        </div>

        <div
          className={[
            "flex h-8 w-8 items-center justify-center rounded-lg border",
            styles.bg,
            styles.border,
          ].join(" ")}
        >
          <Icon
            size={15}
            className={styles.icon}
          />
        </div>
      </div>

      <div className="mt-2 text-[9px] text-slate-600">
        {helper}
      </div>
    </div>
  );
}

function ProjectRow({
  projeto,
  onOpen360,
  onEdit,
  onUpdated,
}: {
  projeto: Projeto;
  onOpen360: (projeto: Projeto) => void;
  onEdit: (projeto: Projeto) => void;
  onUpdated: () => void;
}) {
  const status = statusClass(
    projeto.status,
  );

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen360(projeto)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen360(projeto);
        }
      }}
      className="group flex cursor-pointer items-center gap-3 px-4 py-3.5 transition hover:bg-white/[0.02] sm:px-5"
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.025] text-[9px] font-semibold text-slate-400">
        {getInitials(
          projeto.cliente?.nome ??
            projeto.nome,
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-xs font-medium text-slate-300">
            {projeto.nome}
          </span>

          <span className="hidden rounded-full bg-white/[0.04] px-1.5 py-0.5 text-[8px] text-slate-600 sm:inline">
            {projeto.plataforma}
          </span>
        </div>

        <div className="mt-1 flex items-center gap-2 text-[9px] text-slate-600">
          <span>
            {projeto.etapa?.nome ??
              "Sem etapa"}
          </span>

          <span>•</span>

          <span>
            {projeto.responsavel_nome ??
              "Sem responsável"}
          </span>
        </div>
      </div>

      <div className="hidden w-[110px] sm:block">
        <div className="flex items-center justify-between text-[8px] text-slate-600">
          <span>Progresso</span>
          <span>{projeto.percentual}%</span>
        </div>

        <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/[0.04]">
          <div
            className="h-full rounded-full bg-sky-400/60"
            style={{
              width: `${projeto.percentual}%`,
            }}
          />
        </div>
      </div>

      <div className="hidden w-[85px] text-right md:block">
        <div className="text-[9px] text-slate-600">
          {formatDate(
            projeto.data_fim,
          )}
        </div>

        <div className="mt-0.5 text-[8px] text-slate-700">
          {relativeDate(
            projeto.data_fim,
          )}
        </div>
      </div>

      <div className="flex w-[105px] items-center gap-1.5">
        <span
          className={[
            "h-1.5 w-1.5 shrink-0 rounded-full",
            status.dot,
          ].join(" ")}
        />

        <span
          className={[
            "truncate text-[9px]",
            status.text,
          ].join(" ")}
        >
          {status.label}
        </span>
      </div>

      <div
        className="shrink-0 opacity-0 transition group-hover:opacity-100"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
      >
        <ProjetoActions
          projetoId={projeto.id}
          status={
            projeto.status as Parameters<
              typeof ProjetoActions
            >[0]["status"]
          }
          onEdit={() => onEdit(projeto)}
          onUpdated={onUpdated}
        />
      </div>
    </div>
  );
}

function AlertRow({
  projeto,
}: {
  projeto: Projeto;
}) {
  const isBlocked =
    projeto.status === "Bloqueado";

  return (
    <div className="px-4 py-4 sm:px-5">
      <div className="flex items-start gap-3">
        <div
          className={[
            "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
            isBlocked
              ? "bg-red-400/[0.07]"
              : "bg-amber-400/[0.07]",
          ].join(" ")}
        >
          <AlertTriangle
            size={13}
            className={
              isBlocked
                ? "text-red-300"
                : "text-amber-300"
            }
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-xs font-medium text-slate-300">
              {projeto.nome}
            </span>

            <span className="shrink-0 text-[8px] uppercase tracking-[0.12em] text-red-300/70">
              {projeto.prioridade}
            </span>
          </div>

          <div className="mt-1 text-[9px] leading-4 text-slate-600">
            {projeto.observacoes ||
              projeto.status}
          </div>

          <div className="mt-2 flex items-center gap-2 text-[8px] text-slate-700">
            <span>
              {projeto.responsavel_nome ||
                "Sem responsável"}
            </span>

            <span>•</span>

            <span>
              {projeto.etapa?.nome ??
                "Sem etapa"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyState({
  text,
}: {
  text: string;
}) {
  return (
    <div className="flex min-h-[100px] items-center justify-center px-5 text-center text-[10px] text-slate-700">
      {text}
    </div>
  );
}