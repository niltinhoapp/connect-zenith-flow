-- 0066_automation_scheduled.sql — gatilho "agendado" (scheduled). Idempotente.
-- O worker faz o dispatch: lê os agendados vencidos, dispara uma run por slot
-- (idempotente por 'sched:<slot>') e reprograma next_run_at (cálculo em JS,
-- espelho de src/features/automacoes/domain/schedule.ts). Aqui só o suporte SQL.

alter table public.automations add column if not exists next_run_at timestamptz;
create index if not exists idx_automations_next_run
  on public.automations(next_run_at)
  where trigger_type = 'scheduled' and status = 'active' and deleted_at is null;

-- Agendados vencidos (ou ainda sem próximo horário) — para o worker processar.
create or replace function public.automation_due_scheduled(p_limit int default 50)
returns table(id uuid, organization_id uuid, trigger_config jsonb, next_run_at timestamptz)
language sql stable security definer set search_path = public as $$
  select a.id, a.organization_id, a.trigger_config, a.next_run_at
  from public.automations a
  where a.trigger_type = 'scheduled'
    and a.status = 'active'
    and a.deleted_at is null
    and (a.next_run_at is null or a.next_run_at <= now())
  order by a.next_run_at asc nulls first
  limit greatest(1, p_limit);
$$;
grant execute on function public.automation_due_scheduled(int) to service_role;

-- Reprograma o próximo disparo (worker calcula em JS).
create or replace function public.automation_set_next_run(p_id uuid, p_next timestamptz)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.automations set next_run_at = p_next, updated_at = now()
  where id = p_id;
end; $$;
grant execute on function public.automation_set_next_run(uuid, timestamptz) to service_role;
