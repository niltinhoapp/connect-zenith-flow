-- 0051_hardening_policies.sql — RLS + grants + triggers das novas tabelas. Idempotente.

grant select, insert, update, delete on all tables in schema public to authenticated;
grant all privileges on all tables in schema public to service_role;

-- job_types: catálogo global (leitura para autenticados).
alter table public.job_types enable row level security;
drop policy if exists job_types_select on public.job_types;
create policy job_types_select on public.job_types for select to authenticated using (true);

-- domain_events: leitura por membro; escrita só via RPC definer.
alter table public.domain_events enable row level security;
drop policy if exists domain_events_select on public.domain_events;
create policy domain_events_select on public.domain_events for select to authenticated
  using (public.is_org_member(organization_id));

-- idempotency_keys: leitura por membro; escrita só via RPC definer.
alter table public.idempotency_keys enable row level security;
drop policy if exists idem_keys_select on public.idempotency_keys;
create policy idem_keys_select on public.idempotency_keys for select to authenticated
  using (public.is_org_member(organization_id));

-- updated_at triggers.
do $$
declare t text;
begin
  foreach t in array array['job_types','domain_events'] loop
    execute format('drop trigger if exists trg_%1$s_updated_at on public.%1$s', t);
    execute format('create trigger trg_%1$s_updated_at before update on public.%1$s for each row execute function public.set_updated_at()', t);
  end loop;
end $$;
