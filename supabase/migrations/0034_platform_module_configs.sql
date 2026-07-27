-- 0034_platform_module_configs.sql — Configuração por módulo por organização. Idempotente.
-- Interface comum de config (jsonb) — evita condicionais espalhadas. Versionada
-- e auditável (schema_version, updated_by, validated_at).

create table if not exists public.module_configs (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  module_id        uuid not null references public.modules(id) on delete cascade,
  config           jsonb not null default '{}'::jsonb,
  schema_version   int not null default 1,
  updated_by       uuid references auth.users(id) on delete set null,
  validated_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
comment on table public.module_configs is 'Plataforma: configuração por módulo/org (schema comum, versionada).';
create unique index if not exists uq_module_configs on public.module_configs(organization_id, module_id);
