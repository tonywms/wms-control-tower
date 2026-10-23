import { createAdminClient } from "@/lib/supabase/admin";

export const DIAS_RETENCAO_NOTIFICACOES = 90;

export type ResultadoRetencaoNotificacoes = {
  excluidas: number;
  limite: string;
  diasRetencao: number;
};

export async function executarRetencaoNotificacoes(): Promise<ResultadoRetencaoNotificacoes> {
  const supabase = createAdminClient();

  const limite = new Date(
    Date.now() -
      DIAS_RETENCAO_NOTIFICACOES *
        24 *
        60 *
        60 *
        1000,
  ).toISOString();

  /*
   * Regra de retenção:
   *
   * 1. Notificações ativas NUNCA são excluídas.
   * 2. Notificações resolvidas permanecem como histórico
   *    durante 90 dias a partir de resolvida_em.
   * 3. Somente notificações resolvidas há mais de 90 dias
   *    são removidas.
   */
  const { data, error } = await supabase
    .from("notificacoes")
    .delete()
    .eq("resolvida", true)
    .not("resolvida_em", "is", null)
    .lt("resolvida_em", limite)
    .select("id");

  if (error) {
    throw new Error(
      `Falha na retenção das notificações: ${error.message}`,
    );
  }

  return {
    excluidas: data?.length ?? 0,
    limite,
    diasRetencao: DIAS_RETENCAO_NOTIFICACOES,
  };
}