-- 0039_platform_webhooks.sql — Webhooks de saída + entregas. Idempotente.

create table if not exists public.webhooks (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  url              text not null,
  events           text[] not null default '{}',   -- nomes de eventos assinados
  secret           text,                            -- assinatura HMAC
  enabled          boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz
);
comment on table public.webhooks is 'Plataforma: endpoints de webhook (saída) por organização.';
create index if not exists idx_webhooks_org on public.webhooks(organization_id) where deleted_at is null;

create table if not exists public.webhook_deliveries (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  webhook_id       uuid not null references public.webhooks(id) on delete cascade,
  event            text not null,
  payload          jsonb not null default '{}'::jsonb,
  status           text not null default 'pending' check (status in ('pending','delivered','failed','dead')),
  attempts         int not null default 0,
  response_status  int,
  response_body    text,
  delivered_at     timestamptz,
  trace_id         text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
comment on table public.webhook_deliveries is 'Plataforma: tentativas de entrega de webhooks.';
create index if not exists idx_wh_deliveries_org on public.webhook_deliveries(organization_id, created_at desc);
create index if not exists idx_wh_deliveries_pending on public.webhook_deliveries(status) where status = 'pending';
