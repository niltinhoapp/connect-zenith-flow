-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 0005_core_audit.sql                                                        ║
-- ║ Core · Audit Logs                                                          ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- Trilha de auditoria append-only (infra do Core desde a F1, mesmo sem UI).
-- Registros são imutáveis: escritos apenas via write_audit() (SECURITY DEFINER)
-- e nunca alterados/removidos pelo cliente (ver RLS em 0007). Idempotente.
--
-- Observação de convenção: mantém created_at + updated_at por padrão do projeto,
-- porém audit é append-only — updated_at permanece = created_at (sem UPDATEs).
-- Sem deleted_at (uma auditoria apagável não é auditoria).

create table if not exists public.audit_logs (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid references public.organizations(id) on delete set null,
  actor_id         uuid references auth.users(id) on delete set null,
  action           text not null,                    -- ex: 'organization.created'
  entity_type      text,                             -- ex: 'organization', 'role'
  entity_id        uuid,
  metadata         jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
comment on table public.audit_logs is 'Core: trilha de auditoria append-only. Escrita só via write_audit().';

create index if not exists idx_audit_org     on public.audit_logs(organization_id, created_at desc);
create index if not exists idx_audit_actor   on public.audit_logs(actor_id, created_at desc);

-- ── write_audit() ────────────────────────────────────────────────────────────
-- Ponto único de escrita da auditoria. SECURITY DEFINER: as demais RPCs do Core
-- chamam esta função para registrar eventos, ignorando RLS de inserção.
create or replace function public.write_audit(
  p_org         uuid,
  p_action      text,
  p_entity_type text default null,
  p_entity_id   uuid default null,
  p_metadata    jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_logs(organization_id, actor_id, action, entity_type, entity_id, metadata)
  values (p_org, auth.uid(), p_action, p_entity_type, p_entity_id, coalesce(p_metadata, '{}'::jsonb));
end;
$$;
comment on function public.write_audit is 'Core: registra evento na trilha de auditoria (append-only).';
