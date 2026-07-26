-- 0013_crm_pipelines.sql — Módulo CRM · Pipelines + Stages. Idempotente.
-- Múltiplos funis por empresa (Comercial, Suporte, Pós-venda, Renovação…) sem
-- tocar código. Estágio deixa de ser texto: vira linha em pipeline_stages.

create table if not exists public.pipelines (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  name             text not null,
  is_default       boolean not null default false,
  position         int not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz
);
comment on table public.pipelines is 'CRM: funis de negócio por organização.';
create unique index if not exists uq_pipelines_name on public.pipelines(organization_id, name) where deleted_at is null;

drop trigger if exists trg_pipelines_updated_at on public.pipelines;
create trigger trg_pipelines_updated_at before update on public.pipelines
  for each row execute function public.set_updated_at();

create table if not exists public.pipeline_stages (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  pipeline_id      uuid not null references public.pipelines(id) on delete cascade,
  name             text not null,
  position         int not null default 0,
  -- type define a semântica do estágio (aberto / ganho / perdido).
  type             text not null default 'open' check (type in ('open','won','lost')),
  probability      int not null default 0 check (probability between 0 and 100),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz
);
comment on table public.pipeline_stages is 'CRM: estágios de um funil (ordem + tipo open/won/lost).';
create index if not exists idx_stages_pipeline on public.pipeline_stages(pipeline_id, position) where deleted_at is null;

drop trigger if exists trg_pipeline_stages_updated_at on public.pipeline_stages;
create trigger trg_pipeline_stages_updated_at before update on public.pipeline_stages
  for each row execute function public.set_updated_at();
