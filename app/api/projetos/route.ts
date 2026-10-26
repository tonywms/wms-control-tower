import { NextRequest, NextResponse } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/permissions";

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
  started_at: string | null;
  paused_at: string | null;
  pausa_motivo: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
};

const STATUS_VALIDOS = [
  "Não iniciado",
  "Planejado",
  "Em andamento",
  "Pausado",
  "Bloqueado",
  "Finalizado",
  "Cancelado",
];

const PRIORIDADES_VALIDAS = [
  "Baixa",
  "Normal",
  "Alta",
  "Crítica",
];

function texto(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const valor = value.trim();
  return valor ? valor : null;
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

    const [
      projetosResult,
      clientesResult,
      etapasResult,
      usuariosResult,
    ] = await Promise.all([
      supabase
        .from("projetos")
        .select("*")
        .order("data_inicio", {
          ascending: true,
          nullsFirst: false,
        })
        .order("created_at", {
          ascending: true,
        }),

      supabase
        .from("clientes")
        .select("id, nome, cidade"),

      supabase
        .from("etapas")
        .select("id, nome, ordem")
        .order("ordem", {
          ascending: true,
        }),

      supabase
        .from("usuarios")
        .select("id, nome, setor, cargo")
        .eq("ativo", true),
    ]);

    if (projetosResult.error) {
      throw new Error(
        `Erro ao buscar projetos: ${projetosResult.error.message}`,
      );
    }

    if (clientesResult.error) {
      throw new Error(
        `Erro ao buscar clientes: ${clientesResult.error.message}`,
      );
    }

    if (etapasResult.error) {
      throw new Error(
        `Erro ao buscar etapas: ${etapasResult.error.message}`,
      );
    }

    if (usuariosResult.error) {
      throw new Error(
        `Erro ao buscar usuários: ${usuariosResult.error.message}`,
      );
    }

    const projetos = (projetosResult.data ?? []) as Projeto[];
    const clientes = clientesResult.data ?? [];
    const etapas = etapasResult.data ?? [];
    const usuarios = usuariosResult.data ?? [];

    const clientesMap = new Map(
      clientes.map((cliente) => [
        cliente.id,
        cliente,
      ]),
    );

    const etapasMap = new Map(
      etapas.map((etapa) => [
        etapa.id,
        etapa,
      ]),
    );

    const usuariosMap = new Map(
      usuarios.map((usuario) => [
        usuario.id,
        usuario,
      ]),
    );

    const carteira = projetos.map((projeto) => {
      const cliente = clientesMap.get(projeto.cliente_id);
      const etapa = projeto.etapa_id
        ? etapasMap.get(projeto.etapa_id)
        : null;

      const responsavel = projeto.responsavel_id
        ? usuariosMap.get(projeto.responsavel_id)
        : null;

      return {
        ...projeto,

        cliente: cliente
          ? {
              id: cliente.id,
              nome: cliente.nome,
              cidade: cliente.cidade,
            }
          : null,

        etapa: etapa
          ? {
              id: etapa.id,
              nome: etapa.nome,
              ordem: etapa.ordem,
            }
          : null,

        responsavel: responsavel
          ? {
              id: responsavel.id,
              nome: responsavel.nome,
              setor: responsavel.setor,
              cargo: responsavel.cargo,
            }
          : null,
      };
    });

    return NextResponse.json(
      {
        success: true,
        total: carteira.length,
        projetos: carteira,
        resumo: {
          total: carteira.length,
          emAndamento: carteira.filter(
            (projeto) =>
              projeto.status === "Em andamento",
          ).length,
          planejados: carteira.filter(
            (projeto) =>
              projeto.status === "Planejado",
          ).length,
          bloqueados: carteira.filter(
            (projeto) =>
              projeto.status === "Bloqueado",
          ).length,
          pausados: carteira.filter(
            (projeto) =>
              projeto.status === "Pausado",
          ).length,
          finalizados: carteira.filter(
            (projeto) =>
              projeto.status === "Finalizado",
          ).length,
          naoIniciados: carteira.filter(
            (projeto) =>
              projeto.status === "Não iniciado",
          ).length,
          cancelados: carteira.filter(
            (projeto) =>
              projeto.status === "Cancelado",
          ).length,
          goLives: carteira.filter(
            (projeto) =>
              projeto.etapa?.nome === "Go-Live",
          ).length,
          integracoes: carteira.filter(
            (projeto) =>
              projeto.fase_origem === "Integração",
          ).length,
        },
        etapas,
        responsaveis: usuarios,
      },
      { status: 200 },
    );
  } catch (error) {
    unstable_rethrow(error);

    console.error(
      "[API /api/projetos]",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Erro desconhecido ao buscar projetos.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const autorizacao = await requirePermission("editar");

    if (!autorizacao.ok) {
      return NextResponse.json(
        {
          success: false,
          error: autorizacao.error,
        },
        {
          status: autorizacao.status,
        },
      );
    }

    const body = await request.json();
    const supabase = await createClient();

    const clienteId = texto(body.cliente_id);
    const nome = texto(body.nome);
    const plataforma = texto(body.plataforma);
    const setor = texto(body.setor);
    const responsavelId = texto(body.responsavel_id);
    const responsavelNomeRecebido = texto(body.responsavel_nome);
    const dataInicio = texto(body.data_inicio);
    const dataFim = texto(body.data_fim);
    const observacoes = texto(body.observacoes);

    const status =
      texto(body.status) ?? "Não iniciado";

    const prioridade =
      texto(body.prioridade) ?? "Normal";

    if (!clienteId) {
      return NextResponse.json(
        {
          success: false,
          error: "Selecione o cliente do projeto.",
        },
        { status: 400 },
      );
    }

    if (!nome) {
      return NextResponse.json(
        {
          success: false,
          error: "Informe o nome do projeto.",
        },
        { status: 400 },
      );
    }

    if (!STATUS_VALIDOS.includes(status)) {
      return NextResponse.json(
        {
          success: false,
          error: `Status inválido: ${status}`,
        },
        { status: 400 },
      );
    }

    if (!PRIORIDADES_VALIDAS.includes(prioridade)) {
      return NextResponse.json(
        {
          success: false,
          error: `Prioridade inválida: ${prioridade}`,
        },
        { status: 400 },
      );
    }

    const percentual = Math.min(
      100,
      Math.max(
        0,
        Number(body.percentual) || 0,
      ),
    );

    const {
      data: cliente,
      error: clienteError,
    } = await supabase
      .from("clientes")
      .select("id, nome, cidade, ativo")
      .eq("id", clienteId)
      .maybeSingle();

    if (clienteError) {
      console.error(
        "[POST /api/projetos] Erro ao validar cliente:",
        clienteError,
      );

      return NextResponse.json(
        {
          success: false,
          error: "Erro ao validar o cliente.",
          details: clienteError.message,
          code: clienteError.code ?? null,
        },
        { status: 500 },
      );
    }

    if (!cliente) {
      return NextResponse.json(
        {
          success: false,
          error: "O cliente informado não existe.",
        },
        { status: 400 },
      );
    }

    if (cliente.ativo === false) {
      return NextResponse.json(
        {
          success: false,
          error: "O cliente informado está inativo.",
        },
        { status: 400 },
      );
    }

    let etapaIdFinal =
      texto(body.etapa_id);

    const faseOrigemRecebida =
      texto(body.fase_origem);

    if (!etapaIdFinal && faseOrigemRecebida) {
      const {
        data: etapaPorNome,
        error: etapaPorNomeError,
      } = await supabase
        .from("etapas")
        .select("id, nome, ordem")
        .ilike("nome", faseOrigemRecebida)
        .maybeSingle();

      if (etapaPorNomeError) {
        console.error(
          "[POST /api/projetos] Erro ao localizar etapa pela fase:",
          etapaPorNomeError,
        );

        return NextResponse.json(
          {
            success: false,
            error: "Erro ao localizar a etapa informada.",
            details: etapaPorNomeError.message,
            code: etapaPorNomeError.code ?? null,
          },
          { status: 500 },
        );
      }

      if (!etapaPorNome) {
        return NextResponse.json(
          {
            success: false,
            error: `A etapa "${faseOrigemRecebida}" não foi encontrada.`,
          },
          { status: 400 },
        );
      }

      etapaIdFinal = etapaPorNome.id;
    }

    let etapaFinal:
      | { id: string; nome: string; ordem: number }
      | null = null;

    if (etapaIdFinal) {
      const {
        data: etapa,
        error: etapaError,
      } = await supabase
        .from("etapas")
        .select("id, nome, ordem")
        .eq("id", etapaIdFinal)
        .maybeSingle();

      if (etapaError) {
        console.error(
          "[POST /api/projetos] Erro ao validar etapa:",
          etapaError,
        );

        return NextResponse.json(
          {
            success: false,
            error: "Erro ao validar a etapa do projeto.",
            details: etapaError.message,
            code: etapaError.code ?? null,
          },
          { status: 500 },
        );
      }

      if (!etapa) {
        return NextResponse.json(
          {
            success: false,
            error: "A etapa informada não existe.",
          },
          { status: 400 },
        );
      }

      etapaFinal = etapa;
    }

    let responsavelNome = responsavelNomeRecebido;

    if (responsavelId) {
      const {
        data: responsavel,
        error: responsavelError,
      } = await supabase
        .from("usuarios")
        .select("id, nome, ativo")
        .eq("id", responsavelId)
        .maybeSingle();

      if (responsavelError) {
        console.error(
          "[POST /api/projetos] Erro ao validar responsável:",
          responsavelError,
        );

        return NextResponse.json(
          {
            success: false,
            error: "Erro ao validar o responsável.",
            details: responsavelError.message,
            code: responsavelError.code ?? null,
          },
          { status: 500 },
        );
      }

      if (!responsavel || responsavel.ativo === false) {
        return NextResponse.json(
          {
            success: false,
            error: "O responsável informado não existe ou está inativo.",
          },
          { status: 400 },
        );
      }

      responsavelNome = responsavel.nome;
    } else {
      responsavelNome = null;
    }

    const faseOrigemFinal =
      etapaFinal?.nome ??
      faseOrigemRecebida ??
      null;

    const agora = new Date().toISOString();

    const insertData = {
      cliente_id: clienteId,
      nome,
      plataforma,
      etapa_id: etapaIdFinal,
      setor,
      responsavel_id: responsavelId,
      responsavel_nome: responsavelNome,
      status,
      prioridade,
      data_inicio: dataInicio,
      data_fim: dataFim,
      observacoes,
      fase_origem: faseOrigemFinal,
      percentual,
      updated_at: agora,
    };

    console.log(
      "[POST /api/projetos] INSERT:",
      {
        usuario_id: autorizacao.usuario.usuarioId,
        usuario_nome: autorizacao.usuario.nome,
        perfil: autorizacao.usuario.perfil,
        insertData,
      },
    );

    const {
      data: projetoCriado,
      error: insertError,
    } = await supabase
      .from("projetos")
      .insert(insertData)
      .select("*")
      .single();

    if (insertError) {
      console.error(
        "[POST /api/projetos] Erro ao criar projeto:",
        insertError,
      );

      return NextResponse.json(
        {
          success: false,
          error: insertError.message,
          details: insertError.details ?? null,
          hint: insertError.hint ?? null,
          code: insertError.code ?? null,
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Projeto criado com sucesso.",
        projeto: {
          ...projetoCriado,
          cliente: {
            id: cliente.id,
            nome: cliente.nome,
            cidade: cliente.cidade,
          },
          etapa: etapaFinal,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    unstable_rethrow(error);

    console.error(
      "[POST /api/projetos] Erro inesperado:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Erro inesperado ao criar projeto.",
      },
      { status: 500 },
    );
  }
}
