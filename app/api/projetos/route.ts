import { NextResponse } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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

export async function GET() {
  try {
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
      {
        status: 200,
      },
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
      {
        status: 500,
      },
    );
  }
}
