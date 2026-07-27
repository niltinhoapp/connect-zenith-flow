-- 0032_platform_modules.sql — Catálogo global de módulos instaláveis. Idempotente.
-- Sem organization_id (é catálogo compartilhado). `key` é o identificador lógico
-- único; as FKs usam `id` (uuid) para permitir renomear a key sem quebrar nada.

create table if not exists public.modules (
  id           uuid primary key default gen_random_uuid(),
  key          text not null unique,          -- identificador lógico (crm, whatsapp…)
  name         text not null,
  description  text not null default '',
  category     text not null default 'platform',
  is_core      boolean not null default false, -- core = sempre ativo p/ toda org
  icon         text,
  position     int not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
comment on table public.modules is 'Plataforma: catálogo global de módulos instaláveis.';
