import { gerarAlertasExecutivos } from "./alertas-executivos";

type SupabaseLike = any;

type ResultadoSincronizacao = {
  alertas: number;
  usuarios: number;
  notificacoes: number;
};

export async function sincronizarNotificacoesExecutivas(
  supabase: SupabaseLike,
): Promise<ResultadoSincronizacao> {
  const alertas = await gerarAlertasExecutivos(supabase);

  if (!alertas.length) {
    return {
      alertas: 0,
      usuarios: 0,
      notificacoes: 0,
    };
  }

  // Somente usuários ativos com acesso ao Control Tower.
  const { data: usuarios, error: usuariosError } = await supabase
    .from("usuarios")
    .select("id")
    .eq("ativo", true);

  if (usuariosError) {
    throw new Error(usuariosError.message);
  }

  const usuariosAtivos: Array<{ id: string }> = usuarios ?? [];

  if (!usuariosAtivos.length) {
    return {
      alertas: alertas.length,
      usuarios: 0,
      notificacoes: 0,
    };
  }

  const agora = new Date().toISOString();

  const payload = usuariosAtivos.flatMap(usuario =>
    alertas.map(alerta => ({
      usuario_id: usuario.id,
      projeto_id: alerta.projeto_id || null,
      chave: alerta.id,
      tipo: alerta.tipo,
      titulo: alerta.projeto_nome
        ? `${alerta.projeto_nome} · ${alerta.titulo}`
        : alerta.titulo,
      mensagem: alerta.descricao,
      severidade: alerta.severidade,
      referencia_tipo: "alerta_executivo",
      referencia_id: alerta.id,
      updated_at: agora,
    })),
  );

  const { error } = await supabase
    .from("notificacoes")
    .upsert(payload, {
      onConflict: "usuario_id,chave",
      ignoreDuplicates: false,
    });

  if (error) {
    throw new Error(error.message);
  }

  return {
    alertas: alertas.length,
    usuarios: usuariosAtivos.length,
    notificacoes: payload.length,
  };
}

export async function dispararSincronizacaoNotificacoes(
  supabase: SupabaseLike,
  origem: string,
): Promise<void> {
  try {
    const resultado = await sincronizarNotificacoesExecutivas(supabase);

    console.info("[NOTIFICACOES EVENTO]", {
      origem,
      ...resultado,
    });
  } catch (error) {
    console.error("[NOTIFICACOES EVENTO]", {
      origem,
      erro:
        error instanceof Error
          ? error.message
          : "Erro desconhecido ao sincronizar notificações.",
    });
  }
}