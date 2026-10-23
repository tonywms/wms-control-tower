-- ============================================================
-- WMS EXPERT CONTROL TOWER
-- Migration 003 - Functions, RLS e Policies
-- Baseline consolidada em 23/10/2026
-- ============================================================

-- ============================================================
-- FUNÇÕES DE CONTROLE DE ACESSO
-- ============================================================

CREATE OR REPLACE FUNCTION public.control_tower_perfil()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
    SELECT UPPER(TRIM(u.perfil))
    FROM public.usuarios u
    WHERE u.auth_user_id = auth.uid()
      AND u.ativo = true
    LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.control_tower_pode(p_permissao text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
    SELECT CASE public.control_tower_perfil()
        WHEN 'CEO' THEN true
        WHEN 'DIRETORIA' THEN true
        WHEN 'P&D' THEN p_permissao IN ('visualizar','editar','alterar_status','excluir')
        WHEN 'DESENVOLVIMENTO' THEN p_permissao IN ('visualizar','editar','alterar_status')
        WHEN 'IMPLANTAÇÃO' THEN p_permissao IN ('visualizar','editar','alterar_status')
        WHEN 'SUPORTE' THEN p_permissao IN ('visualizar','editar','alterar_status')
        WHEN 'COMERCIAL' THEN p_permissao IN ('visualizar','editar')
        WHEN 'VISUALIZAÇÃO' THEN p_permissao = 'visualizar'
        ELSE false
    END;
$function$;

-- ============================================================
-- FUNÇÕES AUXILIARES
-- ============================================================

CREATE OR REPLACE FUNCTION public.atualizar_clientes_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$function$;

-- ============================================================
-- ALTERAÇÃO DE STATUS DO PROJETO
-- ============================================================

CREATE OR REPLACE FUNCTION public.alterar_status_projeto(
    p_projeto_id uuid,
    p_novo_status text,
    p_motivo text DEFAULT NULL::text,
    p_usuario_id uuid DEFAULT NULL::uuid,
    p_usuario_nome text DEFAULT 'Sistema'::text
)
RETURNS public.projetos
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_projeto public.projetos;
    v_status_anterior text;
    v_agora timestamptz := now();
    v_usuario_id uuid;
BEGIN
    SELECT *
    INTO v_projeto
    FROM public.projetos
    WHERE id = p_projeto_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Projeto não encontrado.';
    END IF;

    IF p_novo_status NOT IN (
        'Não iniciado',
        'Planejado',
        'Em andamento',
        'Pausado',
        'Bloqueado',
        'Finalizado',
        'Cancelado'
    ) THEN
        RAISE EXCEPTION 'Status inválido: %', p_novo_status;
    END IF;

    v_usuario_id := p_usuario_id;

    IF v_usuario_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1
            FROM public.usuarios
            WHERE id = v_usuario_id
              AND ativo = true
        ) THEN
            RAISE EXCEPTION
                'Usuário interno não encontrado ou inativo: %',
                v_usuario_id;
        END IF;
    END IF;

    v_status_anterior := v_projeto.status;

    IF v_status_anterior = p_novo_status THEN
        RETURN v_projeto;
    END IF;

    UPDATE public.projetos
    SET
        status = p_novo_status,
        updated_at = v_agora,

        started_at =
            CASE
                WHEN p_novo_status = 'Em andamento'
                     AND started_at IS NULL
                THEN v_agora
                ELSE started_at
            END,

        started_by =
            CASE
                WHEN p_novo_status = 'Em andamento'
                     AND started_at IS NULL
                THEN v_usuario_id
                ELSE started_by
            END,

        paused_at =
            CASE
                WHEN p_novo_status = 'Pausado'
                THEN v_agora
                ELSE paused_at
            END,

        pausa_motivo =
            CASE
                WHEN p_novo_status = 'Pausado'
                THEN NULLIF(TRIM(p_motivo), '')
                ELSE pausa_motivo
            END,

        finished_at =
            CASE
                WHEN p_novo_status = 'Finalizado'
                THEN v_agora
                WHEN p_novo_status <> 'Finalizado'
                THEN NULL
                ELSE finished_at
            END,

        finished_by =
            CASE
                WHEN p_novo_status = 'Finalizado'
                THEN v_usuario_id
                WHEN p_novo_status <> 'Finalizado'
                THEN NULL
                ELSE finished_by
            END,

        percentual =
            CASE
                WHEN p_novo_status = 'Finalizado'
                THEN 100
                ELSE percentual
            END

    WHERE id = p_projeto_id
    RETURNING *
    INTO v_projeto;

    INSERT INTO public.historico_status (
        projeto_id,
        status_anterior,
        status_novo,
        motivo,
        usuario_id,
        usuario_nome,
        created_at
    )
    VALUES (
        p_projeto_id,
        v_status_anterior,
        p_novo_status,
        NULLIF(TRIM(p_motivo), ''),
        v_usuario_id,
        p_usuario_nome,
        v_agora
    );

    RETURN v_projeto;
END;
$function$;

-- ============================================================
-- RLS
-- Todas as 18 tabelas possuem RLS ativo no banco atual.
-- ============================================================

ALTER TABLE public.acoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comentarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.etapas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historico_clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historico_projeto ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historico_saneamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historico_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pendencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plano_semana_execucoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plano_semana_historico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projeto_acoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projeto_etapas_historico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projeto_marcos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projeto_pendencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projetos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- POLICIES
-- ============================================================

CREATE POLICY ct_acoes_select
ON public.acoes
FOR SELECT TO authenticated
USING (public.control_tower_pode('visualizar'::text));

CREATE POLICY ct_clientes_select
ON public.clientes
FOR SELECT TO authenticated
USING (true);

CREATE POLICY ct_comentarios_insert
ON public.comentarios
FOR INSERT TO authenticated
WITH CHECK (public.control_tower_pode('editar'::text));

CREATE POLICY ct_comentarios_select
ON public.comentarios
FOR SELECT TO authenticated
USING (public.control_tower_pode('visualizar'::text));

CREATE POLICY ct_etapas_select
ON public.etapas
FOR SELECT TO authenticated
USING (true);

CREATE POLICY ct_historico_insert
ON public.historico_status
FOR INSERT TO authenticated
WITH CHECK (
    public.control_tower_pode('alterar_status'::text)
    OR public.control_tower_pode('editar'::text)
);

CREATE POLICY ct_historico_select
ON public.historico_status
FOR SELECT TO authenticated
USING (public.control_tower_pode('visualizar'::text));

CREATE POLICY ct_pendencias_select
ON public.pendencias
FOR SELECT TO authenticated
USING (public.control_tower_pode('visualizar'::text));

CREATE POLICY ct_projeto_etapas_historico_select
ON public.projeto_etapas_historico
FOR SELECT TO authenticated
USING (public.control_tower_pode('visualizar'::text));

CREATE POLICY ct_projetos_delete
ON public.projetos
FOR DELETE TO authenticated
USING (public.control_tower_pode('excluir'::text));

CREATE POLICY ct_projetos_insert
ON public.projetos
FOR INSERT TO authenticated
WITH CHECK (public.control_tower_pode('editar'::text));

CREATE POLICY ct_projetos_select
ON public.projetos
FOR SELECT TO authenticated
USING (public.control_tower_pode('visualizar'::text));

CREATE POLICY ct_projetos_update
ON public.projetos
FOR UPDATE TO authenticated
USING (public.control_tower_pode('editar'::text))
WITH CHECK (public.control_tower_pode('editar'::text));

CREATE POLICY ct_usuarios_select
ON public.usuarios
FOR SELECT TO authenticated
USING (ativo = true);

CREATE POLICY historico_projeto_insert
ON public.historico_projeto
FOR INSERT TO authenticated
WITH CHECK (public.control_tower_pode('editar'::text));

CREATE POLICY historico_projeto_select
ON public.historico_projeto
FOR SELECT TO authenticated
USING (public.control_tower_pode('visualizar'::text));

CREATE POLICY historico_saneamento_insert_authenticated
ON public.historico_saneamento
FOR INSERT TO authenticated
WITH CHECK (public.control_tower_pode('editar'::text));

CREATE POLICY historico_saneamento_select_authenticated
ON public.historico_saneamento
FOR SELECT TO authenticated
USING (public.control_tower_pode('visualizar'::text));

CREATE POLICY notificacoes_select_proprias
ON public.notificacoes
FOR SELECT TO authenticated
USING (
    usuario_id IN (
        SELECT usuarios.id
        FROM public.usuarios
        WHERE usuarios.auth_user_id = auth.uid()
          AND usuarios.ativo = true
    )
);

CREATE POLICY notificacoes_update_proprias
ON public.notificacoes
FOR UPDATE TO authenticated
USING (
    usuario_id IN (
        SELECT usuarios.id
        FROM public.usuarios
        WHERE usuarios.auth_user_id = auth.uid()
          AND usuarios.ativo = true
    )
)
WITH CHECK (
    usuario_id IN (
        SELECT usuarios.id
        FROM public.usuarios
        WHERE usuarios.auth_user_id = auth.uid()
          AND usuarios.ativo = true
    )
);

CREATE POLICY plano_semana_historico_select_authenticated
ON public.plano_semana_historico
FOR SELECT TO authenticated
USING (public.control_tower_pode('visualizar'::text));

CREATE POLICY projeto_acoes_delete
ON public.projeto_acoes
FOR DELETE TO authenticated
USING (public.control_tower_pode('excluir'::text));

CREATE POLICY projeto_acoes_insert
ON public.projeto_acoes
FOR INSERT TO authenticated
WITH CHECK (public.control_tower_pode('editar'::text));

CREATE POLICY projeto_acoes_select
ON public.projeto_acoes
FOR SELECT TO authenticated
USING (public.control_tower_pode('visualizar'::text));

CREATE POLICY projeto_acoes_update
ON public.projeto_acoes
FOR UPDATE TO authenticated
USING (public.control_tower_pode('editar'::text))
WITH CHECK (public.control_tower_pode('editar'::text));

CREATE POLICY projeto_marcos_delete
ON public.projeto_marcos
FOR DELETE TO authenticated
USING (public.control_tower_pode('excluir'::text));

CREATE POLICY projeto_marcos_insert
ON public.projeto_marcos
FOR INSERT TO authenticated
WITH CHECK (public.control_tower_pode('editar'::text));

CREATE POLICY projeto_marcos_select
ON public.projeto_marcos
FOR SELECT TO authenticated
USING (public.control_tower_pode('visualizar'::text));

CREATE POLICY projeto_marcos_update
ON public.projeto_marcos
FOR UPDATE TO authenticated
USING (public.control_tower_pode('editar'::text))
WITH CHECK (public.control_tower_pode('editar'::text));

CREATE POLICY projeto_pendencias_delete
ON public.projeto_pendencias
FOR DELETE TO authenticated
USING (public.control_tower_pode('excluir'::text));

CREATE POLICY projeto_pendencias_insert
ON public.projeto_pendencias
FOR INSERT TO authenticated
WITH CHECK (public.control_tower_pode('editar'::text));

CREATE POLICY projeto_pendencias_select
ON public.projeto_pendencias
FOR SELECT TO authenticated
USING (public.control_tower_pode('visualizar'::text));

CREATE POLICY projeto_pendencias_update
ON public.projeto_pendencias
FOR UPDATE TO authenticated
USING (public.control_tower_pode('editar'::text))
WITH CHECK (public.control_tower_pode('editar'::text));

-- Fim da migration 003.
