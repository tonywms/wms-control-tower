-- ============================================================
-- WMS EXPERT CONTROL TOWER
-- Migration 002 - Constraints e índices
-- Baseline consolidada em 23/10/2026
-- ============================================================

-- ============================================================
-- PRIMARY KEYS
-- ============================================================

ALTER TABLE public.acoes ADD CONSTRAINT acoes_pkey PRIMARY KEY (id);
ALTER TABLE public.clientes ADD CONSTRAINT clientes_pkey PRIMARY KEY (id);
ALTER TABLE public.comentarios ADD CONSTRAINT comentarios_pkey PRIMARY KEY (id);
ALTER TABLE public.etapas ADD CONSTRAINT etapas_pkey PRIMARY KEY (id);
ALTER TABLE public.historico_clientes ADD CONSTRAINT historico_clientes_pkey PRIMARY KEY (id);
ALTER TABLE public.historico_projeto ADD CONSTRAINT historico_projeto_pkey PRIMARY KEY (id);
ALTER TABLE public.historico_saneamento ADD CONSTRAINT historico_saneamento_pkey PRIMARY KEY (id);
ALTER TABLE public.historico_status ADD CONSTRAINT historico_status_pkey PRIMARY KEY (id);
ALTER TABLE public.notificacoes ADD CONSTRAINT notificacoes_pkey PRIMARY KEY (id);
ALTER TABLE public.pendencias ADD CONSTRAINT pendencias_pkey PRIMARY KEY (id);
ALTER TABLE public.plano_semana_execucoes ADD CONSTRAINT plano_semana_execucoes_pkey PRIMARY KEY (id);
ALTER TABLE public.plano_semana_historico ADD CONSTRAINT plano_semana_historico_pkey PRIMARY KEY (id);
ALTER TABLE public.projeto_acoes ADD CONSTRAINT projeto_acoes_pkey PRIMARY KEY (id);
ALTER TABLE public.projeto_etapas_historico ADD CONSTRAINT projeto_etapas_historico_pkey PRIMARY KEY (id);
ALTER TABLE public.projeto_marcos ADD CONSTRAINT projeto_marcos_pkey PRIMARY KEY (id);
ALTER TABLE public.projeto_pendencias ADD CONSTRAINT projeto_pendencias_pkey PRIMARY KEY (id);
ALTER TABLE public.projetos ADD CONSTRAINT projetos_pkey PRIMARY KEY (id);
ALTER TABLE public.usuarios ADD CONSTRAINT usuarios_pkey PRIMARY KEY (id);

-- ============================================================
-- UNIQUE CONSTRAINTS
-- ============================================================

ALTER TABLE public.etapas ADD CONSTRAINT etapas_nome_key UNIQUE (nome);
ALTER TABLE public.etapas ADD CONSTRAINT etapas_ordem_key UNIQUE (ordem);
ALTER TABLE public.usuarios ADD CONSTRAINT usuarios_auth_user_id_key UNIQUE (auth_user_id);
ALTER TABLE public.notificacoes ADD CONSTRAINT notificacoes_usuario_chave_unique UNIQUE (usuario_id, chave);
ALTER TABLE public.plano_semana_historico ADD CONSTRAINT plano_semana_historico_periodo_uk UNIQUE (inicio_semana, fim_semana);

-- ============================================================

-- ============================================================
-- FOREIGN KEYS
-- ============================================================

ALTER TABLE public.acoes ADD CONSTRAINT acoes_created_by_fkey
FOREIGN KEY (created_by) REFERENCES public.usuarios(id) ON DELETE SET NULL;

ALTER TABLE public.acoes ADD CONSTRAINT acoes_projeto_id_fkey
FOREIGN KEY (projeto_id) REFERENCES public.projetos(id) ON DELETE CASCADE;

ALTER TABLE public.acoes ADD CONSTRAINT acoes_responsavel_id_fkey
FOREIGN KEY (responsavel_id) REFERENCES public.usuarios(id) ON DELETE SET NULL;

ALTER TABLE public.comentarios ADD CONSTRAINT comentarios_projeto_id_fkey
FOREIGN KEY (projeto_id) REFERENCES public.projetos(id) ON DELETE CASCADE;

ALTER TABLE public.comentarios ADD CONSTRAINT comentarios_usuario_id_fkey
FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE SET NULL;

ALTER TABLE public.historico_clientes ADD CONSTRAINT historico_clientes_cliente_id_fkey
FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE CASCADE;

ALTER TABLE public.historico_projeto ADD CONSTRAINT historico_projeto_projeto_id_fkey
FOREIGN KEY (projeto_id) REFERENCES public.projetos(id) ON DELETE CASCADE;

ALTER TABLE public.historico_projeto ADD CONSTRAINT historico_projeto_usuario_id_fkey
FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE SET NULL;

ALTER TABLE public.historico_saneamento ADD CONSTRAINT historico_saneamento_projeto_id_fkey
FOREIGN KEY (projeto_id) REFERENCES public.projetos(id) ON DELETE CASCADE;

ALTER TABLE public.historico_status ADD CONSTRAINT historico_status_projeto_id_fkey
FOREIGN KEY (projeto_id) REFERENCES public.projetos(id) ON DELETE CASCADE;

ALTER TABLE public.historico_status ADD CONSTRAINT historico_status_usuario_id_fkey
FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE SET NULL;

ALTER TABLE public.notificacoes ADD CONSTRAINT notificacoes_projeto_id_fkey
FOREIGN KEY (projeto_id) REFERENCES public.projetos(id) ON DELETE CASCADE;

ALTER TABLE public.notificacoes ADD CONSTRAINT notificacoes_usuario_id_fkey
FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;

ALTER TABLE public.pendencias ADD CONSTRAINT pendencias_projeto_id_fkey
FOREIGN KEY (projeto_id) REFERENCES public.projetos(id) ON DELETE CASCADE;

ALTER TABLE public.pendencias ADD CONSTRAINT pendencias_responsavel_id_fkey
FOREIGN KEY (responsavel_id) REFERENCES public.usuarios(id) ON DELETE SET NULL;

ALTER TABLE public.plano_semana_historico ADD CONSTRAINT plano_semana_historico_registrado_por_fkey
FOREIGN KEY (registrado_por) REFERENCES public.usuarios(id) ON DELETE SET NULL;

ALTER TABLE public.projeto_acoes ADD CONSTRAINT projeto_acoes_criado_por_fkey
FOREIGN KEY (criado_por) REFERENCES public.usuarios(id) ON DELETE SET NULL;

ALTER TABLE public.projeto_acoes ADD CONSTRAINT projeto_acoes_projeto_id_fkey
FOREIGN KEY (projeto_id) REFERENCES public.projetos(id) ON DELETE CASCADE;

ALTER TABLE public.projeto_acoes ADD CONSTRAINT projeto_acoes_responsavel_id_fkey
FOREIGN KEY (responsavel_id) REFERENCES public.usuarios(id) ON DELETE SET NULL;

ALTER TABLE public.projeto_etapas_historico ADD CONSTRAINT projeto_etapas_historico_etapa_anterior_id_fkey
FOREIGN KEY (etapa_anterior_id) REFERENCES public.etapas(id) ON DELETE SET NULL;

ALTER TABLE public.projeto_etapas_historico ADD CONSTRAINT projeto_etapas_historico_etapa_nova_id_fkey
FOREIGN KEY (etapa_nova_id) REFERENCES public.etapas(id) ON DELETE SET NULL;

ALTER TABLE public.projeto_etapas_historico ADD CONSTRAINT projeto_etapas_historico_projeto_id_fkey
FOREIGN KEY (projeto_id) REFERENCES public.projetos(id) ON DELETE CASCADE;

ALTER TABLE public.projeto_etapas_historico ADD CONSTRAINT projeto_etapas_historico_usuario_id_fkey
FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE SET NULL;

ALTER TABLE public.projeto_marcos ADD CONSTRAINT projeto_marcos_criado_por_fkey
FOREIGN KEY (criado_por) REFERENCES public.usuarios(id) ON DELETE SET NULL;

ALTER TABLE public.projeto_marcos ADD CONSTRAINT projeto_marcos_projeto_id_fkey
FOREIGN KEY (projeto_id) REFERENCES public.projetos(id) ON DELETE CASCADE;

ALTER TABLE public.projeto_marcos ADD CONSTRAINT projeto_marcos_responsavel_id_fkey
FOREIGN KEY (responsavel_id) REFERENCES public.usuarios(id) ON DELETE SET NULL;

ALTER TABLE public.projeto_pendencias ADD CONSTRAINT projeto_pendencias_criado_por_fkey
FOREIGN KEY (criado_por) REFERENCES public.usuarios(id) ON DELETE SET NULL;

ALTER TABLE public.projeto_pendencias ADD CONSTRAINT projeto_pendencias_projeto_id_fkey
FOREIGN KEY (projeto_id) REFERENCES public.projetos(id) ON DELETE CASCADE;

ALTER TABLE public.projeto_pendencias ADD CONSTRAINT projeto_pendencias_responsavel_id_fkey
FOREIGN KEY (responsavel_id) REFERENCES public.usuarios(id) ON DELETE SET NULL;

ALTER TABLE public.projetos ADD CONSTRAINT projetos_cliente_id_fkey
FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE RESTRICT;

ALTER TABLE public.projetos ADD CONSTRAINT projetos_etapa_id_fkey
FOREIGN KEY (etapa_id) REFERENCES public.etapas(id) ON DELETE SET NULL;

ALTER TABLE public.projetos ADD CONSTRAINT projetos_finished_by_fkey
FOREIGN KEY (finished_by) REFERENCES public.usuarios(id) ON DELETE SET NULL;

ALTER TABLE public.projetos ADD CONSTRAINT projetos_paused_by_fkey
FOREIGN KEY (paused_by) REFERENCES public.usuarios(id) ON DELETE SET NULL;

ALTER TABLE public.projetos ADD CONSTRAINT projetos_responsavel_id_fkey
FOREIGN KEY (responsavel_id) REFERENCES public.usuarios(id) ON DELETE SET NULL;

ALTER TABLE public.projetos ADD CONSTRAINT projetos_started_by_fkey
FOREIGN KEY (started_by) REFERENCES public.usuarios(id) ON DELETE SET NULL;

-- ============================================================
-- CHECK CONSTRAINTS
-- ============================================================

ALTER TABLE public.acoes ADD CONSTRAINT acoes_prioridade_check
CHECK (prioridade = ANY (ARRAY['Baixa'::text, 'Normal'::text, 'Alta'::text, 'Crítica'::text]));

ALTER TABLE public.acoes ADD CONSTRAINT acoes_status_check
CHECK (status = ANY (ARRAY['Pendente'::text, 'Em andamento'::text, 'Concluída'::text, 'Cancelada'::text]));

ALTER TABLE public.historico_saneamento ADD CONSTRAINT historico_saneamento_item_tipo_check
CHECK (item_tipo = ANY (ARRAY['projeto'::text, 'acao'::text, 'pendencia'::text]));

ALTER TABLE public.historico_saneamento ADD CONSTRAINT historico_saneamento_operacao_check
CHECK (operacao = ANY (ARRAY['reprogramar_prazo'::text, 'definir_responsavel'::text, 'concluir'::text, 'cancelar'::text]));

ALTER TABLE public.historico_saneamento ADD CONSTRAINT historico_saneamento_severidade_check
CHECK (severidade = ANY (ARRAY['Crítico'::text, 'Atenção'::text]));

ALTER TABLE public.notificacoes ADD CONSTRAINT notificacoes_severidade_check
CHECK (severidade = ANY (ARRAY['Crítico'::text, 'Atenção'::text, 'Informação'::text]));

ALTER TABLE public.pendencias ADD CONSTRAINT pendencias_prioridade_check
CHECK (prioridade = ANY (ARRAY['Baixa'::text, 'Normal'::text, 'Alta'::text, 'Crítica'::text]));

ALTER TABLE public.pendencias ADD CONSTRAINT pendencias_status_check
CHECK (status = ANY (ARRAY['Aberta'::text, 'Em análise'::text, 'Resolvida'::text, 'Cancelada'::text]));

ALTER TABLE public.pendencias ADD CONSTRAINT pendencias_tipo_check
CHECK (tipo = ANY (ARRAY['Pendência'::text, 'Bloqueio'::text, 'Risco'::text, 'Dependência'::text]));

ALTER TABLE public.plano_semana_execucoes ADD CONSTRAINT plano_semana_execucoes_status_semana_check
CHECK (status_semana IS NULL OR (status_semana = ANY (ARRAY['Parcial'::text, 'Fechada'::text])));

ALTER TABLE public.plano_semana_execucoes ADD CONSTRAINT plano_semana_execucoes_tipo_execucao_check
CHECK (tipo_execucao = ANY (ARRAY['Automatica'::text, 'Manual'::text]));

ALTER TABLE public.plano_semana_historico ADD CONSTRAINT plano_semana_historico_status_fechamento_check
CHECK (status_fechamento = ANY (ARRAY['Parcial'::text, 'Fechada'::text]));

ALTER TABLE public.projeto_acoes ADD CONSTRAINT projeto_acoes_prioridade_check
CHECK (prioridade::text = ANY (ARRAY['Baixa'::character varying, 'Normal'::character varying, 'Alta'::character varying, 'Crítica'::character varying]::text[]));

ALTER TABLE public.projeto_acoes ADD CONSTRAINT projeto_acoes_status_check
CHECK (status::text = ANY (ARRAY['Pendente'::character varying, 'Em andamento'::character varying, 'Concluída'::character varying, 'Cancelada'::character varying]::text[]));

ALTER TABLE public.projeto_marcos ADD CONSTRAINT projeto_marcos_status_check
CHECK (status::text = ANY (ARRAY['Previsto'::character varying, 'Em andamento'::character varying, 'Concluído'::character varying, 'Cancelado'::character varying]::text[]));

ALTER TABLE public.projeto_pendencias ADD CONSTRAINT projeto_pendencias_prioridade_check
CHECK (prioridade::text = ANY (ARRAY['Baixa'::character varying, 'Normal'::character varying, 'Alta'::character varying, 'Crítica'::character varying]::text[]));

ALTER TABLE public.projeto_pendencias ADD CONSTRAINT projeto_pendencias_status_check
CHECK (status::text = ANY (ARRAY['Pendente'::character varying, 'Em andamento'::character varying, 'Concluída'::character varying, 'Cancelada'::character varying]::text[]));

ALTER TABLE public.projeto_pendencias ADD CONSTRAINT projeto_pendencias_tipo_check
CHECK (tipo::text = ANY (ARRAY['Pendência'::character varying, 'Impedimento'::character varying]::text[]));

ALTER TABLE public.projetos ADD CONSTRAINT projetos_percentual_check
CHECK (percentual >= 0 AND percentual <= 100);

ALTER TABLE public.projetos ADD CONSTRAINT projetos_prioridade_check
CHECK (prioridade = ANY (ARRAY['Baixa'::text, 'Normal'::text, 'Alta'::text, 'Crítica'::text]));

ALTER TABLE public.projetos ADD CONSTRAINT projetos_status_check
CHECK (status = ANY (ARRAY['Não iniciado'::text, 'Planejado'::text, 'Em andamento'::text, 'Pausado'::text, 'Bloqueado'::text, 'Finalizado'::text, 'Cancelado'::text]));

ALTER TABLE public.usuarios ADD CONSTRAINT usuarios_perfil_check
CHECK (perfil = ANY (ARRAY['CEO'::text, 'Diretoria'::text, 'P&D'::text, 'Desenvolvimento'::text, 'Implantação'::text, 'Suporte'::text, 'Comercial'::text, 'Visualização'::text]));

-- ÍNDICES
-- Índices de PK/UNIQUE acima são criados automaticamente.
-- Aqui ficam apenas os índices adicionais.
-- ============================================================

CREATE INDEX idx_acoes_projeto
    ON public.acoes USING btree (projeto_id);

CREATE INDEX idx_clientes_ativo
    ON public.clientes USING btree (ativo);

CREATE INDEX idx_clientes_nome
    ON public.clientes USING btree (nome);

CREATE INDEX idx_clientes_sistema
    ON public.clientes USING btree (sistema);

CREATE INDEX idx_comentarios_projeto
    ON public.comentarios USING btree (projeto_id);

CREATE INDEX idx_historico_clientes_cliente
    ON public.historico_clientes USING btree (cliente_id);

CREATE INDEX idx_historico_clientes_created_at
    ON public.historico_clientes USING btree (created_at DESC);

CREATE INDEX idx_historico_projeto_created_at
    ON public.historico_projeto USING btree (created_at DESC);

CREATE INDEX idx_historico_projeto_projeto_created
    ON public.historico_projeto USING btree (projeto_id, created_at DESC);

CREATE INDEX idx_historico_projeto_projeto_id
    ON public.historico_projeto USING btree (projeto_id);

CREATE INDEX idx_historico_saneamento_categoria
    ON public.historico_saneamento USING btree (categoria);

CREATE INDEX idx_historico_saneamento_data
    ON public.historico_saneamento USING btree (saneado_em DESC);

CREATE INDEX idx_historico_saneamento_projeto
    ON public.historico_saneamento USING btree (projeto_id, saneado_em DESC);

CREATE INDEX idx_historico_status_created
    ON public.historico_status USING btree (created_at);

CREATE INDEX idx_historico_status_projeto
    ON public.historico_status USING btree (projeto_id);

CREATE INDEX idx_notificacoes_projeto
    ON public.notificacoes USING btree (projeto_id);

CREATE INDEX idx_notificacoes_retencao
    ON public.notificacoes USING btree (resolvida, resolvida_em);

CREATE INDEX idx_notificacoes_usuario_lida
    ON public.notificacoes USING btree (usuario_id, lida, created_at DESC);

CREATE INDEX idx_notificacoes_usuario_resolvida
    ON public.notificacoes USING btree (usuario_id, resolvida);

CREATE INDEX idx_pendencias_projeto
    ON public.pendencias USING btree (projeto_id);

CREATE INDEX idx_plano_semana_execucoes_iniciado_em
    ON public.plano_semana_execucoes USING btree (iniciado_em DESC);

CREATE INDEX idx_plano_semana_execucoes_periodo
    ON public.plano_semana_execucoes USING btree (inicio_semana, fim_semana);

CREATE INDEX idx_plano_semana_execucoes_sucesso
    ON public.plano_semana_execucoes USING btree (sucesso);

CREATE INDEX idx_plano_semana_historico_inicio
    ON public.plano_semana_historico USING btree (inicio_semana DESC);

CREATE INDEX idx_projeto_acoes_prazo
    ON public.projeto_acoes USING btree (prazo);

CREATE INDEX idx_projeto_acoes_projeto
    ON public.projeto_acoes USING btree (projeto_id);

CREATE INDEX idx_projeto_acoes_responsavel
    ON public.projeto_acoes USING btree (responsavel_id);

CREATE INDEX idx_projeto_acoes_status
    ON public.projeto_acoes USING btree (status);

CREATE INDEX idx_projeto_marcos_projeto
    ON public.projeto_marcos USING btree (projeto_id);

CREATE INDEX idx_projeto_marcos_responsavel
    ON public.projeto_marcos USING btree (responsavel_id);

CREATE INDEX idx_projeto_marcos_status
    ON public.projeto_marcos USING btree (status);

CREATE INDEX idx_projeto_pendencias_projeto
    ON public.projeto_pendencias USING btree (projeto_id);

CREATE INDEX idx_projeto_pendencias_responsavel
    ON public.projeto_pendencias USING btree (responsavel_id);

CREATE INDEX idx_projeto_pendencias_status
    ON public.projeto_pendencias USING btree (status);

CREATE INDEX idx_projetos_cliente
    ON public.projetos USING btree (cliente_id);

CREATE INDEX idx_projetos_data_fim
    ON public.projetos USING btree (data_fim);

CREATE INDEX idx_projetos_data_inicio
    ON public.projetos USING btree (data_inicio);

CREATE INDEX idx_projetos_etapa
    ON public.projetos USING btree (etapa_id);

CREATE INDEX idx_projetos_responsavel
    ON public.projetos USING btree (responsavel_id);

CREATE INDEX idx_projetos_status
    ON public.projetos USING btree (status);

-- Fim da migration 002.

