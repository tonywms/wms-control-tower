import { gerarAlertasExecutivos } from "./alertas-executivos";

type SupabaseLike = any;

type ResultadoSincronizacao = {
  alertas: number;
  usuarios: number;
  notificacoes: number;
  resolvidas: number;
};

type OpcoesSincronizacao = {
  usuarioId?: string | null;
};

/**
 * Sincroniza os alertas executivos com a tabela de notificações.
 *
 * Regras:
 *
 * 1. Alerta continua existindo:
 *    resolvida = false
 *    resolvida_em = null
 *
 * 2. Alerta deixou de existir:
 *    resolvida = true
 *    resolvida_em = agora
 *
 * 3. Alerta resolvido voltou a existir:
 *    resolvida = false
 *    resolvida_em = null
 *
 * "lida" e "resolvida" são estados independentes.
 *
 * Quando usuarioId é informado:
 *   sincroniza somente para aquele usuário.
 *
 * Quando usuarioId não é informado:
 *   sincroniza todos os usuários ativos.
 *   Esse modo fica disponível para cron/rotinas administrativas.
 */
export async function sincronizarNotificacoesExecutivas(
  supabase: SupabaseLike,
  opcoes: OpcoesSincronizacao = {},
): Promise<ResultadoSincronizacao> {
  const alertas = await gerarAlertasExecutivos(supabase);

  let usuariosQuery = supabase
    .from("usuarios")
    .select("id")
    .eq("ativo", true);

  /*
   * Eventos executados por um usuário devem sincronizar
   * notificações somente para esse usuário.
   */
  if (opcoes.usuarioId) {
    usuariosQuery = usuariosQuery.eq(
      "id",
      opcoes.usuarioId,
    );
  }

  const {
    data: usuarios,
    error: usuariosError,
  } = await usuariosQuery;

  if (usuariosError) {
    throw new Error(usuariosError.message);
  }

  const usuariosAtivos: Array<{
    id: string;
  }> = usuarios ?? [];

  if (!usuariosAtivos.length) {
    return {
      alertas: alertas.length,
      usuarios: 0,
      notificacoes: 0,
      resolvidas: 0,
    };
  }

  const agora = new Date().toISOString();

  /*
   * =========================================================
   * 1. GRAVA / ATUALIZA OS ALERTAS QUE EXISTEM AGORA
   * =========================================================
   *
   * Se uma notificação anteriormente resolvida voltar
   * a aparecer como alerta, ela é reativada.
   */
  const payload = usuariosAtivos.flatMap(usuario =>
    alertas.map(alerta => ({
      usuario_id: usuario.id,

      projeto_id:
        alerta.projeto_id || null,

      chave:
        alerta.id,

      tipo:
        alerta.tipo,

      titulo:
        alerta.projeto_nome
          ? `${alerta.projeto_nome} · ${alerta.titulo}`
          : alerta.titulo,

      mensagem:
        alerta.descricao,

      severidade:
        alerta.severidade,

      referencia_tipo:
        "alerta_executivo",

      referencia_id:
        alerta.id,

      resolvida:
        false,

      resolvida_em:
        null,

      updated_at:
        agora,
    })),
  );

  if (payload.length) {
    const { error: upsertError } = await supabase
      .from("notificacoes")
      .upsert(
        payload,
        {
          onConflict:
            "usuario_id,chave",

          ignoreDuplicates:
            false,
        },
      );

    if (upsertError) {
      throw new Error(
        upsertError.message,
      );
    }
  }

  /*
   * =========================================================
   * 2. DESCOBRE QUAIS ALERTAS NÃO EXISTEM MAIS
   * =========================================================
   *
   * Não apagamos a notificação.
   *
   * Ela passa a fazer parte do histórico:
   *
   * resolvida = true
   * resolvida_em = agora
   */
  const chavesAtuais = new Set(
    alertas.map(alerta => alerta.id),
  );

  let totalResolvidas = 0;

  for (const usuario of usuariosAtivos) {
    const {
      data: notificacoesAtivas,
      error: notificacoesError,
    } = await supabase
      .from("notificacoes")
      .select("id,chave")
      .eq("usuario_id", usuario.id)
      .eq(
        "referencia_tipo",
        "alerta_executivo",
      )
      .eq("resolvida", false);

    if (notificacoesError) {
      throw new Error(
        notificacoesError.message,
      );
    }

    const idsParaResolver = (
      notificacoesAtivas ?? []
    )
      .filter(
        (notificacao: {
          id: string;
          chave: string;
        }) =>
          !chavesAtuais.has(
            notificacao.chave,
          ),
      )
      .map(
        (notificacao: {
          id: string;
        }) => notificacao.id,
      );

    if (!idsParaResolver.length) {
      continue;
    }

    const {
      data: resolvidas,
      error: resolverError,
    } = await supabase
      .from("notificacoes")
      .update({
        resolvida: true,
        resolvida_em: agora,
        updated_at: agora,
      })
      .in(
        "id",
        idsParaResolver,
      )
      .select("id");

    if (resolverError) {
      throw new Error(
        resolverError.message,
      );
    }

    totalResolvidas +=
      resolvidas?.length ?? 0;
  }

  return {
    alertas:
      alertas.length,

    usuarios:
      usuariosAtivos.length,

    notificacoes:
      payload.length,

    resolvidas:
      totalResolvidas,
  };
}

/**
 * Wrapper seguro para chamadas disparadas por eventos.
 *
 * Uma falha na sincronização das notificações não pode
 * desfazer a operação principal que originou o evento.
 */
export async function dispararSincronizacaoNotificacoes(
  supabase: SupabaseLike,
  origem: string,
  usuarioId?: string | null,
): Promise<void> {
  try {
    const resultado =
      await sincronizarNotificacoesExecutivas(
        supabase,
        {
          usuarioId,
        },
      );

    console.info(
      "[NOTIFICACOES EVENTO]",
      {
        origem,
        usuarioId:
          usuarioId ?? "GLOBAL",
        ...resultado,
      },
    );
  } catch (error) {
    console.error(
      "[NOTIFICACOES EVENTO]",
      {
        origem,
        usuarioId:
          usuarioId ?? "GLOBAL",

        erro:
          error instanceof Error
            ? error.message
            : "Erro desconhecido ao sincronizar notificações.",
      },
    );
  }
}