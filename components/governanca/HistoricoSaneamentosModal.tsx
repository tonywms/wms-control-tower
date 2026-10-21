"use client";

import { CheckCircle2, ChevronRight, Clock3, RefreshCw, Search, ShieldCheck, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type Item = {
  id: string;
  projeto_id: string;
  projeto_nome: string;
  categoria: string;
  severidade: "Crítico" | "Atenção";
  titulo: string;
  descricao: string | null;
  operacao: "reprogramar_prazo" | "definir_responsavel" | "concluir" | "cancelar";
  campo_alterado: string;
  valor_anterior: string | null;
  valor_novo: string | null;
  usuario_nome: string;
  saneado_em: string;
};

type Dados = {
  success: boolean;
  resumo?: { total: number; criticos: number; atencao: number; projetos: number };
  itens?: Item[];
  error?: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onOpenProjeto: (projetoId: string) => void | Promise<void>;
};

const operacaoLabel: Record<Item["operacao"], string> = {
  reprogramar_prazo: "Prazo reprogramado",
  definir_responsavel: "Responsável definido",
  concluir: "Item concluído",
  cancelar: "Item cancelado",
};

function valor(v: string | null) {
  return v || "Não informado";
}

export default function HistoricoSaneamentosModal({ open, onClose, onOpenProjeto }: Props) {
  const [dados, setDados] = useState<Dados | null>(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");

  const carregar = useCallback(async () => {
    try {
      setLoading(true);
      setErro("");
      const response = await fetch("/api/inconsistencias/historico", { cache: "no-store" });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || "Erro ao carregar histórico.");
      setDados(json);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Erro ao carregar histórico.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) void carregar();
  }, [open, carregar]);

  const itens = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return dados?.itens ?? [];
    return (dados?.itens ?? []).filter((item) =>
      [item.projeto_nome, item.titulo, item.categoria, item.usuario_nome, item.campo_alterado]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [dados, busca]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="flex h-[calc(100dvh-48px)] w-[min(1120px,calc(100vw-48px))] flex-col overflow-hidden rounded-[26px] border border-emerald-400/20 bg-[#070d1b] shadow-2xl shadow-black/70">
        <div className="flex items-start justify-between border-b border-white/[.06] p-6">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.17em] text-emerald-300"><ShieldCheck size={15}/>Compliance · saneamentos</div>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-.04em] text-white">Histórico de inconsistências saneadas</h2>
            <p className="mt-2 text-xs text-slate-500">Evidência permanente de problemas detectados e correções executadas.</p>
          </div>
          <button onClick={onClose} className="rounded-xl border border-white/[.06] p-2.5 text-slate-500 hover:text-white"><X size={18}/></button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Kpi label="Saneamentos" value={dados?.resumo?.total ?? 0}/>
            <Kpi label="Críticos resolvidos" value={dados?.resumo?.criticos ?? 0}/>
            <Kpi label="Atenções resolvidas" value={dados?.resumo?.atencao ?? 0}/>
            <Kpi label="Projetos saneados" value={dados?.resumo?.projetos ?? 0}/>
          </div>

          <div className="mt-4 flex gap-3">
            <label className="relative flex-1"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600"/><input value={busca} onChange={(e)=>setBusca(e.target.value)} placeholder="Buscar projeto, problema, usuário..." className="h-11 w-full rounded-xl border border-white/[.06] bg-black/20 pl-10 pr-3 text-xs text-slate-200 outline-none placeholder:text-slate-700"/></label>
            <button onClick={()=>void carregar()} disabled={loading} className="flex h-11 items-center gap-2 rounded-xl border border-emerald-400/15 bg-emerald-400/[.05] px-4 text-xs text-emerald-300 disabled:opacity-50"><RefreshCw size={14} className={loading?"animate-spin":""}/>Atualizar</button>
          </div>

          {erro && <div className="mt-4 rounded-xl border border-red-400/15 bg-red-400/[.05] p-4 text-xs text-red-200">{erro}</div>}

          <div className="mt-4 overflow-hidden rounded-2xl border border-white/[.06] bg-white/[.02]">
            {loading && !dados ? <div className="flex min-h-[260px] items-center justify-center text-sm text-slate-500"><RefreshCw size={16} className="mr-2 animate-spin"/>Carregando histórico...</div> : itens.length === 0 ? <div className="flex min-h-[260px] items-center justify-center text-center"><div><CheckCircle2 size={30} className="mx-auto text-emerald-300"/><div className="mt-3 text-sm font-semibold text-slate-300">Nenhum saneamento registrado</div><div className="mt-1 text-xs text-slate-600">Os próximos saneamentos aparecerão aqui.</div></div></div> : <div className="divide-y divide-white/[.05]">{itens.map((item)=><article key={item.id} className="grid gap-4 p-5 hover:bg-white/[.018] xl:grid-cols-[180px_1fr_250px_170px]">
              <div><div className={`inline-flex rounded-full border px-2 py-1 text-[8px] font-semibold ${item.severidade==="Crítico"?"border-red-400/15 bg-red-400/[.05] text-red-300":"border-amber-400/15 bg-amber-400/[.05] text-amber-300"}`}>{item.severidade}</div><div className="mt-2 text-xs font-semibold text-white">{item.projeto_nome}</div><div className="mt-1 text-[8px] uppercase tracking-[.12em] text-slate-600">{item.categoria}</div></div>
              <div><div className="text-xs font-semibold text-slate-200">{item.titulo}</div><div className="mt-1 text-[9px] text-emerald-300">{operacaoLabel[item.operacao]}</div><div className="mt-2 text-[9px] text-slate-600">{item.campo_alterado}</div><div className="mt-3 flex flex-wrap items-center gap-2 text-[9px]"><span className="rounded-lg bg-black/25 px-2 py-1 text-slate-500">{valor(item.valor_anterior)}</span><span className="text-slate-700">→</span><span className="rounded-lg border border-emerald-400/10 bg-emerald-400/[.04] px-2 py-1 text-emerald-300">{valor(item.valor_novo)}</span></div></div>
              <div><div className="flex items-center gap-2 text-[9px] text-slate-500"><Clock3 size={12}/>{new Date(item.saneado_em).toLocaleString("pt-BR")}</div><div className="mt-2 text-[9px] text-slate-600">Executado por</div><div className="mt-1 text-[10px] font-semibold text-slate-300">{item.usuario_nome}</div></div>
              <div className="flex items-center justify-end"><button onClick={()=>void onOpenProjeto(item.projeto_id)} className="flex items-center gap-1.5 rounded-xl border border-sky-400/15 bg-sky-400/[.05] px-3 py-2 text-[9px] text-sky-300 hover:bg-sky-400/[.10]">Projeto 360<ChevronRight size={12}/></button></div>
            </article>)}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

function Kpi({label,value}:{label:string;value:number}) {
  return <div className="rounded-2xl border border-emerald-400/10 bg-emerald-400/[.035] p-4"><div className="text-2xl font-semibold text-emerald-200">{value}</div><div className="mt-1 text-[8px] font-semibold uppercase tracking-[.12em] text-slate-600">{label}</div></div>;
}
