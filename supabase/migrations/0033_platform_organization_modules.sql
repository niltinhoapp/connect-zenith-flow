-- 0033_platform_organization_modules.sql — Módulos contratados por organização. Idempotente.
-- Fonte da verdade do que cada empresa ativou. FK por module_id (uuid).

create table if not exists public.organization_modules (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  module_id        uuid not null references public.modules(id) on delete cascade,
  enabled          boolean not null default true,
  source           text not null default 'manual',  -- plan | manual | trial
  activated_at     timestamptz not null default now(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
comment on table public.organization_modules is 'Plataforma: ativação de módulos por organização (fonte da verdade).';
create unique index if not exists uq_org_modules on public.organization_modules(organization_id, module_id);
create index if not exists idx_org_modules_org on public.organization_modules(organization_id) where enabled;
