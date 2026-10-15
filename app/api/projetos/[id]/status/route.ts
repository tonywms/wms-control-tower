import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getCurrentUserContext,
  requirePermission,
} from "@/lib/auth/permissions";

const STATUS_VALIDOS = [
  "Não iniciado",
  "Planejado",
  "Em andamento",
  "Pausado",
  "Bloqueado",
  "Finalizado",
  "Cancelado",
] as const;

type StatusValido = (typeof STATUS_VALIDOS)[number];

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(
  request: Request,
  context: RouteContext,
) {
  try {
    /*
     * ============================================================
     * 1. ID DO PROJETO
     * ============================================================
     */

    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: "ID do projeto não informado.",
        },
        { status: 400 },
      );
    }

    /*
     * ============================================================
     * 2. PERMISSÃO
     * ============================================================
     */

    const permissao = await requirePermission(
      "alterar_status",
    );

    if (!permissao.ok) {
      return NextResponse.json(
        {
          success: false,
          error: permissao.error,
        },
        {
          status: permissao.status,
        },
      );
    }

    /*
     * ============================================================
     * 3. USUÁRIO AUTENTICADO
     * ============================================================
     *
     * Existem DOIS UUIDs diferentes:
     *
     * authUserId
     * -> UUID do Supabase Auth
     *
     * usuarioId
     * -> UUID interno da tabela public.usuarios
     *
     * As FKs:
     *
     * projetos.started_by
     * projetos.finished_by
     * historico_status.usuario_id
     *
     * usam o ID interno de public.usuarios.
     *
     * Portanto:
     *
     * NUNCA enviar authUserId para a RPC.
     * ============================================================
     */

    const usuarioAtual =
      await getCurrentUserContext();

    if (!usuarioAtual) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Usuário autenticado não possui registro ativo na tabela usuarios.",
        },
        { status: 401 },
      );
    }

    /*
     * ============================================================
     * 4. BODY
     * ============================================================
     */

    let body: {
      status?: unknown;
      motivo?: unknown;
    };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "Corpo da requisição inválido.",
        },
        { status: 400 },
      );
    }

    const status =
      typeof body.status === "string"
        ? body.status.trim()
        : "";

    const motivo =
      typeof body.motivo === "string"
        ? body.motivo.trim()
        : "";

    /*
     * ============================================================
     * 5. VALIDAR STATUS
     * ============================================================
     */

    if (
      !STATUS_VALIDOS.includes(
        status as StatusValido,
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error: `Status inválido: ${status}`,
          statusValidos: STATUS_VALIDOS,
        },
        { status: 400 },
      );
    }

    /*
     * ============================================================
     * 6. VALIDAR MOTIVO
     * ============================================================
     *
     * Pausado, Bloqueado e Cancelado exigem justificativa.
     * ============================================================
     */

    if (
      status === "Pausado" &&
      !motivo
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Informe o motivo para pausar o projeto.",
        },
        { status: 400 },
      );
    }

    if (
      status === "Bloqueado" &&
      !motivo
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Informe o motivo para bloquear o projeto.",
        },
        { status: 400 },
      );
    }

    if (
      status === "Cancelado" &&
      !motivo
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Informe o motivo para cancelar o projeto.",
        },
        { status: 400 },
      );
    }

    /*
     * ============================================================
     * 7. SUPABASE
     * ============================================================
     */

    const supabase =
      await createClient();

    /*
     * ============================================================
     * 8. BUSCAR USUÁRIO INTERNO
     * ============================================================
     *
     * Fazemos uma nova consulta diretamente na tabela usuarios.
     *
     * auth_user_id:
     *     5a83fc0e-d2d7-4eda-b000-f8866d4cf093
     *
     * usuarios.id:
     *     3214c1e1-5a13-44a0-b4c6-24220ebb4598
     *
     * É O SEGUNDO que deve ser enviado para a RPC.
     * ============================================================
     */

    const {
      data: usuarioBanco,
      error: usuarioBancoError,
    } = await supabase
      .from("usuarios")
      .select(
        "id, auth_user_id, nome, perfil, ativo",
      )
      .eq(
        "auth_user_id",
        usuarioAtual.authUserId,
      )
      .eq("ativo", true)
      .maybeSingle();

    if (usuarioBancoError) {
      console.error(
        "[PATCH /api/projetos/:id/status] Erro ao buscar usuário interno:",
        usuarioBancoError,
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Não foi possível identificar o usuário interno do Control Tower.",
          details:
            usuarioBancoError.message,
        },
        { status: 500 },
      );
    }

    if (!usuarioBanco) {
      return NextResponse.json(
        {
          success: false,
          error:
            "O usuário autenticado não possui registro ativo na tabela usuarios.",
        },
        { status: 403 },
      );
    }

    /*
     * ============================================================
     * 9. ID INTERNO DO USUÁRIO
     * ============================================================
     *
     * ESTE É O PONTO MAIS IMPORTANTE.
     *
     * usuarioBanco.id
     *
     * é obrigatoriamente:
     *
     * public.usuarios.id
     *
     * NÃO usar:
     *
     * usuarioBanco.auth_user_id
     * usuarioAtual.authUserId
     *
     * ============================================================
     */

    const usuarioIdInterno =
      usuarioBanco.id;

    /*
     * ============================================================
     * 10. VALIDAÇÃO EXTRA DE SEGURANÇA
     * ============================================================
     *
     * Impede que um Auth UUID seja acidentalmente enviado
     * para a RPC.
     *
     * Isso também facilita identificar imediatamente qualquer
     * problema futuro no relacionamento dos usuários.
     * ============================================================
     */

    if (
      !usuarioIdInterno ||
      usuarioIdInterno ===
        usuarioAtual.authUserId
    ) {
      console.error(
        "[PATCH /api/projetos/:id/status] ID interno inválido:",
        {
          usuarioIdInterno,
          authUserId:
            usuarioAtual.authUserId,
          usuarioBanco,
        },
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "O ID interno do usuário é inválido. O Control Tower não pode utilizar o UUID do Supabase Auth nas FKs de projetos.",
        },
        { status: 500 },
      );
    }

    /*
     * ============================================================
     * 11. LOG TEMPORÁRIO DE DIAGNÓSTICO
     * ============================================================
     *
     * IMPORTANTE:
     *
     * Se o Kanban ainda apresentar erro, o terminal deverá mostrar:
     *
     * authUserId:
     * 5a83fc0e-...
     *
     * usuarioId:
     * 3214c1e1-...
     *
     * p_usuario_id:
     * 3214c1e1-...
     *
     * ============================================================
     */

    console.log(
      "[PATCH /api/projetos/:id/status] Usuário autenticado:",
      {
        authUserId:
          usuarioAtual.authUserId,
        usuarioId:
          usuarioAtual.usuarioId,
        usuarioBancoId:
          usuarioBanco.id,
        usuarioBancoAuthId:
          usuarioBanco.auth_user_id,
        nome:
          usuarioBanco.nome,
        perfil:
          usuarioBanco.perfil,
      },
    );

    /*
     * ============================================================
     * 12. CHAMAR RPC
     * ============================================================
     */

    console.log(
      "[PATCH /api/projetos/:id/status] Enviando RPC:",
      {
        p_projeto_id: id,
        p_novo_status: status,
        p_motivo: motivo || null,

        /*
         * CORRETO:
         *
         * usuarios.id
         *
         * NUNCA auth_user_id.
         */
        p_usuario_id:
          usuarioIdInterno,

        p_usuario_nome:
          usuarioBanco.nome,
      },
    );

    const {
      data,
      error,
    } = await supabase.rpc(
      "alterar_status_projeto",
      {
        p_projeto_id: id,

        p_novo_status: status,

        p_motivo:
          motivo || null,

        /*
         * ========================================================
         * MUITO IMPORTANTE
         *
         * Aqui enviamos:
         *
         * usuarioBanco.id
         *
         * que é public.usuarios.id.
         *
         * NÃO enviamos:
         *
         * usuarioAtual.authUserId
         * usuarioBanco.auth_user_id
         * ========================================================
         */
        p_usuario_id:
          usuarioIdInterno,

        p_usuario_nome:
          usuarioBanco.nome,
      },
    );

    /*
     * ============================================================
     * 13. ERRO DA RPC
     * ============================================================
     */

    if (error) {
      console.error(
        "[PATCH /api/projetos/:id/status] Erro ao alterar status:",
        {
          error,
          usuarioIdInterno,
          authUserId:
            usuarioAtual.authUserId,
          projetoId: id,
          status,
        },
      );

      return NextResponse.json(
        {
          success: false,
          error: error.message,
          details:
            error.details ?? null,
          hint:
            error.hint ?? null,
          code:
            error.code ?? null,
        },
        { status: 500 },
      );
    }

    /*
     * ============================================================
     * 14. RETORNO
     * ============================================================
     */

    return NextResponse.json({
      success: true,

      message:
        `Projeto atualizado para "${status}".`,

      projeto: data,

      usuario: {
        id: usuarioBanco.id,
        authUserId:
          usuarioBanco.auth_user_id,
        nome: usuarioBanco.nome,
        perfil:
          usuarioBanco.perfil,
      },
    });
  } catch (error) {
    /*
     * ============================================================
     * 15. ERRO INESPERADO
     * ============================================================
     */

    console.error(
      "[PATCH /api/projetos/:id/status] Erro inesperado:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Erro inesperado ao alterar status.",
      },
      { status: 500 },
    );
  }
}