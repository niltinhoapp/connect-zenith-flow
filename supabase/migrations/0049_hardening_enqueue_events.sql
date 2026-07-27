-- 0049_hardening_enqueue_events.sql — enqueue consolidado + idempotência + outbox RPCs. Idempotente.

-- Remove a versão antiga (8 args) para evitar overload ambíguo.
drop function if exists public.enqueue_job(uuid, text, jsonb, timestamptz, int, int, text, text);

-- enqueue_job: guard (C1) + allowlist (C3) + dedup por idempotency_key (H3) + payload_version.
create or replace function public.enqueue_job(
  p_org uuid, p_type text, p_payload jsonb default '{}'::jsonb,
  p_available_at timestamptz default now(), p_priority int default 0,
  p_max_attempts int default 5, p_trace_id text default null, p_correlation_id text default null,
  p_idempotency_key text default null, p_payload_version int default 1
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_existing uuid;
begin
  if auth.uid() is not null and p_org is not null and not public.is_org_member(p_org) then raise exception 'forbidden'; end if;
  if not exists (select 1 from public.job_types where key = p_type and enabled) then
    raise exception 'unknown job type: %', p_type;
  end if;
  if p_idempotency_key is not null then
    select id into v_existing from public.jobs
      where organization_id = p_org and type = p_type and idempotency_key = p_idempotency_key limit 1;
    if v_existing is not null then return v_existing; end if;   -- dedup de enqueue
  end if;
  insert into public.jobs(organization_id, type, payload, payload_version, available_at, priority, max_attempts, trace_id, correlation_id, idempotency_key)
  values (p_org, p_type, coalesce(p_payload, '{}'::jsonb), coalesce(p_payload_version, 1), coalesce(p_available_at, now()),
          p_priority, p_max_attempts, p_trace_id, p_correlation_id, p_idempotency_key)
  returning id into v_id;
  return v_id;
end; $$;
grant execute on function public.enqueue_job(uuid, text, jsonb, timestamptz, int, int, text, text, text, int) to authenticated, service_role;

-- Idempotência de execução: adquire uma chave (true) ou já usada (false).
create or replace function public.claim_idempotency(p_org uuid, p_key text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_org_member(p_org) then raise exception 'forbidden'; end if;
  insert into public.idempotency_keys(organization_id, key) values (p_org, p_key) on conflict do nothing;
  return found;
end; $$;
grant execute on function public.claim_idempotency(uuid, text) to authenticated, service_role;

-- H1: publica evento no outbox e enfileira o relay (via Queue). Dedup do relay.
create or replace function public.publish_event(
  p_org uuid, p_name text, p_payload jsonb default '{}'::jsonb, p_payload_version int default 1, p_trace_id text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is not null and not public.is_org_member(p_org) then raise exception 'forbidden'; end if;
  insert into public.domain_events(organization_id, name, payload, payload_version, trace_id)
  values (p_org, p_name, coalesce(p_payload, '{}'::jsonb), coalesce(p_payload_version, 1), p_trace_id)
  returning id into v_id;
  perform public.enqueue_job(p_org, 'outbox.relay', jsonb_build_object('event_id', v_id), now(), 0, 5, p_trace_id, null,
                             'outbox.relay:' || v_id::text, 1);
  return v_id;
end; $$;
grant execute on function public.publish_event(uuid, text, jsonb, int, text) to authenticated, service_role;

-- Relay (worker): faz fan-out para webhooks e marca o evento processado.
create or replace function public.relay_domain_event(p_event_id uuid)
returns int language plpgsql security definer set search_path = public as $$
declare e public.domain_events; n int;
begin
  select * into e from public.domain_events where id = p_event_id;
  if e.id is null then return 0; end if;
  n := public.dispatch_webhooks(e.organization_id, e.name, e.payload);
  update public.domain_events set status = 'done', processed_at = now(), updated_at = now() where id = p_event_id;
  return n;
end; $$;
grant execute on function public.relay_domain_event(uuid) to service_role;
