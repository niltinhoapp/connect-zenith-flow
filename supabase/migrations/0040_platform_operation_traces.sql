-- 0040_platform_operation_traces.sql — Observabilidade (traces de operações). Idempotente.
-- Store durável leve (append-only); o TracingProvider também exporta p/ OpenTelemetry.
-- Toda operação importante registra: trace_id, organization_id, correlation_id,
-- actor_id, operation, status, duration_ms.

create table if not exists public.operation_traces (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid references public.organizations(id) on delete cascade,
  trace_id         text not null,
  span_id          text,
  correlation_id   text,
  actor_id         uuid references auth.users(id) on delete set null,
  operation        text not null,
  status           text not null default 'success' check (status in ('success','error')),
  duration_ms      int,
  metadata         jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now()
);
comment on table public.operation_traces is 'Plataforma: observabilidade append-only (export futuro p/ OpenTelemetry).';
create index if not exists idx_traces_org on public.operation_traces(organization_id, created_at desc);
create index if not exists idx_traces_trace on public.operation_traces(trace_id);
