-- ============================================================
-- WMS EXPERT CONTROL TOWER
-- Migration 001 - Schema base
-- Baseline consolidada em 23/10/2026
-- ============================================================

CREATE TABLE public.clientes (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    nome text NOT NULL,
    cidade text,
    observacoes text,
    ativo boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    sistema text
);

CREATE TABLE public.etapas (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    nome text NOT NULL,
    ordem integer NOT NULL,
    ativo boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    descricao text,
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.usuarios (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    auth_user_id uuid,
    nome text NOT NULL,
    email text,
    cargo text,
    setor text,
    perfil text NOT NULL DEFAULT 'Visualização'::text,
    ativo boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.projetos (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    cliente_id uuid NOT NULL,
    nome text NOT NULL,
    plataforma text,
    etapa_id uuid,
    setor text,
    responsavel_id uuid,
    responsavel_nome text,
    status text NOT NULL DEFAULT 'Não iniciado'::text,
    prioridade text NOT NULL DEFAULT 'Normal'::text,
    data_inicio date,
    data_fim date,
    observacoes text,
    fase_origem text,
    percentual integer NOT NULL DEFAULT 0,
    started_at timestamptz,
    started_by uuid,
    paused_at timestamptz,
    paused_by uuid,
    pausa_motivo text,
    finished_at timestamptz,
    finished_by uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.historico_status (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    projeto_id uuid NOT NULL,
    status_anterior text,
    status_novo text NOT NULL,
    motivo text,
    usuario_id uuid,
    usuario_nome text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.projeto_etapas_historico (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    projeto_id uuid NOT NULL,
    etapa_anterior_id uuid,
    etapa_nova_id uuid,
    usuario_id uuid,
    usuario_nome text,
    observacao text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.acoes (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    projeto_id uuid,
    titulo text NOT NULL,
    descricao text,
    responsavel_id uuid,
    responsavel_nome text,
    status text NOT NULL DEFAULT 'Pendente'::text,
    prioridade text NOT NULL DEFAULT 'Normal'::text,
    data_limite date,
    concluida_em timestamptz,
    created_by uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.pendencias (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    projeto_id uuid,
    titulo text NOT NULL,
    descricao text,
    tipo text NOT NULL DEFAULT 'Pendência'::text,
    status text NOT NULL DEFAULT 'Aberta'::text,
    responsavel_id uuid,
    responsavel_nome text,
    prioridade text NOT NULL DEFAULT 'Normal'::text,
    data_limite date,
    resolvida_em timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.comentarios (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    projeto_id uuid,
    usuario_id uuid,
    usuario_nome text,
    comentario text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.historico_clientes (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    cliente_id uuid NOT NULL,
    acao text NOT NULL,
    descricao text,
    usuario_id uuid,
    usuario_nome text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.historico_projeto (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    projeto_id uuid NOT NULL,
    campo text NOT NULL,
    valor_anterior text,
    valor_novo text,
    usuario_id uuid,
    usuario_nome text NOT NULL DEFAULT 'Sistema'::text,
    origem text NOT NULL DEFAULT 'edicao'::text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.historico_saneamento (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    projeto_id uuid NOT NULL,
    inconsistencia_id text,
    referencia_id uuid,
    item_tipo text NOT NULL,
    categoria text NOT NULL,
    severidade text NOT NULL,
    titulo text NOT NULL,
    descricao text,
    recomendacao text,
    operacao text NOT NULL,
    campo_alterado text NOT NULL,
    valor_anterior text,
    valor_novo text,
    usuario_id uuid,
    usuario_nome text NOT NULL DEFAULT 'Sistema'::text,
    saneado_em timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.notificacoes (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    usuario_id uuid NOT NULL,
    projeto_id uuid,
    chave text NOT NULL,
    tipo text NOT NULL,
    titulo text NOT NULL,
    mensagem text NOT NULL,
    severidade text NOT NULL,
    referencia_tipo text,
    referencia_id text,
    lida boolean NOT NULL DEFAULT false,
    lida_em timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    resolvida boolean NOT NULL DEFAULT false,
    resolvida_em timestamptz
);

CREATE TABLE public.plano_semana_execucoes (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    tipo_execucao text NOT NULL,
    origem text NOT NULL,
    inicio_semana date,
    fim_semana date,
    status_semana text,
    semanas_fechadas integer NOT NULL DEFAULT 0,
    sucesso boolean NOT NULL DEFAULT true,
    mensagem text,
    erro text,
    detalhes jsonb NOT NULL DEFAULT '{}'::jsonb,
    iniciado_em timestamptz NOT NULL DEFAULT now(),
    finalizado_em timestamptz
);

CREATE TABLE public.plano_semana_historico (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    inicio_semana date NOT NULL,
    fim_semana date NOT NULL,
    status_fechamento text NOT NULL DEFAULT 'Parcial'::text,
    planejadas integer NOT NULL DEFAULT 0,
    concluidas integer NOT NULL DEFAULT 0,
    pendentes integer NOT NULL DEFAULT 0,
    atrasadas integer NOT NULL DEFAULT 0,
    percentual_execucao integer NOT NULL DEFAULT 0,
    percentual_risco integer NOT NULL DEFAULT 0,
    responsaveis jsonb NOT NULL DEFAULT '[]'::jsonb,
    registrado_por uuid,
    registrado_por_nome text,
    registrado_em timestamptz NOT NULL DEFAULT now(),
    atualizado_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.projeto_acoes (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    projeto_id uuid NOT NULL,
    titulo varchar NOT NULL,
    descricao text,
    prioridade varchar NOT NULL DEFAULT 'Normal'::varchar,
    status varchar NOT NULL DEFAULT 'Pendente'::varchar,
    responsavel_id uuid,
    prazo date,
    concluida_em timestamptz,
    ordem integer NOT NULL DEFAULT 0,
    criado_por uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.projeto_marcos (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    projeto_id uuid NOT NULL,
    nome varchar NOT NULL,
    descricao text,
    status varchar NOT NULL DEFAULT 'Previsto'::varchar,
    responsavel_id uuid,
    data_prevista date,
    data_realizada date,
    ordem integer NOT NULL DEFAULT 0,
    criado_por uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.projeto_pendencias (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    projeto_id uuid NOT NULL,
    titulo varchar NOT NULL,
    descricao text,
    tipo varchar NOT NULL DEFAULT 'Pendência'::varchar,
    prioridade varchar NOT NULL DEFAULT 'Normal'::varchar,
    status varchar NOT NULL DEFAULT 'Pendente'::varchar,
    responsavel_id uuid,
    prazo date,
    concluida_em timestamptz,
    criado_por uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Fim da migration 001.
-- Constraints, FKs, UNIQUEs, CHECKs e índices são definidos na 002.
