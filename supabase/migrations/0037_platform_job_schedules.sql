-- 0037_platform_job_schedules.sql — Scheduler (jobs recorrentes/agendados). Idempotente.
-- O scheduler (pg_cron + worker) enfileira um job quando next_run_at vence.

create table if not exists public.job_schedules (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid references public.organizations(id) on delete cascade,
  type              text not null,
  payload           jsonb not null default '{}'::jsonb,
  cron              text,            -- expressão cron (opcional)
  interval_seconds  int,             -- alternativa a cron
  next_run_at       timestamptz not null default now(),
  enabled           boolean not null default true,
  last_enqueued_at  timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
comment on table public.job_schedules is 'Plataforma: agendamentos recorrentes que enfileiram jobs.';
create index if not exists idx_schedules_due on public.job_schedules(next_run_at) where enabled;
