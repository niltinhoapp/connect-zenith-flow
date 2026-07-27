-- 0038_platform_quotas.sql — Limites por plano + uso por organização. Idempotente.
-- Enforcement centralizado no QuotaService (RPCs check_quota/consume_quota).

create table if not exists public.plan_limits (
  id           uuid primary key default gen_random_uuid(),
  plan_id      text not null,                 -- free | starter | pro | enterprise
  resource     text not null,                 -- customers | messages | ai_credits | storage_bytes | api_calls
  limit_value  bigint not null default -1,    -- -1 = ilimitado
  period       text not null default 'month' check (period in ('month','total')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
comment on table public.plan_limits is 'Plataforma: limites por plano (referência global).';
create unique index if not exists uq_plan_limits on public.plan_limits(plan_id, resource);

create table if not exists public.quota_usage (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  resource         text not null,
  period_key       text not null default 'total',   -- 'YYYY-MM' (mensal) ou 'total'
  used             bigint not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
comment on table public.quota_usage is 'Plataforma: uso corrente de recursos por organização.';
create unique index if not exists uq_quota_usage on public.quota_usage(organization_id, resource, period_key);
