-- Gatilho agendado para automações.
alter table public.automations
  add column if not exists next_run_at timestamptz;

create index if not exists idx_automations_next_run
  on public.automations (next_run_at)
  where trigger_type = 'scheduled'
    and status = 'active'
    and deleted_at is null;

-- Qualquer alteração relevante recalcula o próximo horário no worker.
create or replace function public.automation_reset_next_run()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.trigger_type <> 'scheduled' or new.status <> 'active' then
    new.next_run_at := null;
  elsif tg_op = 'INSERT'
     or old.trigger_type is distinct from new.trigger_type
     or old.trigger_config is distinct from new.trigger_config
     or old.status is distinct from new.status then
    new.next_run_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_automation_reset_next_run on public.automations;
create trigger trg_automation_reset_next_run
before insert or update on public.automations
for each row execute function public.automation_reset_next_run();

create or replace function public.automation_due_scheduled(p_limit int default 50)
returns table (
  id uuid,
  organization_id uuid,
  trigger_config jsonb,
  next_run_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role required' using errcode = '42501';
  end if;

  return query
  select a.id, a.organization_id, a.trigger_config, a.next_run_at
  from public.automations a
  where a.trigger_type = 'scheduled'
    and a.status = 'active'
    and a.deleted_at is null
    and (a.next_run_at is null or a.next_run_at <= now())
  order by a.next_run_at asc nulls first
  limit least(greatest(coalesce(p_limit, 50), 1), 200);
end;
$$;

create or replace function public.automation_set_next_run(p_id uuid, p_next timestamptz)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role required' using errcode = '42501';
  end if;

  update public.automations
  set next_run_at = p_next
  where id = p_id
    and trigger_type = 'scheduled'
    and status = 'active'
    and deleted_at is null;
end;
$$;

revoke all on function public.automation_due_scheduled(int) from public, anon, authenticated;
revoke all on function public.automation_set_next_run(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.automation_due_scheduled(int) to service_role;
grant execute on function public.automation_set_next_run(uuid, timestamptz) to service_role;
