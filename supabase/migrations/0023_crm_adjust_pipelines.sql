-- 0023_crm_adjust_pipelines.sql — Pipelines: apresentação. Idempotente.
alter table public.pipelines
  add column if not exists color         text not null default '#2563EB',
  add column if not exists icon          text,
  add column if not exists display_order int not null default 0;
-- is_default já existe (0013).
