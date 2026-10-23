# WMS Expert — Control Tower

Control Tower executivo para acompanhamento da carteira de projetos do WMS Expert.

A aplicação centraliza visão executiva, implantação, desenvolvimento, riscos, ações, pendências, marcos, governança, capacidade operacional e evolução semanal dos projetos.

## Stack

- Next.js 16.4.0
- React 19.3.0
- TypeScript 5
- Tailwind CSS 4
- Supabase / PostgreSQL
- @supabase/ssr
- @supabase/supabase-js
- Lucide React

Ambiente validado:

- Node.js 24.15.0
- npm 11.12.1
- Git 2.54.0

## Principais módulos

O Control Tower possui:

- Overview Executivo
- Carteira de Projetos
- Kanban
- Gantt / Timeline
- Projeto 360
- Ações
- Pendências e Impedimentos
- Marcos
- Histórico de Projetos
- Dashboard Executivo
- Agenda Executiva
- Alertas e Notificações
- Inconsistências e Saneamento
- Governança e Decisões Gerenciais
- Capacidade por responsável
- Plano da Semana
- Histórico Semanal

## Fluxo de implantação

O fluxo principal dos projetos é:

1. Comercial
2. Planejamento
3. Configuração e Parametrização
4. Homologação/Testes
5. Treinamento e Capacitação
6. Go-Live
7. Suporte
8. Pós-venda

## Estrutura principal

```text
wms-control-tower/
├── app/
│   └── api/
├── components/
├── lib/
├── public/
├── supabase/
│   └── migrations/
├── proxy.ts
├── package.json
├── next.config.ts
├── tsconfig.json
└── README.md
```

## Instalação e execução

Instale as dependências:

```bash
npm install
```

Configure o arquivo `.env.local` e execute:

```bash
npm run dev
```

Por padrão, o ambiente de desenvolvimento fica disponível em:

```text
http://localhost:3000
```

## Variáveis de ambiente

O projeto utiliza:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
CRON_SECRET=
```

### NEXT_PUBLIC_SUPABASE_URL

URL do projeto Supabase.

### NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

Chave pública utilizada na comunicação permitida com o Supabase.

### SUPABASE_SECRET_KEY

Chave privilegiada de uso exclusivamente server-side.

Nunca deve ser exposta em componentes client-side, navegador, logs ou código público.

### CRON_SECRET

Segredo utilizado para autenticação das rotinas administrativas de cron.

Os valores reais dessas variáveis nunca devem ser versionados.

## Comandos

Desenvolvimento:

```bash
npm run dev
```

Lint:

```bash
npm run lint
```

Build de produção:

```bash
npm run build
```

Executar build:

```bash
npm run start
```

Antes de uma publicação:

```bash
npm run lint
npm run build
```

## Banco de dados

O backend utiliza PostgreSQL através do Supabase.

Estrutura validada do schema `public`:

| Objeto | Quantidade |
|---|---:|
| Tabelas | 18 |
| Colunas | 213 |
| Primary Keys | 18 |
| Foreign Keys | 35 |
| UNIQUE | 5 |
| CHECK | 22 |
| Índices | 63 |
| Funções | 5 |
| Triggers | 5 |
| Tabelas com RLS | 18 |
| Policies | 33 |

## Migrations

As migrations oficiais ficam em:

```text
supabase/migrations/
```

Ordem atual:

```text
20261023_001_schema_base.sql
20261023_002_constraints_indices.sql
20261023_003_functions_rls_policies.sql
20261023_004_notificacoes_retencao.sql
```

### 001 — Schema base

Criação das 18 tabelas e estrutura base.

### 002 — Constraints e índices

Primary Keys, Foreign Keys, UNIQUE, CHECK constraints e índices.

### 003 — Funções, segurança e triggers

Contém:

- funções PostgreSQL;
- ativação de Row Level Security;
- policies;
- triggers de atualização automática.

### 004 — Retenção de notificações

Estrutura relacionada à resolução e retenção histórica das notificações.

As migrations constituem a fonte versionada da estrutura do banco.

## Validação das migrations

As migrations foram executadas em um banco PostgreSQL 17 isolado criado do zero.

A estrutura produzida foi comparada com a estrutura real do Supabase, resultando na mesma assinatura:

```text
CHECK         22
COLUNAS       213
FOREIGN KEYS  35
FUNCOES        5
INDICES       63
POLICIES      33
PRIMARY KEYS  18
RLS ATIVO     18
TABELAS       18
TRIGGERS       5
UNIQUE         5
```

Em PostgreSQL local fora da plataforma Supabase, dependências nativas do Supabase Auth, como `auth.uid()`, podem precisar ser simuladas exclusivamente para testes.

Essas simulações não substituem as implementações nativas do Supabase.

## Autenticação e autorização

A aplicação utiliza autenticação real do Supabase.

O bypass de autenticação de desenvolvimento deve permanecer desativado:

```text
DEV_BYPASS_AUTH = false
```

Perfis utilizados:

- CEO
- Diretoria
- P&D
- Desenvolvimento
- Implantação
- Suporte
- Comercial
- Visualização

A aplicação possui controle de permissões por perfil e proteção adicional no banco através de Row Level Security.

Estado validado:

```text
18/18 tabelas public com RLS ativo
33 policies
```

## Segurança das chaves

A `SUPABASE_SECRET_KEY` deve permanecer exclusivamente no servidor.

Nunca:

- utilizar a secret key em componente client-side;
- transformar a secret key em variável `NEXT_PUBLIC_*`;
- registrar seu valor em logs;
- enviar seu valor ao navegador;
- versionar a chave no Git.

O cliente administrativo do Supabase deve permanecer isolado em código server-side.

## Notificações

O sistema possui geração e sincronização de alertas executivos.

As notificações contemplam:

- usuário destinatário;
- severidade;
- estado lida/não lida;
- estado resolvida;
- data de resolução;
- retenção histórica.

Uma notificação pode estar lida e continuar ativa.

Quando a condição que originou o alerta deixa de existir, a notificação pode ser resolvida sem perder o histórico.

## Cron

Existe uma rota administrativa para as rotinas automáticas do Plano da Semana:

```text
/api/cron/plano-semana
```

As chamadas devem ser autenticadas através do `CRON_SECRET`.

A execução administrativa não depende de sessão comum de usuário, mas a rota deve obrigatoriamente validar o segredo do cron.

## Plano da Semana

O módulo registra a evolução operacional e executiva da carteira.

Contempla:

- fotografia parcial;
- histórico semanal;
- execuções automáticas;
- fechamento semanal;
- comparação entre semanas;
- evolução de execução;
- risco;
- ranking;
- linha do tempo.

Tabelas relacionadas:

```text
plano_semana_historico
plano_semana_execucoes
```

## Backup e restore

Antes de alterações estruturais relevantes, deve ser gerado backup do banco.

O processo foi validado com PostgreSQL 17 utilizando `pg_dump` em formato custom.

Exemplo conceitual:

```bash
pg_dump -Fc -f control-tower.dump DATABASE_URL
```

Validação:

```bash
pg_restore --list control-tower.dump
```

Testes de restore devem utilizar banco isolado.

Nunca realizar teste destrutivo de restore diretamente no banco de produção.

O backup do Control Tower foi validado através de restauração local, conferência estrutural e comparação das principais contagens com o Supabase.

## DEV, homologação e produção

A estrutura do banco deve ser controlada pelas migrations versionadas.

Alterações estruturais não devem existir somente de forma manual em um ambiente.

Fluxo:

```text
Alteração estrutural
        ↓
Migration versionada
        ↓
Validação
        ↓
DEV
        ↓
Homologação
        ↓
Produção
```

Antes da promoção entre ambientes, as migrations oficiais devem ser utilizadas como referência estrutural.

## APIs

As APIs estão em:

```text
app/api/
```

Principais grupos:

```text
agenda
alertas
auth
clientes
cron
dashboard
etapas
governanca
inconsistencias
notificacoes
opcoes
plano-semana
projetos
usuarios
```

Os recursos relacionados aos projetos incluem ações, pendências, marcos, histórico, alteração de status e decisão gerencial.

## Checklist antes do deploy

Antes de publicar uma versão:

1. revisar alterações pendentes no Git;
2. confirmar que nenhum segredo foi versionado;
3. validar migrations;
4. confirmar RLS e policies;
5. executar lint;
6. executar build;
7. conferir variáveis de ambiente;
8. validar autenticação;
9. validar APIs críticas;
10. executar smoke test;
11. publicar;
12. monitorar o ambiente após o deploy.

## Git

Branch principal utilizada atualmente:

```text
master
```

Antes de qualquer commit:

```bash
git status
git diff
```

Não incluir no commit:

- `.env.local`;
- backups de banco;
- arquivos `.bak`;
- credenciais;
- secrets;
- arquivos temporários de auditoria.

## Regras de manutenção

- Toda alteração estrutural do banco deve possuir migration correspondente.
- Toda nova tabela deve ter sua estratégia de RLS avaliada.
- Toda rota privilegiada deve possuir autenticação/autorização apropriada.
- Chaves administrativas devem permanecer server-side.
- Não utilizar dados reais para testes destrutivos.
- Não alterar produção sem backup e estratégia de rollback.

## Estado da documentação

Este README substitui a documentação padrão do `create-next-app` e descreve a estrutura real validada do WMS Expert Control Tower em outubro de 2026.