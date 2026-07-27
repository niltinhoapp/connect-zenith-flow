-- 0047_hardening_quota_atomic.sql — C2: consumo de cota atômico (sem race). Idempotente.
-- Verifica + incrementa em uma transação com lock de linha (FOR UPDATE).

create or replace function public.try_consume_quota(p_org uuid, p_resource text, p_amount bigint default 1)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_plan text; v_limit bigint; v_period text; v_key text; v_used bigint;
begin
  if auth.uid() is not null and not public.is_org_member(p_org) then raise exception 'forbidden'; end if;

  select plan_id into v_plan from public.organizations where id = p_org;
  select limit_value, period into v_limit, v_period
    from public.plan_limits where plan_id = coalesce(v_plan, 'free') and resource = p_resource;
  v_key := case when coalesce(v_period, 'month') = 'month' then to_char(now(), 'YYYY-MM') else 'total' end;

  -- garante a linha, então trava para serializar consumidores concorrentes
  insert into public.quota_usage(organization_id, resource, period_key, used)
  values (p_org, p_resource, v_key, 0)
  on conflict (organization_id, resource, period_key) do nothing;

  select used into v_used from public.quota_usage
    where organization_id = p_org and resource = p_resource and period_key = v_key
    for update;

  if v_limit is not null and v_limit >= 0 and v_used + p_amount > v_limit then
    return false;  -- não cabe
  end if;

  update public.quota_usage set used = v_used + p_amount, updated_at = now()
    where organization_id = p_org and resource = p_resource and period_key = v_key;
  return true;
end; $$;

grant execute on function public.try_consume_quota(uuid, text, bigint) to authenticated, service_role;
