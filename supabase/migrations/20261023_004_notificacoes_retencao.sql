-- ============================================================
-- WMS EXPERT CONTROL TOWER
-- Migration 004 - Retenção e histórico de notificações
-- Consolidada em 23/10/2026
--
-- Política:
-- - notificações ativas permanecem com resolvida = false
-- - notificações encerradas recebem resolvida = true
-- - resolvida_em registra quando o alerta deixou de estar ativo
-- - lida e resolvida são estados independentes
-- - histórico resolvido é mantido por 90 dias pela aplicação/cron
--
-- Esta migration é idempotente porque a baseline 001 já representa
-- o estado atual do banco e contém essas colunas.
-- ============================================================

ALTER TABLE public.notificacoes
    ADD COLUMN IF NOT EXISTS resolvida boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS resolvida_em timestamptz NULL;

CREATE INDEX IF NOT EXISTS idx_notificacoes_usuario_resolvida
    ON public.notificacoes USING btree (usuario_id, resolvida);

CREATE INDEX IF NOT EXISTS idx_notificacoes_retencao
    ON public.notificacoes USING btree (resolvida, resolvida_em);

COMMENT ON COLUMN public.notificacoes.resolvida IS
    'Indica se o alerta executivo deixou de estar ativo. Independente do estado de leitura.';

COMMENT ON COLUMN public.notificacoes.resolvida_em IS
    'Data/hora em que a notificação foi marcada como resolvida. Usada pela política de retenção de 90 dias.';

-- A exclusão física após 90 dias é executada pela rotina server-side
-- de retenção do Control Tower, não por trigger no banco.

-- Fim da migration 004.
