-- 0014_crm_deals.sql — Módulo CRM · Deals. Idempotente.
-- Oportunidade de negócio vinculada a um Customer, dentro de um pipeline/stage
-- (referências, não texto). O tipo do stage (open/won/lost) define o desfecho.

create table if not exists public.deals (
  id                   uuid primary key default gen_random_uuid(),
  organization_id      uuid not null references public.organizations(id) on delete cascade,
  code                 text,                                -- DEAL-00001 (auto)
  customer_id          uuid references public.customers(id) on delete set null,
  pipeline_id          uuid not null references public.pipelines(id),
  stage_id             uuid not null references public.pipeline_stages(id),
  title                text not null,
  amount               bigint not null default 0 check (amount >= 0),  -- centavos
  currency             text not null default 'BRL',
  owner_id             uuid references auth.users(id) on delete set null,
  source               text,
  notes                text,
  tags                 text[] not null default '{}',
  custom_fields        jsonb  not null default '{}'::jsonb,
  expected_close_date  date,
  closed_at            timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  deleted_at           timestamptz
);
comment on table public.deals is 'CRM: negócios/oportunidades (pipeline + stage referenciados).';

create index if not exists idx_deals_org      on public.deals(organization_id) where deleted_at is null;
create index if not exists idx_deals_customer on public.deals(customer_id);
create index if not exists idx_deals_pipeline on public.deals(pipeline_id);
create index if not exists idx_deals_stage    on public.deals(stage_id);
create index if not exists idx_deals_owner    on public.deals(owner_id);
create unique index if not exists uq_deals_code on public.deals(organization_id, code) where code is not null;

drop trigger if exists trg_deals_updated_at on public.deals;
create trigger trg_deals_updated_at before update on public.deals
  for each row execute function public.set_updated_at();

drop trigger if exists trg_deals_code on public.deals;
create trigger trg_deals_code before insert on public.deals
  for each row execute function public.set_entity_code('DEAL', 'deal');
