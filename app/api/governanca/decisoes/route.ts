import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";

type HistoricoRow = {
  id: string;
  projeto_id: string;
  campo: string;
  valor_anterior: string | null;
  valor_novo: string | null;
  usuario_id: string | null;
  usuario_nome: string;
  origem: string;
  created_at: string;
};

type ProjetoRow = {
  id: string;
  nome: string;
  cliente_id: string | null;
  responsavel_nome: string | null;
};

type ClienteRow = { id: string; nome: string };

function extrairDetalhes(texto: string | null) {
  const valor = texto ?? "";

  const justificativa =
    valor.match(/Justificativa:\s*(.*?)(?=\s+Recomendação simulada:|\s+Carga origem:|\s+Carga destino:|\s+Score:|\s+Urgência:|\s+Quadrante:|$)/i)?.[1]?.trim() ?? null;

  const recomendacao =
    valor.match(/Recomendação simulada:\s*(.*?)(?=\.\s+Carga origem:|\.\s+Carga destino:|\s+Carga origem:|\s+Carga destino:|$)/i)?.[1]?.replace(/\.$/, "").trim() ?? null;

  const cargaOrigem = valor.match(/Carga origem:\s*([^.]+)\.?/i)?.[1]?.trim() ?? null;
  const cargaDestino = valor.match(/Carga destino:\s*([^.]+)\.?/i)?.[1]?.trim() ?? null;
  const score = valor.match(/Score:\s*([^.]+)\.?/i)?.[1]?.trim() ?? null;
  const urgencia = valor.match(/Urgência:\s*([^.]+)\.?/i)?.[1]?.trim() ?? null;
  const quadrante = valor.match(/Quadrante:\s*([^.]+)\.?/i)?.[1]?.trim() ?? null;

  return { justificativa, recomendacao, cargaOrigem, cargaDestino, score, urgencia, quadrante };
}

function extrairNumerosSeta(valor: string | null) {
  if (!valor) return { antes: null, depois: null };

  const m = valor.match(/(-?\d+(?:[.,]\d+)?)\s*→\s*(-?\d+(?:[.,]\d+)?)/);
  const converter = (v?: string) => {
    if (!v) return null;
    const n = Number(v.replace(",", "."));
    return Number.isFinite(n) ? n : null;
  };

  return { antes: converter(m?.[1]), depois: converter(m?.[2]) };
}

function resultadoPosDecisao(
  scoreAntes: number | null,
  scoreDepois: number | null,
  urgenciaAntes: number | null,
  urgenciaDepois: number | null,
) {
  const deltas: number[] = [];

  if (scoreAntes !== null && scoreDepois !== null) deltas.push(scoreDepois - scoreAntes);
  if (urgenciaAntes !== null && urgenciaDepois !== null) deltas.push(urgenciaDepois - urgenciaAntes);

  if (!deltas.length) {
    return {
      resultado: "Sem medição" as const,
      texto: "A decisão está auditada, mas o registro não contém score/urgência comparáveis.",
    };
  }

  const total = deltas.reduce((a, b) => a + b, 0);

  if (total < 0) {
    return {
      resultado: "Melhorou" as const,
      texto: "Os indicadores registrados na decisão reduziram a pressão gerencial.",
    };
  }

  if (total > 0) {
    return {
      resultado: "Piorou" as const,
      texto: "Os indicadores registrados na decisão aumentaram a pressão gerencial.",
    };
  }

  return {
    resultado: "Estável" as const,
    texto: "Os indicadores registrados permaneceram estáveis.",
  };
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

    const supabase = createAdminClient();

    const { data: historico, error: historicoError } = await supabase
      .from("historico_projeto")
      .select(`
        id,
        projeto_id,
        campo,
        valor_anterior,
        valor_novo,
        usuario_id,
        usuario_nome,
        origem,
        created_at
      `)
      .eq("origem", "governanca")
      .order("created_at", { ascending: false })
      .limit(500);

    if (historicoError) {
      return NextResponse.json(
        { success: false, error: historicoError.message },
        { status: 500 },
      );
    }

    const linhas = (historico ?? []) as HistoricoRow[];
    const decisoesBase = linhas.filter((item) => item.campo === "Decisão gerencial");

    const projetoIds = Array.from(new Set(decisoesBase.map((item) => item.projeto_id)));
    let projetos: ProjetoRow[] = [];

    if (projetoIds.length) {
      const { data, error } = await supabase
        .from("projetos")
        .select("id,nome,cliente_id,responsavel_nome")
        .in("id", projetoIds);

      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }

      projetos = (data ?? []) as ProjetoRow[];
    }

    const clienteIds = Array.from(
      new Set(
        projetos.map((item) => item.cliente_id).filter((id): id is string => Boolean(id)),
      ),
    );

    let clientes: ClienteRow[] = [];

    if (clienteIds.length) {
      const { data, error } = await supabase.from("clientes").select("id,nome").in("id", clienteIds);

      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }

      clientes = (data ?? []) as ClienteRow[];
    }

    const projetosMap = new Map(projetos.map((item) => [item.id, item]));
    const clientesMap = new Map(clientes.map((item) => [item.id, item.nome]));

    const decisoes = decisoesBase.map((decisao) => {
      const projeto = projetosMap.get(decisao.projeto_id);
      const texto = decisao.valor_novo ?? "";

      const isPrazo = texto.startsWith("Reprogramação de prazo:");
      const isPrioridade = texto.startsWith("Alteração de prioridade:");
      const isStatus = texto.startsWith("Alteração gerencial de status:");

      const campoRelacionado = isPrazo
        ? "Data final"
        : isPrioridade
          ? "Prioridade"
          : isStatus
            ? "Status"
            : "Responsável";

      const statusMatch = isStatus
        ? texto.match(/Alteração gerencial de status:\s*(.*?)\s*→\s*(.*?)\./i)
        : null;

      const alteracaoRelacionada = linhas.find(
        (item) =>
          item.projeto_id === decisao.projeto_id &&
          item.campo === campoRelacionado &&
          item.origem === "governanca" &&
          item.created_at === decisao.created_at,
      );

      const detalhes = extrairDetalhes(texto);
      const score = extrairNumerosSeta(detalhes.score);
      const urgencia = extrairNumerosSeta(detalhes.urgencia);
      const leitura = resultadoPosDecisao(score.antes, score.depois, urgencia.antes, urgencia.depois);

      const criado = new Date(decisao.created_at).getTime();
      const horas = Number.isFinite(criado)
        ? Math.max(0, (Date.now() - criado) / 3600000)
        : 0;

      return {
        id: decisao.id,
        projeto_id: decisao.projeto_id,
        projeto_nome: projeto?.nome ?? "Projeto não encontrado",
        cliente_nome: projeto?.cliente_id
          ? clientesMap.get(projeto.cliente_id) ?? "Sem cliente"
          : "Sem cliente",
        tipo: isPrazo
          ? "Reprogramação de prazo"
          : isPrioridade
            ? "Alteração gerencial de prioridade"
            : isStatus
              ? "Alteração gerencial de status"
              : "Redistribuição de responsabilidade",
        valor_anterior:
          alteracaoRelacionada?.valor_anterior ??
          (isStatus ? statusMatch?.[1]?.trim() ?? null : null),
        valor_novo:
          alteracaoRelacionada?.valor_novo ??
          (isStatus
            ? statusMatch?.[2]?.trim() ?? null
            : isPrazo
              ? null
              : projeto?.responsavel_nome ?? null),
        justificativa: detalhes.justificativa,
        recomendacao:
          isPrazo || isPrioridade || isStatus
            ? detalhes.quadrante
              ? `Quadrante ${detalhes.quadrante}`
              : null
            : detalhes.recomendacao,
        carga_origem:
          isPrazo || isPrioridade || isStatus ? detalhes.score : detalhes.cargaOrigem,
        carga_destino:
          isPrazo || isPrioridade || isStatus ? detalhes.urgencia : detalhes.cargaDestino,
        usuario_id: decisao.usuario_id,
        usuario_nome: decisao.usuario_nome || "Sistema",
        created_at: decisao.created_at,
        detalhes: decisao.valor_novo,

        score_antes: score.antes,
        score_depois: score.depois,
        urgencia_antes: urgencia.antes,
        urgencia_depois: urgencia.depois,
        resultado: leitura.resultado,
        resultado_texto: leitura.texto,
        horas_desde_decisao: horas,
      };
    });

    const agora = Date.now();
    const seteDias = 7 * 24 * 60 * 60 * 1000;

    const resumo = {
      total: decisoes.length,
      projetos_impactados: new Set(decisoes.map((item) => item.projeto_id)).size,
      ultimos_7_dias: decisoes.filter((item) => {
        const data = new Date(item.created_at).getTime();
        return Number.isFinite(data) && agora - data <= seteDias;
      }).length,
      decisores: new Set(decisoes.map((item) => item.usuario_nome)).size,
      melhoraram: decisoes.filter((item) => item.resultado === "Melhorou").length,
      estaveis: decisoes.filter((item) => item.resultado === "Estável").length,
      pioraram: decisoes.filter((item) => item.resultado === "Piorou").length,
      sem_medicao: decisoes.filter((item) => item.resultado === "Sem medição").length,
    };

    return NextResponse.json({
      success: true,
      atualizado_em: new Date().toISOString(),
      resumo,
      decisoes,
    });
  } catch (error) {
    console.error("[GET /api/governanca/decisoes]", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Erro ao carregar a Central de Decisões.",
      },
      { status: 500 },
    );
  }
}
