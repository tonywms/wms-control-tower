import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/permissions";

type Projeto = {
  id: string;
  nome: string;
  status: string;
  prioridade: string;
  percentual: number | null;
  data_fim: string | null;
  cliente?: { id: string; nome: string } | null;
  etapa?: { id: string; nome: string; ordem: number } | null;
  responsavel?: { id: string; nome: string } | null;
};

type Pendencia = {
  id: string;
  projeto_id: string;
  titulo: string;
  tipo: "Pendência" | "Impedimento";
  prioridade: "Baixa" | "Normal" | "Alta" | "Crítica";
  status: "Pendente" | "Em andamento" | "Concluída" | "Cancelada";
  prazo: string | null;
};

type Marco = {
  id: string;
  projeto_id: string;
  nome: string;
  status: "Previsto" | "Em andamento" | "Concluído" | "Cancelado";
  data_prevista: string | null;
};

type Acao = {
  id: string;
  projeto_id: string;
  titulo: string;
  status: "Pendente" | "Em andamento" | "Concluída" | "Cancelada";
  prioridade: "Baixa" | "Normal" | "Alta" | "Crítica";
  prazo: string | null;
};

function fimDoDia(data: string) {
  return new Date(`${data}T23:59:59`).getTime();
}

function vencido(data: string | null) {
  return !!data && fimDoDia(data) < Date.now();
}

export async function GET() {
  try {
    const permissao = await requirePermission("visualizar");

    if (!permissao.ok) {
      return NextResponse.json(
        { success: false, error: permissao.error },
        { status: permissao.status },
      );
    }

    const supabase = await createClient();

    const [projetosRes, pendenciasRes, marcosRes, acoesRes] =
      await Promise.all([
        supabase
          .from("projetos")
          .select(`
            id,nome,status,prioridade,percentual,data_fim,
            cliente:clientes(id,nome),
            etapa:etapas(id,nome,ordem),
            responsavel:usuarios!projetos_responsavel_id_fkey(id,nome)
          `)
          .order("updated_at", { ascending: false }),

        supabase
          .from("projeto_pendencias")
          .select("id,projeto_id,titulo,tipo,prioridade,status,prazo"),

        supabase
          .from("projeto_marcos")
          .select("id,projeto_id,nome,status,data_prevista"),

        supabase
          .from("projeto_acoes")
          .select("id,projeto_id,titulo,status,prioridade,prazo"),
      ]);

    const erro =
      projetosRes.error ||
      pendenciasRes.error ||
      marcosRes.error ||
      acoesRes.error;

    if (erro) {
      return NextResponse.json(
        { success: false, error: erro.message },
        { status: 500 },
      );
    }

    const projetos = (projetosRes.data ?? []) as unknown as Projeto[];
    const pendencias = (pendenciasRes.data ?? []) as Pendencia[];
    const marcos = (marcosRes.data ?? []) as Marco[];
    const acoes = (acoesRes.data ?? []) as Acao[];

    const pendenciasPorProjeto = new Map<string, Pendencia[]>();
    const marcosPorProjeto = new Map<string, Marco[]>();
    const acoesPorProjeto = new Map<string, Acao[]>();

    for (const item of pendencias) {
      const lista = pendenciasPorProjeto.get(item.projeto_id) ?? [];
      lista.push(item);
      pendenciasPorProjeto.set(item.projeto_id, lista);
    }

    for (const item of marcos) {
      const lista = marcosPorProjeto.get(item.projeto_id) ?? [];
      lista.push(item);
      marcosPorProjeto.set(item.projeto_id, lista);
    }

    for (const item of acoes) {
      const lista = acoesPorProjeto.get(item.projeto_id) ?? [];
      lista.push(item);
      acoesPorProjeto.set(item.projeto_id, lista);
    }

    const detalhes = projetos.map((projeto) => {
      const p = pendenciasPorProjeto.get(projeto.id) ?? [];
      const m = marcosPorProjeto.get(projeto.id) ?? [];
      const a = acoesPorProjeto.get(projeto.id) ?? [];

      const pendenciasAbertas = p.filter(
        (x) => x.status !== "Concluída" && x.status !== "Cancelada",
      );

      const impedimentosAbertos = pendenciasAbertas.filter(
        (x) => x.tipo === "Impedimento",
      );

      const impedimentosCriticos = impedimentosAbertos.filter(
        (x) => x.prioridade === "Crítica" || vencido(x.prazo),
      );

      const pendenciasVencidas = pendenciasAbertas.filter(
        (x) => x.tipo === "Pendência" && vencido(x.prazo),
      );

      const marcosAtrasados = m.filter(
        (x) =>
          x.status !== "Concluído" &&
          x.status !== "Cancelado" &&
          vencido(x.data_prevista),
      );

      const acoesVencidas = a.filter(
        (x) =>
          x.status !== "Concluída" &&
          x.status !== "Cancelada" &&
          vencido(x.prazo),
      );

      const projetoAtrasado =
        projeto.status !== "Finalizado" &&
        projeto.status !== "Cancelado" &&
        vencido(projeto.data_fim);

      const critico = impedimentosCriticos.length > 0;

      const atencao =
        !critico &&
        (projeto.status === "Bloqueado" ||
          projeto.status === "Pausado" ||
          projetoAtrasado ||
          pendenciasVencidas.length > 0 ||
          impedimentosAbertos.length > 0 ||
          marcosAtrasados.length > 0 ||
          acoesVencidas.length > 0);

      const saude = critico ? "Crítico" : atencao ? "Atenção" : "Estável";

      const score =
        impedimentosCriticos.length * 100 +
        (projeto.status === "Bloqueado" ? 60 : 0) +
        (projeto.status === "Pausado" ? 35 : 0) +
        (projetoAtrasado ? 40 : 0) +
        pendenciasVencidas.length * 20 +
        impedimentosAbertos.length * 25 +
        marcosAtrasados.length * 18 +
        acoesVencidas.length * 15;

      return {
        ...projeto,
        saude,
        score,
        detalhesAlertas: {
          impedimentos: impedimentosAbertos.map((x) => ({
            id: x.id,
            titulo: x.titulo,
            prioridade: x.prioridade,
            prazo: x.prazo,
          })),
          marcosAtrasados: marcosAtrasados.map((x) => ({
            id: x.id,
            nome: x.nome,
            data_prevista: x.data_prevista,
          })),
          acoesVencidas: acoesVencidas.map((x) => ({
            id: x.id,
            titulo: x.titulo,
            prioridade: x.prioridade,
            prazo: x.prazo,
          })),
        },
        indicadores: {
          projetoAtrasado,
          pendenciasAbertas: pendenciasAbertas.length,
          pendenciasVencidas: pendenciasVencidas.length,
          impedimentosAbertos: impedimentosAbertos.length,
          impedimentosCriticos: impedimentosCriticos.length,
          marcosAtrasados: marcosAtrasados.length,
          acoesVencidas: acoesVencidas.length,
        },
      };
    });

    const ativos = detalhes.filter(
      (x) => x.status !== "Finalizado" && x.status !== "Cancelado",
    );

    const resumo = {
      total: detalhes.length,
      ativos: ativos.length,
      estaveis: ativos.filter((x) => x.saude === "Estável").length,
      atencao: ativos.filter((x) => x.saude === "Atenção").length,
      criticos: ativos.filter((x) => x.saude === "Crítico").length,
      atrasados: ativos.filter((x) => x.indicadores.projetoAtrasado).length,
      bloqueados: ativos.filter((x) => x.status === "Bloqueado").length,
      impedimentos: ativos.reduce(
        (s, x) => s + x.indicadores.impedimentosAbertos,
        0,
      ),
      marcosAtrasados: ativos.reduce(
        (s, x) => s + x.indicadores.marcosAtrasados,
        0,
      ),
      acoesVencidas: ativos.reduce(
        (s, x) => s + x.indicadores.acoesVencidas,
        0,
      ),
    };

    const ranking = [...ativos]
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    const porStatus = Object.entries(
      detalhes.reduce<Record<string, number>>((acc, projeto) => {
        acc[projeto.status] = (acc[projeto.status] ?? 0) + 1;
        return acc;
      }, {}),
    )
      .map(([nome, total]) => ({ nome, total }))
      .sort((a, b) => b.total - a.total);

    const porEtapa = Object.entries(
      ativos.reduce<Record<string, number>>((acc, projeto) => {
        const nome = projeto.etapa?.nome ?? "Sem etapa";
        acc[nome] = (acc[nome] ?? 0) + 1;
        return acc;
      }, {}),
    )
      .map(([nome, total]) => ({ nome, total }))
      .sort((a, b) => b.total - a.total);

    return NextResponse.json({
      success: true,
      atualizadoEm: new Date().toISOString(),
      resumo,
      ranking,
      projetos: ativos,
      porStatus,
      porEtapa,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Erro ao montar dashboard executivo.",
      },
      { status: 500 },
    );
  }
}
