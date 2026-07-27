# Contrato de Job — Plataforma ConnectWeb

> Referência para todos os tipos de job (dezenas surgirão: WhatsApp, IA,
> Automações, Marketing, Webhooks…). Tabela `jobs` + fila via `QueueProvider`.

## Campos

| Campo | Tipo | Descrição |
| --- | --- | --- |
| `id` | uuid | Identificador do job |
| `organization_id` | uuid \| null | Tenant dono (null = job de sistema) |
| `type` | text | Roteia para o handler. **Deve** existir em `job_types` (allowlist) |
| `payload` | jsonb | Dados do job |
| `payload_version` | int | Versão do schema do payload — o worker aceita v1/v2/v3 sem quebrar jobs antigos |
| `priority` | int | Maior = processado antes |
| `status` | text | `queued` → `running` → `succeeded` \| `failed` \| `dead` |
| `attempts` / `max_attempts` | int | Tentativas feitas / limite antes da DLQ |
| `available_at` | timestamptz | Visível para claim a partir de (agendamento/backoff) |
| `locked_at` / `locked_by` | timestamptz / text | Lease atual (worker) |
| `lease_expires_at` | timestamptz | Reclaim se o worker morrer (at-least-once) |
| `worker_version` | text | Versão do worker que processou |
| `idempotency_key` | text \| null | Dedup de enqueue + base para execução idempotente |
| `trace_id` / `correlation_id` | text | Observabilidade (ligação com `operation_traces`) |
| `last_error` / `result` | text / jsonb | Último erro / resultado |
| `created_at` / `updated_at` | timestamptz | — |

## Ciclo de vida

```
enqueue_job → queued → (claim_jobs) running → complete_job → succeeded
                                    ↘ fail_job → retry (backoff, available_at futuro)
                                                └ dead (attempts ≥ max) → job_dead_letter
```

## Regras (contrato)

1. **`type` registrado** — todo tipo precisa estar em `job_types` (cada módulo
   registra os seus na sua migration). Enqueue de tipo desconhecido é rejeitado.
2. **Idempotência** — handlers com efeito externo (ex.: envio de WhatsApp,
   cobrança) usam `idempotency_key` + `withIdempotency` — o reclaim de lease pode
   reprocessar um job; a operação deve ser exatamente-uma-vez logicamente.
3. **Versionamento** — mudou o payload? Incremente `payload_version` e trate as
   versões no handler; jobs antigos continuam válidos.
4. **Multi-tenant** — `enqueue_job` valida `is_org_member` (usuário) e injeta o
   `organization_id`; nunca confiar em `p_org` de outra org.
5. **Cota** — jobs que consomem recursos chamam `try_consume_quota` (atômico).
6. **Observabilidade** — propagar `trace_id`/`correlation_id`.

## Como um módulo registra um tipo (ex.: F3.1)

```sql
insert into public.job_types(key, module, description)
values ('whatsapp.send', 'whatsapp', 'Envio de mensagem WhatsApp')
on conflict (key) do nothing;
```

E registra o handler no worker (`scripts/worker.mjs` / `JobWorker.register`).
