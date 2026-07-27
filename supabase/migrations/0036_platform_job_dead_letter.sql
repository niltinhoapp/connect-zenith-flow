-- 0036_platform_job_dead_letter.sql — Dead Letter Queue. Idempotente.
-- Destino de jobs que esgotaram max_attempts. Append-only (sem updated_at).

create table if not exists public.job_dead_letter (
  id               uuid primary key default gen_random_uuid(),
  job_id           uuid,
  organization_id  uuid references public.organizations(id) on delete cascade,
  type             text not null,
  payload          jsonb not null default '{}'::jsonb,
  attempts         int not null default 0,
  last_error       text,
  failed_at        timestamptz not null default now(),
  created_at       timestamptz not null default now()
);
comment on table public.job_dead_letter is 'Plataforma: DLQ (jobs que falharam definitivamente).';
create index if not exists idx_dlq_org on public.job_dead_letter(organization_id, created_at desc);
