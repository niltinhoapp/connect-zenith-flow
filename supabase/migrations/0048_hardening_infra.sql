-- 0048_hardening_infra.sql — C3 (job_types), H3 (idempotência + payload_version), H1 (domain_events). Idempotente.

-- ── C3: catálogo de tipos de job permitidos ──────────────────────────────────
create table if not exists public.job_types (
  key          text primary key,
  module       text not null default 'core',
  description  text not null default '',
  enabled      boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
comment on table public.job_types is 'Plataforma: allowlist de tipos de job (cada módulo registra os seus).';
insert into public.job_types(key, module, description) values
  ('outbox.relay', 'core', 'Relay do outbox → webhooks/reações'),
  ('noop',         'core', 'Job de teste')
on conflict (key) do update set module = excluded.module, description = excluded.description;

-- ── H3: chaves de idempotência (dedup de execução) ───────────────────────────
create table if not exists public.idempotency_keys (
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  key              text not null,
  created_at       timestamptz not null default now(),
  primary key (organization_id, key)
);
comment on table public.idempotency_keys is 'Plataforma: garante execução única por chave (handlers idempotentes).';

-- ── H3/versionamento: jobs.payload_version + idempotency_key ─────────────────
alter table public.jobs
  add column if not exists payload_version int not null default 1,
  add column if not exists idempotency_key text;
create unique index if not exists uq_jobs_idempotency
  on public.jobs(organization_id, type, idempotency_key) where idempotency_key is not null;

-- ── H1: outbox de eventos de domínio (Event Bus durável) ─────────────────────
create table if not exists public.domain_events (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  name             text not null,
  payload          jsonb not null default '{}'::jsonb,
  payload_version  int not null default 1,
  status           text not null default 'queued' check (status in ('queued','processing','done','failed')),
  attempts         int not null default 0,
  trace_id         text,
  correlation_id   text,
  occurred_at      timestamptz not null default now(),
  processed_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
comment on table public.domain_events is 'Plataforma: outbox transacional de eventos (Event Bus durável).';
create index if not exists idx_domain_events_org on public.domain_events(organization_id, occurred_at desc);
create index if not exists idx_domain_events_open on public.domain_events(status) where status <> 'done';
