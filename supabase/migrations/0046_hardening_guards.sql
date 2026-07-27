-- 0046_hardening_guards.sql — C1 (guard multi-tenant) + M1 (template idempotente). Idempotente.
-- Guard: usuário autenticado só opera na própria org; service_role (auth.uid()=null) passa.

create or replace function public.check_quota(p_org uuid, p_resource text, p_amount bigint default 1)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare v_plan text; v_limit bigint; v_period text; v_key text; v_used bigint;
begin
  if auth.uid() is not null and not public.is_org_member(p_org) then raise exception 'forbidden'; end if;
  select plan_id into v_plan from public.organizations where id = p_org;
  select limit_value, period into v_limit, v_period from public.plan_limits where plan_id = coalesce(v_plan, 'free') and resource = p_resource;
  if v_limit is null or v_limit < 0 then return true; end if;
  v_key := case when v_period = 'month' then to_char(now(), 'YYYY-MM') else 'total' end;
  select used into v_used from public.quota_usage where organization_id = p_org and resource = p_resource and period_key = v_key;
  return coalesce(v_used, 0) + p_amount <= v_limit;
end; $$;

create or replace function public.consume_quota(p_org uuid, p_resource text, p_amount bigint default 1)
returns void language plpgsql security definer set search_path = public as $$
declare v_plan text; v_period text; v_key text;
begin
  if auth.uid() is not null and not public.is_org_member(p_org) then raise exception 'forbidden'; end if;
  select plan_id into v_plan from public.organizations where id = p_org;
  select period into v_period from public.plan_limits where plan_id = coalesce(v_plan, 'free') and resource = p_resource;
  v_key := case when coalesce(v_period, 'month') = 'month' then to_char(now(), 'YYYY-MM') else 'total' end;
  insert into public.quota_usage(organization_id, resource, period_key, used) values (p_org, p_resource, v_key, p_amount)
  on conflict (organization_id, resource, period_key) do update set used = public.quota_usage.used + p_amount, updated_at = now();
end; $$;

create or replace function public.write_trace(
  p_org uuid, p_trace_id text, p_operation text, p_status text default 'success',
  p_duration_ms int default null, p_correlation_id text default null,
  p_span_id text default null, p_metadata jsonb default '{}'::jsonb
) returns void language plpgsql security definer set search_path = public as $$
begin
  if p_org is not null and auth.uid() is not null and not public.is_org_member(p_org) then raise exception 'forbidden'; end if;
  insert into public.operation_traces(organization_id, trace_id, span_id, correlation_id, actor_id, operation, status, duration_ms, metadata)
  values (p_org, p_trace_id, p_span_id, p_correlation_id, auth.uid(), p_operation, p_status, p_duration_ms, coalesce(p_metadata, '{}'::jsonb));
end; $$;

-- M1: apply_market_template idempotente (aplica só uma vez por org).
create or replace function public.apply_market_template(p_org uuid, p_key text)
returns void language plpgsql security definer set search_path = public as $$
declare v_tpl public.market_templates; v_def jsonb; v_pipe jsonb; v_pipeline_id uuid; v_stage jsonb; v_field jsonb; v_pos int;
begin
  if not public.is_org_member(p_org) then raise exception 'forbidden'; end if;
  if (select market_template from public.organizations where id = p_org) is not null then return; end if;  -- idempotente
  select * into v_tpl from public.market_templates where key = p_key and is_active order by version desc limit 1;
  if v_tpl.id is null then raise exception 'template not found: %', p_key; end if;
  v_def := v_tpl.definition;

  update public.organizations set market_template = p_key, market_template_version = v_tpl.version where id = p_org;

  for v_pipe in select value from jsonb_array_elements(coalesce(v_def -> 'pipelines', '[]'::jsonb)) loop
    insert into public.pipelines(organization_id, name, is_default, position, color)
    values (p_org, v_pipe ->> 'name', coalesce((v_pipe ->> 'is_default')::boolean, false),
            coalesce((v_pipe ->> 'position')::int, 0), coalesce(v_pipe ->> 'color', '#2563EB'))
    returning id into v_pipeline_id;
    v_pos := 0;
    for v_stage in select value from jsonb_array_elements(coalesce(v_pipe -> 'stages', '[]'::jsonb)) loop
      insert into public.pipeline_stages(organization_id, pipeline_id, name, position, type, probability)
      values (p_org, v_pipeline_id, v_stage ->> 'name', v_pos, coalesce(v_stage ->> 'type', 'open'), coalesce((v_stage ->> 'probability')::int, 0));
      v_pos := v_pos + 1;
    end loop;
  end loop;

  for v_field in select value from jsonb_array_elements(coalesce(v_def -> 'customer_custom_fields', '[]'::jsonb)) loop
    insert into public.customer_custom_fields(organization_id, key, label, field_type, position)
    values (p_org, v_field ->> 'key', v_field ->> 'label', coalesce(v_field ->> 'field_type', 'text'), coalesce((v_field ->> 'position')::int, 0))
    on conflict (organization_id, key) do nothing;
  end loop;

  perform public.write_audit(p_org, 'organization.template.applied', 'market_template', v_tpl.id,
    jsonb_build_object('key', p_key, 'version', v_tpl.version));
end; $$;
