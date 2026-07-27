# Auditoria Técnica — F3.0 (Fundação da Plataforma)

> Revisão crítica sênior antes da F3.1. Baseada em inspeção do código real
> (migrations `0032`–`0045` + `src/core/*`). A validação de runtime passou 25/25,
> mas exercitou apenas o caminho feliz (usuário operando a própria org) — **não**
> testou abuso cross-tenant das RPCs, onde estão os problemas.

## 1. Problemas encontrados

### 🔴 Crítico — corrigir ANTES da F3.1

**C1 · Vazamento multi-tenant nas RPCs (`p_org` sem verificação de membro).**
`enqueue_job`, `consume_quota`, `check_quota` e `write_trace` são `SECURITY DEFINER`,
concedidas a `authenticated` e expostas via PostgREST. Elas recebem `p_org` e **não
checam `is_org_member(p_org)`**. Como o definer ignora a RLS, qualquer usuário logado
pode passar o `organization_id` de **outra empresa** e:
- enfileirar jobs na fila de outra org (`enqueue_job`);
- inflar/adulterar o uso de cota de outra org (`consume_quota`) — DoS/tampering;
- ler a cota de outra org (`check_quota`) — vazamento;
- poluir a trilha de observabilidade de outra org (`write_trace`).
Apenas `apply_market_template` tem o guard (`is_org_member`). **Inconsistência de
segurança.** Correção: adicionar `is_org_member(p_org)` (ou `has_permission`) no
início de cada uma — ou derivar a org da sessão e ignorar o parâmetro.

**C2 · Cota não atômica (TOCTOU / race condition).**
O padrão é `check_quota` seguido de `consume_quota` — **duas** chamadas. Sob
concorrência, duas requisições passam no `check` e ambas consomem, **estourando o
limite**. Na F3.1 o WhatsApp consome `messages` em alto volume/paralelo → o plano
fura. Correção: RPC atômica `try_consume_quota(org, resource, amount)` que
verifica + incrementa em uma transação (com `INSERT ... ON CONFLICT ... DO UPDATE`
condicional / lock de linha) e retorna se coube.

**C3 · `enqueue_job` sem allowlist de `type` nem limite.**
Usuário pode enfileirar qualquer `type`/`payload` arbitrário (superfície de
abuso/DoS na fila; disparo de handlers internos). Correção: validar `type` contra
um catálogo permitido e (idealmente) contabilizar cota/rate-limit no enfileiramento.

### 🟠 Alto — a F3.1 depende disto (resolver no arranque)

**H1 · Event Bus durável (outbox) NÃO existe.**
`dispatch_webhooks` foi criada mas é **órfã** (ninguém chama) e **não há tabela
`domain_events`**. O Event Bus atual é **in-memory (client-side)** — some ao
recarregar e não roda no servidor. A F3.1 produz eventos **server-side** (mensagem
recebida via webhook do WhatsApp) que precisam disparar webhooks de saída e reações
entre módulos de forma durável. Falta o **outbox**: tabela `domain_events` +
trigger/worker que publica → `dispatch_webhooks` + handlers.

**H2 · Worker sem runtime.**
`JobWorker` existe como classe, mas **nenhum processo/scheduler executa** (`claim_jobs`
nunca é chamado em produção). Sem isso, os jobs de envio do WhatsApp não rodam.
Definir o runtime do worker local (ex.: `npm run worker` + loop) — como você aprovou,
sem Edge Functions ainda.

**H3 · Semântica at-least-once (reclaim de lease) → risco de envio duplicado.**
`claim_jobs` reivindica jobs `running` com `lease_expires_at < now()` (worker morto).
Se o worker estiver apenas **lento** (não morto), o job é processado 2×. Para o
WhatsApp isso = **mensagem enviada em duplicidade**. Constraint obrigatória na F3.1:
handlers **idempotentes** (chave de idempotência por mensagem).

### 🟡 Médio

**M1 · `apply_market_template` não idempotente** — re-aplicar duplica pipelines.
Guard: só aplicar se `organizations.market_template is null` (ou pular se já existe).

**M2 · Falta índice de listagem de jobs por org/status** para a futura UI de fila
(`jobs(organization_id, status, created_at desc)`). Menor.

**M3 · `consume_quota` sem `plan_limit` grava em `period_key` mensal por padrão**
mesmo quando o recurso é ilimitado — inofensivo, mas inconsistente.

### 🟢 Verificado / correto

- `claim_jobs` usa **`FOR UPDATE SKIP LOCKED`** → sem double-claim entre workers. ✅
- **Todas** as funções `SECURITY DEFINER` fixam `set search_path = public`. ✅
- RLS por org via helpers `SECURITY DEFINER` (sem recursão). ✅
- Escrita de `jobs`/`quota_usage`/`operation_traces`/`webhook_deliveries` só via
  definer/`service_role` (clientes não inserem direto). ✅
- Migrations idempotentes (`if not exists` / `create or replace` / `drop policy if
  exists` / `on conflict`) e seeds idempotentes. ✅
- Isolamento multi-tenant nas **tabelas** (RLS) validado 25/25 — o furo é nas
  **RPCs** (C1), não nas policies. ✅

## 2. Riscos futuros

- **Crescimento** de `jobs`, `audit_logs`, `operation_traces`, `webhook_deliveries`
  e (F3.1) `messages` → exigem **particionamento + retenção**.
- **Teto de throughput** da fila em Postgres; migrar para fila dedicada
  (pg-boss/SQS) via `QueueProvider` quando o volume crescer.
- **Forward-only migrations** (sem `down`/rollback) → risco em correções destrutivas.
- **`service_role` key**: bypassa RLS; manter server-only e rotacionável (se vazar,
  acesso total). Hoje está no `.env` — ok, mas nunca deve ir ao bundle.
- `quota_usage` acumula histórico mensal (limpeza futura).

## 3. Melhorias recomendadas

- **Padronizar** todas as RPCs que recebem `p_org` com guard de membro/permissão
  (política única — hoje é inconsistente).
- **Quota atômica** (`try_consume_quota`).
- **Outbox `domain_events`** + worker de publicação → unifica webhooks e reações
  entre módulos (Event Bus durável), reusando a fila.
- **Entrypoint do worker local** + (depois) `pg_cron`/Edge.
- **Idempotência de handlers** (chave por operação) como padrão do worker.
- `down` migrations ou Supabase **branching** para segurança de deploy.
- Índices por telas conforme forem surgindo.

## 4. Corrigir ANTES da F3.1

1. **C1** — guard `is_org_member(p_org)` em `enqueue_job`, `consume_quota`,
   `check_quota`, `write_trace`. *(segurança — obrigatório)*
2. **C2** — RPC atômica `try_consume_quota`. *(concorrência — a F3.1 exige)*
3. **C3** — allowlist de `type` em `enqueue_job`. *(hardening)*
4. **H1** — outbox `domain_events` + wiring de `dispatch_webhooks`. *(a F3.1 produz
   eventos server-side)*
5. **H2** — runtime do worker local. *(sem isso os jobs não executam)*
6. **H3** — padrão de idempotência do worker + chave por mensagem no WhatsApp.
7. **M1** — tornar `apply_market_template` idempotente.

## 5. Pode esperar até F4+

- Particionamento e **retenção** de tabelas quentes.
- **Fila externa** (pg-boss/SQS) via `QueueProvider`.
- `down`/rollback migrations e branching.
- Read replicas / sharding por org.
- Índices adicionais de UI e limpeza de `quota_usage` histórico.

## Veredito

**Não está 100% consistente para receber a F3.1 como está.** A arquitetura (Core
desacoplado, DDD, Providers, Queue, RLS) está sólida e correta no essencial, mas há
**3 correções críticas de segurança/concorrência (C1–C3)** e **3 itens de alto
impacto que a F3.1 vai exigir (H1–H3)**. São ajustes **localizados** (guards nas
RPCs + 1 tabela outbox + entrypoint do worker + padrão de idempotência) — exatamente
o tipo de retrabalho que esta auditoria evita ao pegar antes da integração grande.
Recomendo executar itens 1–7 da seção 4 antes de abrir a F3.1.
