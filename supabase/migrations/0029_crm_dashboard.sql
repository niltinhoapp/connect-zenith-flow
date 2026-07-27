-- 0029_crm_dashboard.sql — Read model de indicadores do Dashboard. Idempotente.
-- Uma RPC com agregações no banco (evita N+1, um único round-trip). SECURITY
-- DEFINER + checagem de membro (RLS-equivalente). Preparada para IA consumir os
-- mesmos indicadores no futuro.

create or replace function public.dashboard_metrics(p_org uuid)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_active_customers int;
  v_leads_period     int;
  v_leads_converted  int;
  v_open_deals       int;
  v_revenue          bigint;
  v_won_count        int;
  v_pipeline         jsonb;
  v_activities       jsonb;
  v_series           jsonb;
begin
  if not public.is_org_member(p_org) then
    raise exception 'forbidden';
  end if;

  select count(*) into v_active_customers
    from public.customers
    where organization_id = p_org and status = 'active' and deleted_at is null;

  select count(*) into v_leads_period
    from public.leads
    where organization_id = p_org and deleted_at is null
      and created_at >= now() - interval '30 days';

  select count(*) into v_leads_converted
    from public.leads
    where organization_id = p_org and deleted_at is null and status = 'converted'
      and converted_at >= now() - interval '30 days';

  select count(*) into v_open_deals
    from public.deals
    where organization_id = p_org and deleted_at is null
      and won_at is null and lost_at is null;

  select coalesce(sum(amount), 0), count(*) into v_revenue, v_won_count
    from public.deals
    where organization_id = p_org and deleted_at is null
      and won_at >= date_trunc('month', now());

  select coalesce(
    jsonb_agg(jsonb_build_object('stage', s.name, 'count', coalesce(d.cnt, 0)) order by s.position),
    '[]'::jsonb
  ) into v_pipeline
  from public.pipeline_stages s
  left join (
    select stage_id, count(*) cnt
    from public.deals
    where organization_id = p_org and deleted_at is null and won_at is null and lost_at is null
    group by stage_id
  ) d on d.stage_id = s.id
  where s.organization_id = p_org and s.deleted_at is null and s.type = 'open';

  select coalesce(
    jsonb_agg(jsonb_build_object(
      'id', t.id, 'title', t.title, 'eventType', t.event_type,
      'module', t.module, 'createdAt', t.created_at
    ) order by t.created_at desc),
    '[]'::jsonb
  ) into v_activities
  from (
    select * from public.customer_timeline
    where organization_id = p_org and deleted_at is null
    order by created_at desc limit 8
  ) t;

  -- série de 7 dias: receita ganha (v) e novos leads (l) por dia
  with days as (
    select (current_date - (6 - g)) as d from generate_series(0, 6) g
  )
  select coalesce(
    jsonb_agg(jsonb_build_object(
      'date', days.d,
      'v', coalesce(rev.amount, 0),
      'l', coalesce(ld.cnt, 0)
    ) order by days.d),
    '[]'::jsonb
  ) into v_series
  from days
  left join (
    select date_trunc('day', won_at)::date d, sum(amount) amount
    from public.deals
    where organization_id = p_org and deleted_at is null and won_at >= current_date - 6
    group by 1
  ) rev on rev.d = days.d
  left join (
    select date_trunc('day', created_at)::date d, count(*) cnt
    from public.leads
    where organization_id = p_org and deleted_at is null and created_at >= current_date - 6
    group by 1
  ) ld on ld.d = days.d;

  return jsonb_build_object(
    'activeCustomers', v_active_customers,
    'revenueSeries', v_series,
    'leadsPeriod', v_leads_period,
    'openDeals', v_open_deals,
    'revenue', v_revenue,
    'wonCount', v_won_count,
    'avgTicket', case when v_won_count > 0 then (v_revenue / v_won_count) else 0 end,
    'conversionRate', case when v_leads_period > 0
      then round((v_leads_converted::numeric / v_leads_period) * 100, 1) else 0 end,
    'pipeline', v_pipeline,
    'recentActivities', v_activities
  );
end;
$$;

grant execute on function public.dashboard_metrics(uuid) to authenticated;
