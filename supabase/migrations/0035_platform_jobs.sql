-- 0035_platform_jobs.sql — Fila de jobs (execução assíncrona genérica). Idempotente.
-- `type` (string) roteia — SEM lógica específica de módulo aqui. Preparado para
-- workers distribuídos: available_at + lease (lease_expires_at) + worker_version,
-- facilitando migrar depois para Redis/SQS/RabbitMQ/pg-boss sem mudar schema.

create table if not exists public.jobs (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid references public.organizations(id) on delete cascade,  -- null = job de sistema
  type              text not null,                       -- ex: whatsapp.send, automation.run
  payload           jsonb not null default '{}'::jsonb,
  status            text not null default 'queued'
                      check (status in ('queued','running','succeeded','failed','dead')),
  priority          int not null default 0,
  attempts          int not null default 0,
  max_attempts      int not null default 5,
  available_at      timestamptz not null default now(),  -- visível para claim a partir de
  locked_at         timestamptz,
  locked_by         text,                                -- id do worker
  lease_expires_at  timestamptz,                         -- reclaim se worker morrer
  worker_version    text,
  last_error        text,
  result            jsonb,
  trace_id          text,
  correlation_id    text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
comment on table public.jobs is 'Plataforma: fila de jobs assíncronos (genérica, lease-based).';
create index if not exists idx_jobs_claim on public.jobs(priority desc, available_at) where status = 'queued';
create index if not exists idx_jobs_lease on public.jobs(lease_expires_at) where status = 'running';
create index if not exists idx_jobs_org on public.jobs(organization_id, created_at desc);
