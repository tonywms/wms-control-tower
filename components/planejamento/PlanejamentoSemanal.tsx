"use client";

import {
  AlertTriangle,
  Archive,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  RefreshCw,
  ShieldAlert,
  Target,
  TrendingDown,
  TrendingUp,
  Minus,
  UserRound,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type Acao = {
  id: string;
  projeto_id: string;
  titulo: string;
  descricao: string | null;
  prioridade: string;
  status: string;
  prazo: string | null;
  responsavel_id: string | null;
  responsavel?: { id: string; nome: string } | null;
  projeto?: {
    id: string;
    nome: string;
    setor: string | null;
    status: string;
    prioridade: string;
  } | null;
};

type SemanaHistorico = {
  id:string; inicio_semana:string; fim_semana:string; status_fechamento:"Parcial"|"Fechada";
  planejadas:number; concluidas:number; pendentes:number; atrasadas:number;
  percentual_execucao:number; percentual_risco:number; registrado_por_nome:string|null; registrado_em:string;
  responsaveis?:ResponsavelHistorico[];
};

type ResponsavelHistorico = {
  nome:string;
  planejadas:number;
  concluidas:number;
  pendentes:number;
  atrasadas:number;
  percentual:number;
};

type Inconsistencia = {
  id: string;
  projeto_id: string;
  projeto_nome: string;
  severidade: "Crítico" | "Atenção";
  titulo: string;
};

type Props = {
  onOpenProjeto: (projetoId: string) => void | Promise<void>;
};

const FECHADAS = new Set(["Concluída", "Cancelada"]);

function localDate(v: string) {
  const [a, m, d] = v.split("-").map(Number);
  return new Date(a, m - 1, d);
}

function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function br(v: string | null) {
  if (!v) return "Sem prazo";
  const [a, m, d] = v.split("-");
  return `${d}/${m}/${a}`;
}

function semanaUtil() {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const dia = hoje.getDay();
  const inicio = new Date(hoje);
  if (dia === 0) inicio.setDate(hoje.getDate() + 1);
  else if (dia === 6) inicio.setDate(hoje.getDate() + 2);
  else inicio.setDate(hoje.getDate() - (dia - 1));
  const fim = new Date(inicio);
  fim.setDate(inicio.getDate() + 4);
  return { inicio, fim, hoje };
}

function prioridadePeso(v: string) {
  if (v === "Crítica") return 4;
  if (v === "Alta") return 3;
  if (v === "Normal") return 2;
  return 1;
}

type ClassificacaoExecucao = "URGENTE" | "ALTA" | "ATENÇÃO" | "NORMAL";

function classificarExecucao(a: Acao, hoje: string, inicio: string, fim: string, riscos: number): ClassificacaoExecucao {
  const vencida = !!a.prazo && a.prazo < hoje;
  const naSemana = !!a.prazo && a.prazo >= inicio && a.prazo <= fim;
  if ((vencida && riscos > 0) || a.prioridade === "Crítica") return "URGENTE";
  if (naSemana || a.prioridade === "Alta") return "ALTA";
  if (!a.prazo) return "ATENÇÃO";
  return "NORMAL";
}

function pesoClassificacao(v: ClassificacaoExecucao) {
  return v === "URGENTE" ? 4 : v === "ALTA" ? 3 : v === "ATENÇÃO" ? 2 : 1;
}

function estiloClassificacao(v: ClassificacaoExecucao) {
  if (v === "URGENTE") return { barra:"bg-red-400", badge:"border-red-400/15 bg-red-400/[.08] text-red-300" };
  if (v === "ALTA") return { barra:"bg-amber-400", badge:"border-amber-400/15 bg-amber-400/[.08] text-amber-300" };
  if (v === "ATENÇÃO") return { barra:"bg-violet-400", badge:"border-violet-400/15 bg-violet-400/[.08] text-violet-300" };
  return { barra:"bg-sky-400", badge:"border-sky-400/15 bg-sky-400/[.08] text-sky-300" };
}

export default function PlanejamentoSemanal({ onOpenProjeto }: Props) {
  const [acoes, setAcoes] = useState<Acao[]>([]);
  const [inconsistencias, setInconsistencias] = useState<Inconsistencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [concluindo, setConcluindo] = useState<string | null>(null);
  const [historico, setHistorico] = useState<SemanaHistorico[]>([]);
  const [registrandoSemana, setRegistrandoSemana] = useState(false);
  const [filtro, setFiltro] = useState<"Todos" | "Semana" | "Vencidos" | "Sem prazo">("Todos");

  const carregar = useCallback(async () => {
    try {
      setLoading(true);
      setErro("");
      const [a, i, h] = await Promise.all([
        fetch("/api/agenda/executiva", { cache: "no-store" }),
        fetch("/api/inconsistencias", { cache: "no-store" }),
        fetch("/api/plano-semana/historico", { cache: "no-store" }),
      ]);
      const [aj, ij, hj] = await Promise.all([a.json(), i.json(), h.json()]);
      if (!a.ok || !aj?.success) throw new Error(aj?.error || "Erro ao carregar ações.");
      if (!i.ok || !ij?.success) throw new Error(ij?.error || "Erro ao carregar riscos da semana.");
      if (!h.ok || !hj?.success) throw new Error(hj?.error || "Erro ao carregar histórico semanal.");
      setAcoes(aj.acoes ?? []);
      setInconsistencias(ij.inconsistencias ?? []);
      setHistorico(hj.semanas ?? []);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao montar o plano da semana.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void carregar(); }, [carregar]);

  async function concluirAcao(a: Acao) {
    try {
      setConcluindo(a.id);
      setErro("");
      setSucesso("");

      const r = await fetch(`/api/projetos/${a.projeto_id}/acoes/${a.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Concluída" }),
      });

      const j = await r.json();
      if (!r.ok || !j?.success) {
        throw new Error(j?.error || "Não foi possível concluir a ação.");
      }

      setSucesso(`Ação "${a.titulo}" concluída com sucesso.`);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao concluir ação.");
    } finally {
      setConcluindo(null);
    }
  }

  const { inicio, fim, hoje } = useMemo(() => semanaUtil(), []);
  const inicioIso = iso(inicio);
  const fimIso = iso(fim);
  const hojeIso = iso(hoje);

  async function registrarSemana() {
    try {
      setRegistrandoSemana(true); setErro(""); setSucesso("");
      const r=await fetch("/api/plano-semana/historico",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({inicio:inicioIso,fim:fimIso})});
      const j=await r.json();
      if(!r.ok||!j?.success) throw new Error(j?.error||"Não foi possível registrar a semana.");
      setSucesso(j.message||"Semana registrada no histórico.");
      await carregar();
    } catch(e) {
      setErro(e instanceof Error?e.message:"Erro ao registrar semana.");
    } finally { setRegistrandoSemana(false); }
  }

  const abertas = useMemo(() => acoes.filter((a) => !FECHADAS.has(a.status)), [acoes]);
  const vencidas = useMemo(() => abertas.filter((a) => a.prazo && a.prazo < hojeIso), [abertas, hojeIso]);
  const daSemana = useMemo(() => abertas.filter((a) => a.prazo && a.prazo >= inicioIso && a.prazo <= fimIso), [abertas, inicioIso, fimIso]);
  const semPrazo = useMemo(() => abertas.filter((a) => !a.prazo), [abertas]);
  const criticas = useMemo(() => abertas.filter((a) => a.prioridade === "Crítica"), [abertas]);

  // Execução semanal usa TODAS as ações com prazo dentro da janela,
  // inclusive as já concluídas. Assim uma conclusão não apaga o planejado da semana.
  const planejadasSemana = useMemo(
    () => acoes.filter((a) => a.prazo && a.prazo >= inicioIso && a.prazo <= fimIso && a.status !== "Cancelada"),
    [acoes, inicioIso, fimIso],
  );
  const concluidasSemana = useMemo(
    () => planejadasSemana.filter((a) => a.status === "Concluída"),
    [planejadasSemana],
  );
  const pendentesSemana = useMemo(
    () => planejadasSemana.filter((a) => !FECHADAS.has(a.status)),
    [planejadasSemana],
  );
  const atrasadasSemana = useMemo(
    () => pendentesSemana.filter((a) => a.prazo && a.prazo < hojeIso),
    [pendentesSemana, hojeIso],
  );
  const percentualExecucao = planejadasSemana.length
    ? Math.round((concluidasSemana.length / planejadasSemana.length) * 100)
    : 0;

  const diasRestantesSemana = useMemo(() => {
    const hoje = new Date(`${hojeIso}T12:00:00`);
    const fim = new Date(`${fimIso}T12:00:00`);
    return Math.max(0, Math.ceil((fim.getTime() - hoje.getTime()) / 86400000));
  }, [hojeIso, fimIso]);

  const entregasNecessariasPorDia = diasRestantesSemana > 0
    ? Math.ceil(pendentesSemana.length / diasRestantesSemana)
    : pendentesSemana.length;

  const percentualRiscoSemana = planejadasSemana.length
    ? Math.round((atrasadasSemana.length / planejadasSemana.length) * 100)
    : 0;

  const statusSemana =
    percentualExecucao >= 80 && atrasadasSemana.length === 0
      ? { label: "Controlada", tone: "emerald" as const }
      : percentualRiscoSemana >= 50 || atrasadasSemana.length >= 5
        ? { label: "Crítica", tone: "red" as const }
        : percentualRiscoSemana >= 25 || atrasadasSemana.length > 0
          ? { label: "Atenção", tone: "amber" as const }
          : { label: "Saudável", tone: "sky" as const };

  const desempenhoResponsavel = useMemo(() => {
    const mapa = new Map<string, { planejadas: number; concluidas: number; pendentes: number; atrasadas: number }>();

    planejadasSemana.forEach((a) => {
      const nome = a.responsavel?.nome || "Sem responsável";
      const atual = mapa.get(nome) ?? { planejadas: 0, concluidas: 0, pendentes: 0, atrasadas: 0 };
      atual.planejadas += 1;

      if (a.status === "Concluída") {
        atual.concluidas += 1;
      } else if (a.status !== "Cancelada") {
        atual.pendentes += 1;
        if (a.prazo && a.prazo < hojeIso) atual.atrasadas += 1;
      }

      mapa.set(nome, atual);
    });

    return [...mapa.entries()]
      .map(([nome, dados]) => ({
        nome,
        ...dados,
        percentual: dados.planejadas ? Math.round((dados.concluidas / dados.planejadas) * 100) : 0,
      }))
      .sort((a, b) => b.planejadas - a.planejadas || b.percentual - a.percentual);
  }, [planejadasSemana, hojeIso]);

  const riscoPorProjeto = useMemo(() => {
    const mapa = new Map<string, { criticos: number; atencao: number }>();
    inconsistencias.forEach((i) => {
      const x = mapa.get(i.projeto_id) ?? { criticos: 0, atencao: 0 };
      if (i.severidade === "Crítico") x.criticos += 1;
      else x.atencao += 1;
      mapa.set(i.projeto_id, x);
    });
    return mapa;
  }, [inconsistencias]);

  const base = useMemo(() => {
    if (filtro === "Semana") return daSemana;
    if (filtro === "Vencidos") return vencidas;
    if (filtro === "Sem prazo") return semPrazo;
    const ids = new Set<string>();
    return [...vencidas, ...daSemana, ...semPrazo].filter((a) => {
      if (ids.has(a.id)) return false;
      ids.add(a.id);
      return true;
    });
  }, [filtro, daSemana, vencidas, semPrazo]);

  const ordenadas = useMemo(() => [...base].sort((a, b) => {
    const ar = riscoPorProjeto.get(a.projeto_id)?.criticos ?? 0;
    const brisco = riscoPorProjeto.get(b.projeto_id)?.criticos ?? 0;
    const ca = classificarExecucao(a, hojeIso, inicioIso, fimIso, ar);
    const cb = classificarExecucao(b, hojeIso, inicioIso, fimIso, brisco);
    const pe = pesoClassificacao(cb) - pesoClassificacao(ca);
    if (pe) return pe;
    const av = a.prazo && a.prazo < hojeIso ? 1 : 0;
    const bv = b.prazo && b.prazo < hojeIso ? 1 : 0;
    if (av !== bv) return bv - av;
    if (ar !== brisco) return brisco - ar;
    const p = prioridadePeso(b.prioridade) - prioridadePeso(a.prioridade);
    if (p) return p;
    return (a.prazo ?? "9999-12-31").localeCompare(b.prazo ?? "9999-12-31");
  }), [base, hojeIso, inicioIso, fimIso, riscoPorProjeto]);

  const porResponsavel = useMemo(() => {
    const m = new Map<string, number>();
    ordenadas.forEach((a) => {
      const n = a.responsavel?.nome || "Sem responsável";
      m.set(n, (m.get(n) ?? 0) + 1);
    });
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [ordenadas]);

  const janela = `${String(inicio.getDate()).padStart(2, "0")}/${String(inicio.getMonth() + 1).padStart(2, "0")} — ${String(fim.getDate()).padStart(2, "0")}/${String(fim.getMonth() + 1).padStart(2, "0")}`;

  const historicoOrdenado = useMemo(
    () => [...historico].sort((a,b)=>a.inicio_semana.localeCompare(b.inicio_semana)),
    [historico],
  );
  const semanaAtualHistorico = historicoOrdenado.at(-1) ?? null;
  const semanaAnteriorHistorico = historicoOrdenado.length > 1 ? historicoOrdenado.at(-2) ?? null : null;
  const deltaExecucao = semanaAtualHistorico && semanaAnteriorHistorico
    ? semanaAtualHistorico.percentual_execucao - semanaAnteriorHistorico.percentual_execucao
    : null;
  const deltaRisco = semanaAtualHistorico && semanaAnteriorHistorico
    ? semanaAtualHistorico.percentual_risco - semanaAnteriorHistorico.percentual_risco
    : null;

  const rankingHistoricoResponsaveis = useMemo(() => {
    const mapa = new Map<string,{nome:string;planejadas:number;concluidas:number;pendentes:number;atrasadas:number;semanas:number}>();
    for (const semana of historicoOrdenado) {
      for (const r of semana.responsaveis ?? []) {
        const atual = mapa.get(r.nome) ?? {nome:r.nome,planejadas:0,concluidas:0,pendentes:0,atrasadas:0,semanas:0};
        atual.planejadas += Number(r.planejadas||0);
        atual.concluidas += Number(r.concluidas||0);
        atual.pendentes += Number(r.pendentes||0);
        atual.atrasadas += Number(r.atrasadas||0);
        atual.semanas += 1;
        mapa.set(r.nome, atual);
      }
    }
    return [...mapa.values()].map(r=>({
      ...r,
      percentual:r.planejadas?Math.round((r.concluidas/r.planejadas)*100):0,
    })).sort((a,b)=>b.percentual-a.percentual || b.concluidas-a.concluidas || a.nome.localeCompare(b.nome));
  },[historicoOrdenado]);

  const mediaExecucaoHistorica = historicoOrdenado.length
    ? Math.round(historicoOrdenado.reduce((acc,s)=>acc+Number(s.percentual_execucao||0),0)/historicoOrdenado.length)
    : 0;
  const mediaRiscoHistorica = historicoOrdenado.length
    ? Math.round(historicoOrdenado.reduce((acc,s)=>acc+Number(s.percentual_risco||0),0)/historicoOrdenado.length)
    : 0;

  const forecastSemanal = useMemo(() => {
    const planejadas = planejadasSemana.length;
    const concluidas = concluidasSemana.length;
    const pendentes = pendentesSemana.length;

    const inicioData = new Date(`${inicioIso}T12:00:00`);
    const fimData = new Date(`${fimIso}T12:00:00`);
    const referencia = new Date(`${hojeIso}T12:00:00`);

    const contarUteis = (a: Date, b: Date) => {
      if (b < a) return 0;
      let total = 0;
      const cursor = new Date(a);
      while (cursor <= b) {
        const dia = cursor.getDay();
        if (dia !== 0 && dia !== 6) total += 1;
        cursor.setDate(cursor.getDate() + 1);
      }
      return total;
    };

    const totalDias = Math.max(1, contarUteis(inicioData, fimData));
    const fimDecorrido =
      referencia < inicioData ? inicioData :
      referencia > fimData ? fimData :
      referencia;

    const diasDecorridos =
      referencia < inicioData ? 0 : Math.max(1, contarUteis(inicioData, fimDecorrido));

    const diasRestantes = Math.max(0, totalDias - diasDecorridos);
    const ritmoRealizado = diasDecorridos > 0 ? concluidas / diasDecorridos : 0;
    const ritmoNecessario =
      diasRestantes > 0 ? pendentes / diasRestantes : pendentes > 0 ? pendentes : 0;

    const entregasProjetadas = Math.min(
      planejadas,
      Math.round(concluidas + ritmoRealizado * diasRestantes),
    );

    const percentualProjetado =
      planejadas > 0
        ? Math.min(100, Math.round((entregasProjetadas / planejadas) * 100))
        : 0;

    const deficitProjetado = Math.max(0, planejadas - entregasProjetadas);
    const coberturaRitmo =
      ritmoNecessario > 0 ? ritmoRealizado / ritmoNecessario : 1;

    let classificacao = "No ritmo";
    let probabilidade = "Alta";

    if (percentualProjetado < 50 || coberturaRitmo < 0.5) {
      classificacao = "Meta improvável";
      probabilidade = "Baixa";
    } else if (percentualProjetado < 75 || coberturaRitmo < 0.75) {
      classificacao = "Meta em risco";
      probabilidade = "Baixa";
    } else if (percentualProjetado < 100 || coberturaRitmo < 1) {
      classificacao = "Recuperação necessária";
      probabilidade = "Média";
    }

    return {
      planejadas,
      concluidas,
      pendentes,
      totalDias,
      diasDecorridos,
      diasRestantes,
      ritmoRealizado,
      ritmoNecessario,
      entregasProjetadas,
      percentualProjetado,
      deficitProjetado,
      classificacao,
      probabilidade,
      coberturaRitmo,
    };
  }, [
    planejadasSemana,
    concluidasSemana,
    pendentesSemana,
    inicioIso,
    fimIso,
    hojeIso,
  ]);

  const planoRecuperacao = useMemo(() => {
    const pendentes = pendentesSemana.length;
    const dias = Math.max(0, forecastSemanal.diasRestantes);
    const ritmoAtual = forecastSemanal.ritmoRealizado;
    const ritmoNecessario = forecastSemanal.ritmoNecessario;
    const gapDiario = Math.max(0, ritmoNecessario - ritmoAtual);
    const metaDiaria = dias > 0 ? Math.ceil(pendentes / dias) : pendentes;
    const capacidadeProjetada = Math.max(0, Math.round(ritmoAtual * dias));
    const recuperacaoNecessaria = Math.max(0, pendentes - capacidadeProjetada);

    const responsaveis = desempenhoResponsavel
      .filter((r) => r.pendentes > 0)
      .map((r) => ({
        ...r,
        pressao: Math.round(r.atrasadas * 3 + r.pendentes * 2 + Math.max(0, 100 - r.percentual) / 20),
        metaRecuperacao: dias > 0 ? Math.max(1, Math.ceil(r.pendentes / dias)) : r.pendentes,
      }))
      .sort((a, b) => b.pressao - a.pressao || b.atrasadas - a.atrasadas || b.pendentes - a.pendentes);

    const acoesPrioritarias = [...pendentesSemana]
      .sort((a, b) => {
        const ar = riscoPorProjeto.get(a.projeto_id)?.criticos ?? 0;
        const brisco = riscoPorProjeto.get(b.projeto_id)?.criticos ?? 0;
        const av = a.prazo && a.prazo < hojeIso ? 1 : 0;
        const bv = b.prazo && b.prazo < hojeIso ? 1 : 0;
        if (av !== bv) return bv - av;
        if (ar !== brisco) return brisco - ar;
        const p = prioridadePeso(b.prioridade) - prioridadePeso(a.prioridade);
        if (p) return p;
        return (a.prazo ?? "9999-12-31").localeCompare(b.prazo ?? "9999-12-31");
      })
      .slice(0, 5);

    const nivel =
      recuperacaoNecessaria === 0
        ? "Controlado"
        : gapDiario >= 3 || forecastSemanal.coberturaRitmo < 0.35
          ? "Crítico"
          : gapDiario >= 1 || forecastSemanal.coberturaRitmo < 0.75
            ? "Recuperação forte"
            : "Recuperação moderada";

    return { pendentes, dias, ritmoAtual, ritmoNecessario, gapDiario, metaDiaria, capacidadeProjetada, recuperacaoNecessaria, responsaveis, acoesPrioritarias, nivel };
  }, [pendentesSemana, forecastSemanal, desempenhoResponsavel, riscoPorProjeto, hojeIso]);

  return (
    <div className="mt-5 space-y-4">
      <section className="rounded-3xl border border-sky-400/15 bg-gradient-to-br from-sky-400/[.07] via-white/[.025] to-violet-500/[.045] p-5 sm:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.18em] text-sky-300"><Target size={14}/>Execução semanal</div>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-.04em] text-white">Plano da Semana</h2>
            <p className="mt-2 text-xs text-slate-500">O que precisa acontecer, quem responde e quais riscos ameaçam a entrega.</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="rounded-xl border border-white/[.06] bg-black/20 px-4 py-2.5"><div className="text-[8px] uppercase tracking-[.14em] text-slate-600">Janela operacional</div><div className="mt-1 text-xs font-medium text-slate-300">{janela}</div></div>
            <button onClick={() => void carregar()} disabled={loading} className="flex h-10 items-center gap-2 rounded-xl border border-sky-400/15 bg-sky-400/[.07] px-4 text-xs text-sky-200"><RefreshCw size={14} className={loading ? "animate-spin" : ""}/>Atualizar</button>
          </div>
        </div>
      </section>

      {erro && <div className="flex items-center gap-2 rounded-xl border border-red-400/15 bg-red-400/[.05] p-3 text-xs text-red-200"><AlertTriangle size={15}/>{erro}</div>}

      {sucesso && <div className="flex items-center gap-2 rounded-xl border border-emerald-400/15 bg-emerald-400/[.05] p-3 text-xs text-emerald-200"><Check size={15}/>{sucesso}</div>}

      <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Kpi icon={CalendarDays} label="Na semana" value={daSemana.length} tone="sky" />
        <Kpi icon={Clock3} label="Vencidas" value={vencidas.length} tone="red" />
        <Kpi icon={AlertTriangle} label="Sem prazo" value={semPrazo.length} tone="amber" />
        <Kpi icon={ShieldAlert} label="Críticas" value={criticas.length} tone="red" />
        <Kpi icon={CheckCircle2} label="Abertas" value={abertas.length} tone="violet" />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <div className="rounded-3xl border border-sky-400/10 bg-gradient-to-br from-sky-400/[.045] via-white/[.018] to-emerald-400/[.025] p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[.15em] text-sky-300">
                <BarChart3 size={13}/>Execução da semana
              </div>
              <div className="mt-1 text-sm font-semibold text-white">Planejado × realizado</div>
              <p className="mt-1 text-[10px] text-slate-500">Ações com prazo dentro da janela {janela}, incluindo as já concluídas.</p>
            </div>
            <div className="text-left sm:text-right">
              <div className="text-3xl font-semibold tracking-[-.04em] text-white">{percentualExecucao}%</div>
              <div className="text-[8px] uppercase tracking-[.14em] text-slate-600">execução semanal</div>
            </div>
          </div>

          <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/[.045]">
            <div className="h-full rounded-full bg-emerald-400/70 transition-all" style={{width:`${Math.min(100,percentualExecucao)}%`}}/>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <MiniKpi label="Planejadas" value={planejadasSemana.length} tone="sky"/>
            <MiniKpi label="Concluídas" value={concluidasSemana.length} tone="emerald"/>
            <MiniKpi label="Pendentes" value={pendentesSemana.length} tone="violet"/>
            <MiniKpi label="Atrasadas" value={atrasadasSemana.length} tone="red"/>
          </div>

          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[9px] text-slate-500">
            <span><b className="font-semibold text-emerald-300">{concluidasSemana.length}</b> entrega(s) realizada(s)</span>
            <span><b className="font-semibold text-slate-300">{pendentesSemana.length}</b> ainda pendente(s)</span>
            <span><b className="font-semibold text-red-300">{atrasadasSemana.length}</b> exigem recuperação</span>
          </div>
        </div>

        <aside className="rounded-3xl border border-white/[.06] bg-white/[.02] p-5">
          <div className="text-[9px] font-semibold uppercase tracking-[.15em] text-slate-600">Desempenho semanal</div>
          <div className="mt-1 text-sm font-semibold text-white">Execução por responsável</div>

          <div className="mt-4 space-y-4">
            {desempenhoResponsavel.length === 0 && (
              <div className="rounded-xl border border-white/[.05] bg-black/10 p-3 text-[10px] text-slate-500">Nenhuma ação planejada para a janela.</div>
            )}
            {desempenhoResponsavel.slice(0,8).map((r) => (
              <div key={r.nome}>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-[10px] font-medium text-slate-300">{r.nome}</div>
                    <div className="mt-0.5 text-[8px] text-slate-600">{r.concluidas}/{r.planejadas} concluída(s) · {r.atrasadas} atrasada(s)</div>
                  </div>
                  <div className={`text-xs font-semibold ${r.percentual>=80?"text-emerald-300":r.percentual>=50?"text-sky-300":r.percentual>0?"text-amber-300":"text-slate-500"}`}>{r.percentual}%</div>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[.04]">
                  <div className="h-full rounded-full bg-emerald-400/60" style={{width:`${Math.max(r.percentual>0?5:0,Math.min(100,r.percentual))}%`}}/>
                </div>
              </div>
            ))}
          </div>
        </aside>
      </section>

      <section className="grid gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-white/[.06] bg-white/[.018] p-4">
          <div className="text-[8px] font-semibold uppercase tracking-[.13em] text-slate-600">Status da semana</div>
          <div className={`mt-2 text-xl font-semibold ${statusSemana.tone==="red"?"text-red-300":statusSemana.tone==="amber"?"text-amber-300":statusSemana.tone==="emerald"?"text-emerald-300":"text-sky-300"}`}>{statusSemana.label}</div>
          <div className="mt-1 text-[9px] text-slate-600">{percentualRiscoSemana}% do plano está atrasado</div>
        </div>

        <div className="rounded-2xl border border-white/[.06] bg-white/[.018] p-4">
          <div className="text-[8px] font-semibold uppercase tracking-[.13em] text-slate-600">Dias restantes</div>
          <div className="mt-2 text-xl font-semibold text-white">{diasRestantesSemana}</div>
          <div className="mt-1 text-[9px] text-slate-600">até o fim da janela operacional</div>
        </div>

        <div className="rounded-2xl border border-white/[.06] bg-white/[.018] p-4">
          <div className="text-[8px] font-semibold uppercase tracking-[.13em] text-slate-600">Ritmo necessário</div>
          <div className="mt-2 flex items-center gap-1.5 text-xl font-semibold text-violet-300">{entregasNecessariasPorDia}<ArrowUpRight size={15}/></div>
          <div className="mt-1 text-[9px] text-slate-600">entrega(s) por dia para zerar pendências</div>
        </div>

        <div className="rounded-2xl border border-white/[.06] bg-white/[.018] p-4">
          <div className="text-[8px] font-semibold uppercase tracking-[.13em] text-slate-600">Gap de execução</div>
          <div className="mt-2 text-xl font-semibold text-amber-300">{Math.max(0,100-percentualExecucao)}%</div>
          <div className="mt-1 text-[9px] text-slate-600">restante para concluir o plano semanal</div>
        </div>
      </section>

      
      <section className="rounded-3xl border border-cyan-400/15 bg-gradient-to-br from-cyan-400/[.045] via-white/[.018] to-violet-400/[.04] p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[.15em] text-cyan-300"><TrendingUp size={13}/>Forecast executivo</div>
            <div className="mt-1 text-sm font-semibold text-white">Projeção de fechamento da semana</div>
            <p className="mt-1 text-[10px] text-slate-500">Estimativa pelo ritmo realizado versus o ritmo necessário para zerar o plano dentro da janela operacional.</p>
          </div>
          <div className={`min-w-[190px] rounded-2xl border px-4 py-3 ${forecastSemanal.classificacao==="No ritmo"?"border-emerald-400/20 bg-emerald-400/[.06]":forecastSemanal.classificacao==="Recuperação necessária"?"border-amber-400/20 bg-amber-400/[.06]":"border-red-400/20 bg-red-400/[.06]"}`}>
            <div className="text-[8px] font-semibold uppercase tracking-[.14em] text-slate-500">Projeção de fechamento</div>
            <div className="mt-1 flex items-end justify-between gap-3">
              <div className={`text-3xl font-semibold ${forecastSemanal.percentualProjetado>=100?"text-emerald-300":forecastSemanal.percentualProjetado>=75?"text-amber-300":"text-red-300"}`}>{forecastSemanal.percentualProjetado}%</div>
              <div className="pb-1 text-right text-[9px] text-slate-400">{forecastSemanal.entregasProjetadas}/{forecastSemanal.planejadas}<br/>entregas</div>
            </div>
            <div className="mt-2 text-[9px] font-semibold text-white">{forecastSemanal.classificacao}</div>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-2xl border border-white/[.055] bg-black/15 p-4"><div className="text-[8px] uppercase tracking-[.12em] text-slate-600">Ritmo realizado</div><div className="mt-2 text-xl font-semibold text-sky-300">{forecastSemanal.ritmoRealizado.toFixed(1)}</div><div className="mt-1 text-[8px] text-slate-500">entrega(s) / dia útil</div></div>
          <div className="rounded-2xl border border-white/[.055] bg-black/15 p-4"><div className="text-[8px] uppercase tracking-[.12em] text-slate-600">Ritmo necessário</div><div className="mt-2 text-xl font-semibold text-violet-300">{forecastSemanal.ritmoNecessario.toFixed(1)}</div><div className="mt-1 text-[8px] text-slate-500">entrega(s) / dia restante</div></div>
          <div className="rounded-2xl border border-white/[.055] bg-black/15 p-4"><div className="text-[8px] uppercase tracking-[.12em] text-slate-600">Dias úteis restantes</div><div className="mt-2 text-xl font-semibold text-white">{forecastSemanal.diasRestantes}</div><div className="mt-1 text-[8px] text-slate-500">{forecastSemanal.diasDecorridos} de {forecastSemanal.totalDias} transcorrido(s)</div></div>
          <div className="rounded-2xl border border-white/[.055] bg-black/15 p-4"><div className="text-[8px] uppercase tracking-[.12em] text-slate-600">Déficit projetado</div><div className={`mt-2 text-xl font-semibold ${forecastSemanal.deficitProjetado===0?"text-emerald-300":"text-red-300"}`}>{forecastSemanal.deficitProjetado}</div><div className="mt-1 text-[8px] text-slate-500">entrega(s) podem ficar pendentes</div></div>
          <div className="rounded-2xl border border-white/[.055] bg-black/15 p-4"><div className="text-[8px] uppercase tracking-[.12em] text-slate-600">Probabilidade operacional</div><div className={`mt-2 text-xl font-semibold ${forecastSemanal.probabilidade==="Alta"?"text-emerald-300":forecastSemanal.probabilidade==="Média"?"text-amber-300":"text-red-300"}`}>{forecastSemanal.probabilidade}</div><div className="mt-1 text-[8px] text-slate-500">de concluir o plano no ritmo atual</div></div>
        </div>

        <div className="mt-4 rounded-2xl border border-white/[.05] bg-black/15 p-4">
          <div className="flex items-center justify-between gap-4">
            <div><div className="text-[9px] font-semibold text-white">Cobertura do ritmo necessário</div><div className="mt-1 text-[8px] text-slate-500">O ritmo atual cobre {Math.round(Math.min(1,forecastSemanal.coberturaRitmo)*100)}% do ritmo necessário para zerar as pendências.</div></div>
            <div className={`text-lg font-semibold ${forecastSemanal.coberturaRitmo>=1?"text-emerald-300":forecastSemanal.coberturaRitmo>=.75?"text-amber-300":"text-red-300"}`}>{Math.round(forecastSemanal.coberturaRitmo*100)}%</div>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[.04]"><div className={`h-full rounded-full ${forecastSemanal.coberturaRitmo>=1?"bg-emerald-400/70":forecastSemanal.coberturaRitmo>=.75?"bg-amber-400/70":"bg-red-400/70"}`} style={{width:`${Math.min(100,Math.round(forecastSemanal.coberturaRitmo*100))}%`}}/></div>
        </div>
      </section>


      <section className="rounded-3xl border border-amber-400/15 bg-gradient-to-br from-amber-400/[.045] via-white/[.018] to-red-400/[.04] p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[.15em] text-amber-300"><ShieldAlert size={13}/>Plano de recuperação automático</div>
            <div className="mt-1 text-sm font-semibold text-white">Ritmo necessário para recuperar a semana</div>
            <p className="mt-1 text-[10px] text-slate-500">Calculado pelas pendências, dias úteis restantes, ritmo realizado, atrasos e pressão por responsável.</p>
          </div>
          <div className={`min-w-[190px] rounded-2xl border px-4 py-3 ${planoRecuperacao.nivel==="Controlado"?"border-emerald-400/20 bg-emerald-400/[.06]":planoRecuperacao.nivel==="Crítico"?"border-red-400/20 bg-red-400/[.06]":"border-amber-400/20 bg-amber-400/[.06]"}`}>
            <div className="text-[8px] font-semibold uppercase tracking-[.14em] text-slate-500">Situação da recuperação</div>
            <div className={`mt-1 text-xl font-semibold ${planoRecuperacao.nivel==="Controlado"?"text-emerald-300":planoRecuperacao.nivel==="Crítico"?"text-red-300":"text-amber-300"}`}>{planoRecuperacao.nivel}</div>
            <div className="mt-1 text-[8px] text-slate-500">{planoRecuperacao.recuperacaoNecessaria} entrega(s) acima da capacidade projetada</div>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <MiniKpi label="Pendentes" value={planoRecuperacao.pendentes} tone="violet"/>
          <MiniKpi label="Dias restantes" value={planoRecuperacao.dias} tone="sky"/>
          <MiniKpi label="Meta / dia" value={planoRecuperacao.metaDiaria} tone="amber"/>
          <MiniKpi label="Capacidade projetada" value={planoRecuperacao.capacidadeProjetada} tone="emerald"/>
          <MiniKpi label="Gap diário" value={planoRecuperacao.gapDiario.toFixed(1)} tone="red"/>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[.85fr_1.15fr]">
          <div className="rounded-2xl border border-white/[.055] bg-black/15 p-4">
            <div className="text-[8px] font-semibold uppercase tracking-[.12em] text-slate-500">Pressão por responsável</div>
            <div className="mt-1 text-[10px] text-slate-500">Quem precisa acelerar para recuperar o plano.</div>
            <div className="mt-4 space-y-2">
              {planoRecuperacao.responsaveis.length===0&&<div className="rounded-xl border border-emerald-400/10 bg-emerald-400/[.03] p-3 text-[9px] text-emerald-300">Não há pendências distribuídas para recuperação.</div>}
              {planoRecuperacao.responsaveis.slice(0,6).map((r,index)=>(
                <div key={`recovery-${r.nome}`} className="rounded-xl border border-white/[.045] bg-white/[.018] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[10px] font-semibold text-slate-200">#{index+1} · {r.nome}</div>
                      <div className="mt-1 text-[8px] text-slate-600">{r.pendentes} pendente(s) · {r.atrasadas} atrasada(s)</div>
                    </div>
                    <div className="text-right"><div className="text-sm font-semibold text-amber-300">{r.metaRecuperacao}/dia</div><div className="text-[7px] uppercase text-slate-600">meta recuperação</div></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/[.055] bg-black/15 p-4">
            <div className="text-[8px] font-semibold uppercase tracking-[.12em] text-slate-500">Ataque imediato</div>
            <div className="mt-1 text-[10px] text-slate-500">Ações que mais reduzem atraso e risco nesta semana.</div>
            <div className="mt-4 space-y-2">
              {planoRecuperacao.acoesPrioritarias.length===0&&<div className="rounded-xl border border-emerald-400/10 bg-emerald-400/[.03] p-3 text-[9px] text-emerald-300">Nenhuma ação pendente exige recuperação.</div>}
              {planoRecuperacao.acoesPrioritarias.map((a,index)=>{
                const riscos=riscoPorProjeto.get(a.projeto_id)?.criticos??0;
                const vencida=!!a.prazo&&a.prazo<hojeIso;
                return <div key={`recovery-action-${a.id}`} className="flex flex-col gap-3 rounded-xl border border-white/[.045] bg-white/[.018] p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5"><span className="text-[8px] font-semibold text-slate-600">#{index+1}</span>{vencida&&<span className="rounded border border-red-400/15 bg-red-400/[.06] px-1.5 py-0.5 text-[7px] font-semibold uppercase text-red-300">Vencida</span>}{riscos>0&&<span className="rounded border border-red-400/15 bg-red-400/[.06] px-1.5 py-0.5 text-[7px] font-semibold text-red-300">{riscos} risco(s) crítico(s)</span>}</div>
                    <div className="mt-1 truncate text-[10px] font-semibold text-white">{a.titulo}</div>
                    <div className="mt-1 text-[8px] text-slate-600">{a.projeto?.nome||"Projeto"} · {a.responsavel?.nome||"Sem responsável"} · {br(a.prazo)}</div>
                  </div>
                  <button type="button" onClick={()=>void onOpenProjeto(a.projeto_id)} className="shrink-0 rounded-lg border border-sky-400/15 bg-sky-400/[.05] px-3 py-1.5 text-[9px] font-semibold text-sky-300">360 <ChevronRight size={11} className="ml-1 inline"/></button>
                </div>;
              })}
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-white/[.05] bg-black/15 p-4 text-[9px] text-slate-500">
          Ritmo atual: <b className="text-sky-300">{planoRecuperacao.ritmoAtual.toFixed(1)}/dia</b> · Ritmo necessário: <b className="text-violet-300">{planoRecuperacao.ritmoNecessario.toFixed(1)}/dia</b> · Gap: <b className={planoRecuperacao.gapDiario>0?"text-red-300":"text-emerald-300"}>{planoRecuperacao.gapDiario.toFixed(1)}/dia</b>
        </div>
      </section>

<section className="rounded-3xl border border-white/[.06] bg-white/[.018] p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div><div className="flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[.15em] text-sky-300"><Archive size={13}/>Histórico semanal</div><div className="mt-1 text-sm font-semibold text-white">Memória executiva da operação</div><p className="mt-1 text-[10px] text-slate-500">Registre uma fotografia parcial agora. Após o fim da janela, a mesma semana passa a ser registrada como Fechada.</p></div>
          <button type="button" disabled={registrandoSemana} onClick={()=>void registrarSemana()} className="rounded-xl border border-sky-400/20 bg-sky-400/[.06] px-4 py-2.5 text-[10px] font-semibold text-sky-200 transition hover:bg-sky-400/[.1] disabled:opacity-40">{registrandoSemana?"Registrando...":"Registrar semana"}</button>
        </div>
        <div className="mt-4 grid gap-2 xl:grid-cols-3">
          {historico.length===0&&<div className="xl:col-span-3 rounded-xl border border-white/[.05] bg-black/10 p-4 text-[10px] text-slate-500">Nenhuma semana registrada ainda.</div>}
          {historico.slice(0,6).map(s=><div key={s.id} className="rounded-2xl border border-white/[.055] bg-black/15 p-4">
            <div className="flex items-start justify-between gap-3"><div><div className="text-[9px] font-semibold uppercase tracking-[.1em] text-slate-500">{br(s.inicio_semana)} — {br(s.fim_semana)}</div><div className="mt-1 text-xl font-semibold text-white">{s.percentual_execucao}%</div></div><span className={`rounded-md border px-2 py-1 text-[8px] font-semibold uppercase ${s.status_fechamento==="Fechada"?"border-emerald-400/15 bg-emerald-400/[.06] text-emerald-300":"border-amber-400/15 bg-amber-400/[.06] text-amber-300"}`}>{s.status_fechamento}</span></div>
            <div className="mt-3 grid grid-cols-4 gap-2 text-center"><div><div className="text-sm font-semibold text-sky-300">{s.planejadas}</div><div className="text-[7px] uppercase text-slate-600">Plan.</div></div><div><div className="text-sm font-semibold text-emerald-300">{s.concluidas}</div><div className="text-[7px] uppercase text-slate-600">Conc.</div></div><div><div className="text-sm font-semibold text-violet-300">{s.pendentes}</div><div className="text-[7px] uppercase text-slate-600">Pend.</div></div><div><div className="text-sm font-semibold text-red-300">{s.atrasadas}</div><div className="text-[7px] uppercase text-slate-600">Atras.</div></div></div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[.04]"><div className="h-full rounded-full bg-emerald-400/60" style={{width:`${Math.min(100,s.percentual_execucao)}%`}}/></div><div className="mt-2 text-[8px] text-slate-600">Risco {s.percentual_risco}% · {s.registrado_por_nome||"Sistema"}</div>
          </div>)}
        </div>
      </section>


      <section className="rounded-3xl border border-white/[.06] bg-white/[.018] p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[.15em] text-sky-300">
              <TrendingUp size={13}/>Tendência semanal
            </div>
            <div className="mt-1 text-sm font-semibold text-white">Comparativo de execução e risco</div>
            <p className="mt-1 text-[10px] text-slate-500">
              Evolução baseada exclusivamente nas semanas registradas no histórico.
            </p>
          </div>
          {semanaAtualHistorico && (
            <div className="text-right text-[9px] text-slate-500">
              Base atual: {br(semanaAtualHistorico.inicio_semana)} — {br(semanaAtualHistorico.fim_semana)}
            </div>
          )}
        </div>

        {historicoOrdenado.length < 2 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-sky-400/15 bg-sky-400/[.025] p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-sky-400/15 bg-sky-400/[.06] text-sky-300">
                <BarChart3 size={18}/>
              </div>
              <div>
                <div className="text-xs font-semibold text-white">Base histórica iniciada</div>
                <div className="mt-1 text-[10px] text-slate-500">
                  Já existe {historicoOrdenado.length} semana registrada. O comparativo será liberado automaticamente quando houver pelo menos 2 semanas.
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-white/[.055] bg-black/15 p-4">
                <div className="text-[8px] font-semibold uppercase tracking-[.12em] text-slate-500">Execução atual</div>
                <div className="mt-2 flex items-end justify-between gap-3">
                  <div className="text-2xl font-semibold text-emerald-300">{semanaAtualHistorico?.percentual_execucao ?? 0}%</div>
                  {deltaExecucao !== null && (
                    <div className={`flex items-center gap-1 text-[10px] font-semibold ${deltaExecucao>0?"text-emerald-300":deltaExecucao<0?"text-red-300":"text-slate-400"}`}>
                      {deltaExecucao>0?<TrendingUp size={13}/>:deltaExecucao<0?<TrendingDown size={13}/>:<Minus size={13}/>}
                      {deltaExecucao>0?"+":""}{deltaExecucao} p.p.
                    </div>
                  )}
                </div>
                <div className="mt-1 text-[8px] text-slate-600">vs. semana anterior</div>
              </div>

              <div className="rounded-2xl border border-white/[.055] bg-black/15 p-4">
                <div className="text-[8px] font-semibold uppercase tracking-[.12em] text-slate-500">Risco atual</div>
                <div className="mt-2 flex items-end justify-between gap-3">
                  <div className="text-2xl font-semibold text-red-300">{semanaAtualHistorico?.percentual_risco ?? 0}%</div>
                  {deltaRisco !== null && (
                    <div className={`flex items-center gap-1 text-[10px] font-semibold ${deltaRisco<0?"text-emerald-300":deltaRisco>0?"text-red-300":"text-slate-400"}`}>
                      {deltaRisco<0?<TrendingDown size={13}/>:deltaRisco>0?<TrendingUp size={13}/>:<Minus size={13}/>}
                      {deltaRisco>0?"+":""}{deltaRisco} p.p.
                    </div>
                  )}
                </div>
                <div className="mt-1 text-[8px] text-slate-600">menor é melhor</div>
              </div>

              <div className="rounded-2xl border border-white/[.055] bg-black/15 p-4">
                <div className="text-[8px] font-semibold uppercase tracking-[.12em] text-slate-500">Entregas</div>
                <div className="mt-2 text-2xl font-semibold text-sky-300">
                  {semanaAtualHistorico?.concluidas ?? 0}<span className="text-sm text-slate-600">/{semanaAtualHistorico?.planejadas ?? 0}</span>
                </div>
                <div className="mt-1 text-[8px] text-slate-600">concluídas / planejadas</div>
              </div>

              <div className="rounded-2xl border border-white/[.055] bg-black/15 p-4">
                <div className="text-[8px] font-semibold uppercase tracking-[.12em] text-slate-500">Leitura executiva</div>
                <div className={`mt-2 text-sm font-semibold ${
                  deltaExecucao !== null && deltaRisco !== null && deltaExecucao>0 && deltaRisco<=0
                    ? "text-emerald-300"
                    : deltaExecucao !== null && deltaRisco !== null && (deltaExecucao<0 || deltaRisco>0)
                    ? "text-red-300"
                    : "text-amber-300"
                }`}>
                  {deltaExecucao !== null && deltaRisco !== null && deltaExecucao>0 && deltaRisco<=0
                    ? "Melhorando"
                    : deltaExecucao !== null && deltaRisco !== null && (deltaExecucao<0 || deltaRisco>0)
                    ? "Piorando"
                    : "Estável"}
                </div>
                <div className="mt-1 text-[8px] text-slate-600">execução + risco combinados</div>
              </div>
            </div>

            <div className="mt-4 overflow-hidden rounded-2xl border border-white/[.055] bg-black/10">
              <div className="grid grid-cols-[1.4fr_.7fr_.7fr_.7fr_.7fr] border-b border-white/[.05] px-4 py-2 text-[8px] font-semibold uppercase tracking-[.1em] text-slate-600">
                <div>Semana</div><div>Execução</div><div>Risco</div><div>Entregas</div><div>Status</div>
              </div>
              {[...historicoOrdenado].reverse().slice(0,8).map((s)=>(
                <div key={`trend-${s.id}`} className="grid grid-cols-[1.4fr_.7fr_.7fr_.7fr_.7fr] items-center border-b border-white/[.035] px-4 py-3 text-[9px] last:border-0">
                  <div className="font-medium text-slate-300">{br(s.inicio_semana)} — {br(s.fim_semana)}</div>
                  <div className="font-semibold text-emerald-300">{s.percentual_execucao}%</div>
                  <div className="font-semibold text-red-300">{s.percentual_risco}%</div>
                  <div className="text-slate-400">{s.concluidas}/{s.planejadas}</div>
                  <div><span className={`rounded-md border px-2 py-1 text-[7px] font-semibold uppercase ${s.status_fechamento==="Fechada"?"border-emerald-400/15 bg-emerald-400/[.06] text-emerald-300":"border-amber-400/15 bg-amber-400/[.06] text-amber-300"}`}>{s.status_fechamento}</span></div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>


      <section className="rounded-3xl border border-white/[.06] bg-white/[.018] p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[.15em] text-cyan-300">
              <CalendarDays size={13}/>Linha do tempo executiva
            </div>
            <div className="mt-1 text-sm font-semibold text-white">Evolução semanal da operação</div>
            <p className="mt-1 text-[10px] text-slate-500">Cada ponto representa uma fotografia realmente registrada no histórico semanal.</p>
          </div>
          <div className="rounded-xl border border-white/[.05] bg-black/15 px-3 py-2 text-right">
            <div className="text-[8px] uppercase tracking-[.12em] text-slate-600">Semanas registradas</div>
            <div className="mt-1 text-sm font-semibold text-cyan-300">{historicoOrdenado.length}</div>
          </div>
        </div>

        {historicoOrdenado.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-cyan-400/15 bg-cyan-400/[.025] p-5 text-[10px] text-slate-500">
            Registre a primeira semana para iniciar a linha do tempo executiva.
          </div>
        ) : (
          <div className="mt-5 overflow-x-auto pb-2">
            <div className="flex min-w-max items-stretch gap-0">
              {historicoOrdenado.slice(-10).map((s,index,arr)=>{
                const anterior=index>0?arr[index-1]:null;
                const dExec=anterior?s.percentual_execucao-anterior.percentual_execucao:null;
                const dRisco=anterior?s.percentual_risco-anterior.percentual_risco:null;
                const melhorando=dExec!==null&&dRisco!==null&&dExec>0&&dRisco<=0;
                const piorando=dExec!==null&&dRisco!==null&&(dExec<0||dRisco>0);
                return (
                  <div key={`timeline-${s.id}`} className="flex items-stretch">
                    <div className="w-[230px] rounded-2xl border border-white/[.06] bg-black/15 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-[8px] font-semibold uppercase tracking-[.1em] text-slate-500">{br(s.inicio_semana)} — {br(s.fim_semana)}</div>
                          <div className="mt-2 flex items-baseline gap-2">
                            <span className="text-2xl font-semibold text-emerald-300">{s.percentual_execucao}%</span>
                            <span className="text-[8px] uppercase text-slate-600">execução</span>
                          </div>
                        </div>
                        <span className={`rounded-md border px-2 py-1 text-[7px] font-semibold uppercase ${s.status_fechamento==="Fechada"?"border-emerald-400/15 bg-emerald-400/[.06] text-emerald-300":"border-amber-400/15 bg-amber-400/[.06] text-amber-300"}`}>{s.status_fechamento}</span>
                      </div>

                      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[.04]">
                        <div className="h-full rounded-full bg-emerald-400/60" style={{width:`${Math.min(100,s.percentual_execucao)}%`}}/>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <div className="rounded-xl border border-white/[.045] bg-white/[.018] p-2.5">
                          <div className="text-[7px] uppercase text-slate-600">Risco</div>
                          <div className="mt-1 text-sm font-semibold text-red-300">{s.percentual_risco}%</div>
                        </div>
                        <div className="rounded-xl border border-white/[.045] bg-white/[.018] p-2.5">
                          <div className="text-[7px] uppercase text-slate-600">Entregas</div>
                          <div className="mt-1 text-sm font-semibold text-sky-300">{s.concluidas}/{s.planejadas}</div>
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2 text-[8px]">
                        <div className="text-slate-500">Pendentes <b className="text-violet-300">{s.pendentes}</b></div>
                        <div className="text-right text-slate-500">Atrasadas <b className="text-red-300">{s.atrasadas}</b></div>
                      </div>

                      {anterior ? (
                        <div className={`mt-3 rounded-xl border p-2.5 ${melhorando?"border-emerald-400/10 bg-emerald-400/[.035]":piorando?"border-red-400/10 bg-red-400/[.035]":"border-amber-400/10 bg-amber-400/[.035]"}`}>
                          <div className={`text-[8px] font-semibold uppercase ${melhorando?"text-emerald-300":piorando?"text-red-300":"text-amber-300"}`}>{melhorando?"Melhorando":piorando?"Piorando":"Estável"}</div>
                          <div className="mt-1 flex justify-between text-[8px] text-slate-500">
                            <span>Exec. {dExec!==null&&dExec>0?"+":""}{dExec} p.p.</span>
                            <span>Risco {dRisco!==null&&dRisco>0?"+":""}{dRisco} p.p.</span>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-3 rounded-xl border border-sky-400/10 bg-sky-400/[.03] p-2.5 text-[8px] text-sky-300">Marco inicial da série histórica</div>
                      )}
                    </div>

                    {index<arr.length-1&&<div className="flex w-10 items-center justify-center"><div className="h-px w-full bg-gradient-to-r from-cyan-400/35 to-violet-400/35"/><ChevronRight size={13} className="-ml-2 shrink-0 text-cyan-300/70"/></div>}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>


      <section className="rounded-3xl border border-white/[.06] bg-white/[.018] p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[.15em] text-violet-300">
              <UserRound size={13}/>Performance histórica
            </div>
            <div className="mt-1 text-sm font-semibold text-white">Eficiência acumulada por responsável</div>
            <p className="mt-1 text-[10px] text-slate-500">Ranking calculado somente a partir das semanas registradas, preservando a memória real da operação.</p>
          </div>
          <div className="flex gap-2">
            <div className="rounded-xl border border-white/[.05] bg-black/15 px-3 py-2 text-center"><div className="text-[8px] uppercase text-slate-600">Média execução</div><div className="mt-1 text-sm font-semibold text-emerald-300">{mediaExecucaoHistorica}%</div></div>
            <div className="rounded-xl border border-white/[.05] bg-black/15 px-3 py-2 text-center"><div className="text-[8px] uppercase text-slate-600">Média risco</div><div className="mt-1 text-sm font-semibold text-red-300">{mediaRiscoHistorica}%</div></div>
          </div>
        </div>

        {rankingHistoricoResponsaveis.length===0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-violet-400/15 bg-violet-400/[.025] p-5 text-[10px] text-slate-500">O primeiro ranking será formado quando o histórico semanal contiver a distribuição por responsável.</div>
        ) : (
          <div className="mt-4 grid gap-2 lg:grid-cols-2">
            {rankingHistoricoResponsaveis.slice(0,10).map((r,index)=>(
              <div key={r.nome} className="rounded-2xl border border-white/[.055] bg-black/15 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-[10px] font-bold ${index===0?"border-emerald-400/20 bg-emerald-400/[.07] text-emerald-300":"border-white/[.06] bg-white/[.025] text-slate-400"}`}>#{index+1}</div>
                    <div className="min-w-0"><div className="truncate text-[11px] font-semibold text-white">{r.nome}</div><div className="mt-0.5 text-[8px] text-slate-600">{r.semanas} semana(s) registrada(s)</div></div>
                  </div>
                  <div className={`text-lg font-semibold ${r.percentual>=80?"text-emerald-300":r.percentual>=50?"text-amber-300":"text-red-300"}`}>{r.percentual}%</div>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[.04]"><div className="h-full rounded-full bg-emerald-400/60" style={{width:`${Math.min(100,r.percentual)}%`}}/></div>
                <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                  <div><div className="text-xs font-semibold text-sky-300">{r.planejadas}</div><div className="text-[7px] uppercase text-slate-600">Plan.</div></div>
                  <div><div className="text-xs font-semibold text-emerald-300">{r.concluidas}</div><div className="text-[7px] uppercase text-slate-600">Conc.</div></div>
                  <div><div className="text-xs font-semibold text-violet-300">{r.pendentes}</div><div className="text-[7px] uppercase text-slate-600">Pend.</div></div>
                  <div><div className="text-xs font-semibold text-red-300">{r.atrasadas}</div><div className="text-[7px] uppercase text-slate-600">Atras.</div></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_280px]">
        <div className="rounded-3xl border border-white/[.06] bg-white/[.02] p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div><div className="text-[9px] font-semibold uppercase tracking-[.15em] text-slate-600">Prioridade de execução</div><div className="mt-1 text-sm font-semibold text-white">Fila operacional da semana</div></div>
            <div className="flex flex-wrap gap-1.5">{(["Todos","Semana","Vencidos","Sem prazo"] as const).map((x)=><button key={x} onClick={()=>setFiltro(x)} className={`rounded-lg border px-3 py-1.5 text-[9px] ${filtro===x?"border-sky-400/25 bg-sky-400/[.09] text-sky-200":"border-white/[.06] bg-white/[.02] text-slate-500"}`}>{x}</button>)}</div>
          </div>

          <div className="mt-4 space-y-2">
            {!loading && ordenadas.length === 0 && <div className="rounded-2xl border border-emerald-400/10 bg-emerald-400/[.03] p-5 text-xs text-emerald-300">Nenhuma ação encontrada para este filtro.</div>}
            {ordenadas.map((a) => {
              const vencida = !!a.prazo && a.prazo < hojeIso;
              const risco = riscoPorProjeto.get(a.projeto_id) ?? { criticos:0, atencao:0 };
              const classificacao = classificarExecucao(a, hojeIso, inicioIso, fimIso, risco.criticos);
              const estilo = estiloClassificacao(classificacao);
              return <div key={a.id} className="group flex w-full items-center gap-3 rounded-2xl border border-white/[.055] bg-black/15 p-3 text-left transition hover:border-sky-400/15 hover:bg-sky-400/[.025]">
                <div className={`h-10 w-1 shrink-0 rounded-full ${estilo.barra}`}/>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-xs font-semibold text-slate-200">{a.titulo}</span>
                    <span className={`rounded-md border px-1.5 py-0.5 text-[8px] font-semibold uppercase ${estilo.badge}`}>{classificacao}</span>
                    {vencida&&<span className="rounded-md bg-red-400/[.08] px-1.5 py-0.5 text-[8px] font-semibold uppercase text-red-300">Vencida</span>}
                    {risco.criticos>0&&<span className="rounded-md border border-rose-400/10 bg-rose-400/[.06] px-1.5 py-0.5 text-[8px] font-semibold text-rose-300">Projeto com {risco.criticos} risco{risco.criticos===1?" crítico":"s críticos"}</span>}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] text-slate-600"><span>{a.projeto?.nome || "Projeto"}</span><span className="flex items-center gap-1"><UserRound size={10}/>{a.responsavel?.nome || "Sem responsável"}</span><span className="flex items-center gap-1"><CalendarDays size={10}/>{br(a.prazo)}</span><span>{a.prioridade}</span></div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button type="button" title="Concluir ação" disabled={concluindo===a.id} onClick={()=>void concluirAcao(a)} className="flex h-8 items-center gap-1.5 rounded-lg border border-emerald-400/15 bg-emerald-400/[.05] px-2.5 text-[9px] font-medium text-emerald-300 transition hover:bg-emerald-400/[.1] disabled:cursor-not-allowed disabled:opacity-40">
                    <Check size={12}/>{concluindo===a.id?"Concluindo...":"Concluir"}
                  </button>
                  <button type="button" title="Abrir Projeto 360" onClick={()=>void onOpenProjeto(a.projeto_id)} className="flex h-8 items-center gap-1 rounded-lg border border-sky-400/15 bg-sky-400/[.05] px-2.5 text-[9px] font-medium text-sky-300 transition hover:bg-sky-400/[.1]">
                    360<ChevronRight size={11}/>
                  </button>
                </div>
              </div>;
            })}
          </div>
        </div>

        <aside className="rounded-3xl border border-white/[.06] bg-white/[.02] p-5">
          <div className="text-[9px] font-semibold uppercase tracking-[.15em] text-slate-600">Carga por responsável</div>
          <div className="mt-1 text-sm font-semibold text-white">Distribuição da execução</div>
          <div className="mt-4 space-y-3">{porResponsavel.slice(0,10).map(([nome,total])=><div key={nome}><div className="flex items-center justify-between gap-3 text-[10px]"><span className="truncate text-slate-400">{nome}</span><span className="font-semibold text-slate-200">{total}</span></div><div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[.04]"><div className="h-full rounded-full bg-sky-400/60" style={{width:`${Math.max(8,Math.min(100,(total/Math.max(1,ordenadas.length))*100))}%`}}/></div></div>)}</div>
          <div className="mt-5 rounded-2xl border border-violet-400/10 bg-violet-400/[.035] p-3 text-[9px] leading-4 text-slate-500">A fila usa as ações existentes. URGENTE = vencida com risco crítico ou prioridade crítica; ALTA = entrega da semana ou prioridade alta; ATENÇÃO = sem prazo; NORMAL = demais ações. O cockpit calcula status, risco, dias restantes e ritmo necessário usando o mesmo plano semanal. Agenda e Projeto 360 continuam na mesma fonte.</div>
        </aside>
      </section>
    </div>
  );
}

function MiniKpi({label,value,tone}:{label:string;value:number;tone:"sky"|"emerald"|"violet"|"red"}){
  const c=tone==="emerald"?"text-emerald-300":tone==="red"?"text-red-300":tone==="violet"?"text-violet-300":"text-sky-300";
  return <div className="rounded-xl border border-white/[.055] bg-black/15 p-3"><div className={`text-xl font-semibold ${c}`}>{value}</div><div className="mt-1 text-[8px] font-semibold uppercase tracking-[.11em] text-slate-600">{label}</div></div>;
}

function Kpi({icon:Icon,label,value,tone}:{icon:typeof CalendarDays;label:string;value:number;tone:"sky"|"red"|"amber"|"violet"}){
  const c=tone==="red"?"text-red-300":tone==="amber"?"text-amber-300":tone==="violet"?"text-violet-300":"text-sky-300";
  return <div className="rounded-2xl border border-white/[.06] bg-white/[.025] p-4"><div className="flex items-center justify-between"><span className="text-[8px] font-semibold uppercase tracking-[.12em] text-slate-600">{label}</span><Icon size={14} className={c}/></div><div className="mt-3 text-2xl font-semibold text-white">{value}</div></div>;
}
