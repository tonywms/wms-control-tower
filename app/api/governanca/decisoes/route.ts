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

type ClienteRow = {
  id: string;
  nome: string;
};

function extrairDetalhes(texto: string | null) {
  const valor = texto ?? "";

  const justificativa =
    valor.match(/Justificativa:\s*(.*?)(?=\s+Recomendação simulada:|\s+Carga origem:|\s+Carga destino:|$)/i)?.[1]?.trim() ??
    null;

  const recomendacao =
    valor.match(/Recomendação simulada:\s*(.*?)(?=\.\s+Carga origem:|\.\s+Carga destino:|$)/i)?.[1]?.replace(/\.$/, "").trim() ??
    null;

  const cargaOrigem =
    valor.match(/Carga origem:\s*([^.]+)\.?/i)?.[1]?.trim() ?? null;

  const cargaDestino =
    valor.match(/Carga destino:\s*([^.]+)\.?/i)?.[1]?.trim() ?? null;

  return {
    justificativa,
    recomendacao,
    carga_origem: cargaOrigem,
    carga_destino: cargaDestino,
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

    // A Central de Decisões é uma leitura gerencial.
    // O admin client é usado no servidor para não depender da sessão Supabase
    // durante o bypass local de autenticação. A permissão do Control Tower
    // continua sendo validada acima por requirePermission().
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
    const decisoesBase = linhas.filter(
      (item) => item.campo === "Decisão gerencial",
    );

    const projetoIds = Array.from(
      new Set(decisoesBase.map((item) => item.projeto_id)),
    );

    let projetos: ProjetoRow[] = [];

    if (projetoIds.length > 0) {
      const { data, error } = await supabase
        .from("projetos")
        .select("id,nome,cliente_id,responsavel_nome")
        .in("id", projetoIds);

      if (error) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 500 },
        );
      }

      projetos = (data ?? []) as ProjetoRow[];
    }

    const clienteIds = Array.from(
      new Set(
        projetos
          .map((item) => item.cliente_id)
          .filter((id): id is string => Boolean(id)),
      ),
    );

    let clientes: ClienteRow[] = [];

    if (clienteIds.length > 0) {
      const { data, error } = await supabase
        .from("clientes")
        .select("id,nome")
        .in("id", clienteIds);

      if (error) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 500 },
        );
      }

      clientes = (data ?? []) as ClienteRow[];
    }

    const projetosMap = new Map(projetos.map((item) => [item.id, item]));
    const clientesMap = new Map(clientes.map((item) => [item.id, item.nome]));

    const decisoes = decisoesBase.map((decisao) => {
      const projeto = projetosMap.get(decisao.projeto_id);
      const textoDecisao = decisao.valor_novo ?? "";

      const isPrazo = textoDecisao.startsWith("Reprogramação de prazo:");
      const isPrioridade = textoDecisao.startsWith("Alteração de prioridade:");

      const campoRelacionado = isPrazo
        ? "Data final"
        : isPrioridade
          ? "Prioridade"
          : "Responsável";

      const alteracaoRelacionada = linhas.find(
        (item) =>
          item.projeto_id === decisao.projeto_id &&
          item.campo === campoRelacionado &&
          item.origem === "governanca" &&
          item.created_at === decisao.created_at,
      );

      const detalhes = extrairDetalhes(decisao.valor_novo);

      const score =
        textoDecisao.match(/Score:\s*([^.]+)\.?/i)?.[1]?.trim() ?? null;
      const urgencia =
        textoDecisao.match(/Urgência:\s*([^.]+)\.?/i)?.[1]?.trim() ?? null;
      const quadrante =
        textoDecisao.match(/Quadrante:\s*([^.]+)\.?/i)?.[1]?.trim() ?? null;

      return {
        id: decisao.id,
        projeto_id: decisao.projeto_id,
        projeto_nome: projeto?.nome ?? "Projeto não encontrado",
        cliente_nome:
          projeto?.cliente_id
            ? clientesMap.get(projeto.cliente_id) ?? "Sem cliente"
            : "Sem cliente",
        tipo: isPrazo
          ? "Reprogramação de prazo"
          : isPrioridade
            ? "Alteração gerencial de prioridade"
            : "Redistribuição de responsabilidade",
        valor_anterior: alteracaoRelacionada?.valor_anterior ?? null,
        valor_novo:
          alteracaoRelacionada?.valor_novo ??
          (isPrazo ? null : projeto?.responsavel_nome ?? null),
        justificativa: detalhes.justificativa,
        recomendacao: isPrazo || isPrioridade
          ? quadrante
            ? `Quadrante ${quadrante}`
            : null
          : detalhes.recomendacao,
        carga_origem: isPrazo || isPrioridade ? score : detalhes.carga_origem,
        carga_destino: isPrazo || isPrioridade ? urgencia : detalhes.carga_destino,
        usuario_id: decisao.usuario_id,
        usuario_nome: decisao.usuario_nome || "Sistema",
        created_at: decisao.created_at,
        detalhes: decisao.valor_novo,
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
