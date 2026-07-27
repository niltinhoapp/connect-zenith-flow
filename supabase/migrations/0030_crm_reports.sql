-- 0030_crm_reports.sql — Read model de Relatórios (agregações reais). Idempotente.
-- Uma RPC com as agregações dos gráficos. Preparada para a IA consumir os
-- mesmos números (mesma fonte da verdade). SECURITY DEFINER + checagem de membro.

create or replace function public.reports_metrics(p_org uuid)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_revenue_total bigint;
  v_won_count     int;
  v_trend         jsonb;
  v_funnel        jsonb;
  v_sources       jsonb;
begin
  if not public.is_org_member(p_org) then
    raise exception 'forbidden';
  end if;

  select coalesce(sum(amount), 0), count(*) into v_revenue_total, v_won_count
    from public.deals where organization_id = p_org and deleted_at is null and won_at is not null;

  -- Receita ganha por mês (12 meses)
  with months as (
    select date_trunc('month', current_date) - (interval '1 month' * (11 - g)) as m
    from generate_series(0, 11) g
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'm', to_char(months.m, 'Mon'),
    'v', coalesce(r.amount, 0)
  ) order by months.m), '[]'::jsonb) into v_trend
  from months
  left join (
    select date_trunc('month', won_at) m, sum(amount) amount
    from public.deals
    where organization_id = p_org and deleted_at is null and won_at is not null
    group by 1
  ) r on r.m = months.m;

  -- Funil: Leads → Qualificados → Convertidos → Negócios → Ganhos
  select jsonb_build_array(
    jsonb_build_object('s', 'Leads',        'v', (select count(*) from public.leads where organization_id = p_org and deleted_at is null)),
    jsonb_build_object('s', 'Qualificados', 'v', (select count(*) from public.leads where organization_id = p_org and deleted_at is null and qualified_at is not null)),
    jsonb_build_object('s', 'Convertidos',  'v', (select count(*) from public.leads where organization_id = p_org and deleted_at is null and status = 'converted')),
    jsonb_build_object('s', 'Negócios',     'v', (select count(*) from public.deals where organization_id = p_org and deleted_at is null)),
    jsonb_build_object('s', 'Ganhos',       'v', v_won_count)
  ) into v_funnel;

  -- Distribuição de leads por origem (top 5)
  select coalesce(jsonb_agg(jsonb_build_object('n', coalesce(src, 'Outros'), 'v', cnt) order by cnt desc), '[]'::jsonb)
    into v_sources
  from (
    select source src, count(*) cnt
    from public.leads
    where organization_id = p_org and deleted_at is null
    group by source
    order by cnt desc
    limit 5
  ) s;

  return jsonb_build_object(
    'revenueTotal', v_revenue_total,
    'wonCount', v_won_count,
    'avgTicket', case when v_won_count > 0 then (v_revenue_total / v_won_count) else 0 end,
    'revenueTrend', v_trend,
    'funnel', v_funnel,
    'sources', v_sources
  );
end;
$$;

grant execute on function public.reports_metrics(uuid) to authenticated;
