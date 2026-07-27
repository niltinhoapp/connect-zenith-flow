-- 0042_platform_functions.sql — RPCs da infraestrutura. Idempotente. SECURITY DEFINER.

-- ── Catálogo de módulos ──────────────────────────────────────────────────────
create or replace function public.has_module(p_org uuid, p_key text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.modules m
    where m.key = p_key and (
      m.is_core or exists (
        select 1 from public.organization_modules om
        where om.organization_id = p_org and om.module_id = m.id and om.enabled
      )
    )
  );
$$;

-- ── Queue ────────────────────────────────────────────────────────────────────
create or replace function public.enqueue_job(
  p_org uuid, p_type text, p_payload jsonb default '{}'::jsonb,
  p_available_at timestamptz default now(), p_priority int default 0,
  p_max_attempts int default 5, p_trace_id text default null, p_correlation_id text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  insert into public.jobs(organization_id, type, payload, available_at, priority, max_attempts, trace_id, correlation_id)
  values (p_org, p_type, coalesce(p_payload, '{}'::jsonb), coalesce(p_available_at, now()), p_priority, p_max_attempts, p_trace_id, p_correlation_id)
  returning id into v_id;
  return v_id;
end; $$;

-- Claim lease-based: pega jobs 'queued' vencidos OU 'running' com lease expirado
-- (reclaim de worker morto). FOR UPDATE SKIP LOCKED p/ concorrência.
create or replace function public.claim_jobs(p_worker text, p_limit int default 10, p_lease_seconds int default 60)
returns setof public.jobs language plpgsql security definer set search_path = public as $$
begin
  return query
  update public.jobs j set
    status = 'running', locked_at = now(), locked_by = p_worker,
    lease_expires_at = now() + make_interval(secs => p_lease_seconds),
    attempts = j.attempts + 1, updated_at = now()
  where j.id in (
    select id from public.jobs
    where (status = 'queued' and available_at <= now())
       or (status = 'running' and lease_expires_at < now())
    order by priority desc, available_at asc
    for update skip locked
    limit greatest(1, p_limit)
  )
  returning j.*;
end; $$;

create or replace function public.complete_job(p_id uuid, p_result jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = public as $$
  update public.jobs set status = 'succeeded', result = coalesce(p_result, '{}'::jsonb),
    locked_at = null, locked_by = null, lease_expires_at = null, updated_at = now()
  where id = p_id;
$$;

-- Falha: retry com backoff exponencial, ou DLQ ao esgotar max_attempts.
create or replace function public.fail_job(p_id uuid, p_error text)
returns text language plpgsql security definer set search_path = public as $$
declare j public.jobs;
begin
  select * into j from public.jobs where id = p_id;
  if j.id is null then return 'not_found'; end if;
  if j.attempts >= j.max_attempts then
    update public.jobs set status = 'dead', last_error = p_error,
      locked_at = null, locked_by = null, lease_expires_at = null, updated_at = now()
    where id = p_id;
    insert into public.job_dead_letter(job_id, organization_id, type, payload, attempts, last_error)
    values (j.id, j.organization_id, j.type, j.payload, j.attempts, p_error);
    return 'dead';
  end if;
  update public.jobs set status = 'queued', last_error = p_error,
    locked_at = null, locked_by = null, lease_expires_at = null,
    available_at = now() + make_interval(secs => least(3600, (power(2, j.attempts)::int) * 5)),
    updated_at = now()
  where id = p_id;
  return 'retry';
end; $$;

-- ── Quotas (QuotaService) ────────────────────────────────────────────────────
create or replace function public.check_quota(p_org uuid, p_resource text, p_amount bigint default 1)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare v_plan text; v_limit bigint; v_period text; v_key text; v_used bigint;
begin
  select plan_id into v_plan from public.organizations where id = p_org;
  select limit_value, period into v_limit, v_period
    from public.plan_limits where plan_id = coalesce(v_plan, 'free') and resource = p_resource;
  if v_limit is null or v_limit < 0 then return true; end if;   -- sem limite / ilimitado
  v_key := case when v_period = 'month' then to_char(now(), 'YYYY-MM') else 'total' end;
  select used into v_used from public.quota_usage
    where organization_id = p_org and resource = p_resource and period_key = v_key;
  return coalesce(v_used, 0) + p_amount <= v_limit;
end; $$;

create or replace function public.consume_quota(p_org uuid, p_resource text, p_amount bigint default 1)
returns void language plpgsql security definer set search_path = public as $$
declare v_plan text; v_period text; v_key text;
begin
  select plan_id into v_plan from public.organizations where id = p_org;
  select period into v_period from public.plan_limits where plan_id = coalesce(v_plan, 'free') and resource = p_resource;
  v_key := case when coalesce(v_period, 'month') = 'month' then to_char(now(), 'YYYY-MM') else 'total' end;
  insert into public.quota_usage(organization_id, resource, period_key, used)
  values (p_org, p_resource, v_key, p_amount)
  on conflict (organization_id, resource, period_key)
    do update set used = public.quota_usage.used + p_amount, updated_at = now();
end; $$;

-- ── Observabilidade ──────────────────────────────────────────────────────────
create or replace function public.write_trace(
  p_org uuid, p_trace_id text, p_operation text, p_status text default 'success',
  p_duration_ms int default null, p_correlation_id text default null,
  p_span_id text default null, p_metadata jsonb default '{}'::jsonb
) returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.operation_traces(organization_id, trace_id, span_id, correlation_id, actor_id, operation, status, duration_ms, metadata)
  values (p_org, p_trace_id, p_span_id, p_correlation_id, auth.uid(), p_operation, p_status, p_duration_ms, coalesce(p_metadata, '{}'::jsonb));
end; $$;

-- ── Webhooks (dispatch a partir do outbox do Event Bus) ──────────────────────
create or replace function public.dispatch_webhooks(p_org uuid, p_event text, p_payload jsonb default '{}'::jsonb)
returns int language plpgsql security definer set search_path = public as $$
declare w record; n int := 0;
begin
  for w in select id from public.webhooks
    where organization_id = p_org and enabled and deleted_at is null and p_event = any(events)
  loop
    insert into public.webhook_deliveries(organization_id, webhook_id, event, payload)
    values (p_org, w.id, p_event, coalesce(p_payload, '{}'::jsonb));
    n := n + 1;
  end loop;
  return n;
end; $$;

-- ── Market Templates (aplicação 100% data-driven) ───────────────────────────
create or replace function public.apply_market_template(p_org uuid, p_key text)
returns void language plpgsql security definer set search_path = public as $$
declare v_tpl public.market_templates; v_def jsonb; v_pipe jsonb; v_pipeline_id uuid; v_stage jsonb; v_field jsonb; v_pos int;
begin
  if not public.is_org_member(p_org) then raise exception 'forbidden'; end if;
  select * into v_tpl from public.market_templates
    where key = p_key and is_active order by version desc limit 1;
  if v_tpl.id is null then raise exception 'template not found: %', p_key; end if;
  v_def := v_tpl.definition;

  update public.organizations
    set market_template = p_key, market_template_version = v_tpl.version where id = p_org;

  for v_pipe in select value from jsonb_array_elements(coalesce(v_def -> 'pipelines', '[]'::jsonb)) loop
    insert into public.pipelines(organization_id, name, is_default, position, color)
    values (p_org, v_pipe ->> 'name', coalesce((v_pipe ->> 'is_default')::boolean, false),
            coalesce((v_pipe ->> 'position')::int, 0), coalesce(v_pipe ->> 'color', '#2563EB'))
    returning id into v_pipeline_id;
    v_pos := 0;
    for v_stage in select value from jsonb_array_elements(coalesce(v_pipe -> 'stages', '[]'::jsonb)) loop
      insert into public.pipeline_stages(organization_id, pipeline_id, name, position, type, probability)
      values (p_org, v_pipeline_id, v_stage ->> 'name', v_pos,
              coalesce(v_stage ->> 'type', 'open'), coalesce((v_stage ->> 'probability')::int, 0));
      v_pos := v_pos + 1;
    end loop;
  end loop;

  for v_field in select value from jsonb_array_elements(coalesce(v_def -> 'customer_custom_fields', '[]'::jsonb)) loop
    insert into public.customer_custom_fields(organization_id, key, label, field_type, position)
    values (p_org, v_field ->> 'key', v_field ->> 'label', coalesce(v_field ->> 'field_type', 'text'),
            coalesce((v_field ->> 'position')::int, 0))
    on conflict (organization_id, key) do nothing;
  end loop;

  perform public.write_audit(p_org, 'organization.template.applied', 'market_template', v_tpl.id,
    jsonb_build_object('key', p_key, 'version', v_tpl.version));
end; $$;

-- ── Grants de execução ───────────────────────────────────────────────────────
grant execute on function public.has_module(uuid, text) to authenticated;
grant execute on function public.enqueue_job(uuid, text, jsonb, timestamptz, int, int, text, text) to authenticated, service_role;
grant execute on function public.check_quota(uuid, text, bigint) to authenticated, service_role;
grant execute on function public.consume_quota(uuid, text, bigint) to authenticated, service_role;
grant execute on function public.write_trace(uuid, text, text, text, int, text, text, jsonb) to authenticated, service_role;
grant execute on function public.apply_market_template(uuid, text) to authenticated;
-- Worker-only (service_role): claim/complete/fail e dispatch de webhooks.
grant execute on function public.claim_jobs(text, int, int) to service_role;
grant execute on function public.complete_job(uuid, jsonb) to service_role;
grant execute on function public.fail_job(uuid, text) to service_role;
grant execute on function public.dispatch_webhooks(uuid, text, jsonb) to service_role;
