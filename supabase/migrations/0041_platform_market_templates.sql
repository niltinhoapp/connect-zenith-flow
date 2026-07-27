-- 0041_platform_market_templates.sql — Templates de mercado (versionados). Idempotente.
-- Totalmente configuráveis via `definition jsonb` — nenhuma regra fixa no código.
-- Versionados: Clínica v1 → v2 → v3; orgs antigas permanecem na versão aplicada.

create table if not exists public.market_templates (
  id            uuid primary key default gen_random_uuid(),
  key           text not null,                 -- clinica, loja_virtual, oficina…
  version       int not null default 1,
  name          text not null,
  description   text not null default '',
  definition    jsonb not null default '{}'::jsonb,  -- default_modules[], pipelines[], custom_fields[], automations[], dashboard
  is_active     boolean not null default true,
  published_at  timestamptz,
  position      int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
comment on table public.market_templates is 'Plataforma: templates de mercado versionados (definição 100% em jsonb).';
create unique index if not exists uq_market_templates on public.market_templates(key, version);

alter table public.organizations
  add column if not exists market_template text,
  add column if not exists market_template_version int;
