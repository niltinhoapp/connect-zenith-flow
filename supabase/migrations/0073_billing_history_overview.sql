-- 0073_billing_history_overview.sql
-- Expõe histórico seguro de compras e estado da assinatura no resumo financeiro.

create or replace function public.billing_overview(p_org uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_result jsonb;
begin
  if not public.is_org_member(p_org) then raise exception 'forbidden'; end if;
  select jsonb_build_object(
    'subscription', (select to_jsonb(s) - 'metadata' from public.billing_subscriptions s where s.organization_id = p_org),
    'products', (select coalesce(jsonb_agg(to_jsonb(p) - 'metadata' order by p.position), '[]'::jsonb)
                   from public.billing_products p where p.is_active),
    'purchases', (select coalesce(jsonb_agg(jsonb_build_object(
      'id', x.id,
      'product_id', x.product_id,
      'product_name', p.name,
      'status', x.status,
      'amount_cents', x.amount_cents,
      'credits', x.credits,
      'invoice_url', nullif(x.metadata->>'invoice_url', ''),
      'paid_at', x.paid_at,
      'created_at', x.created_at
    ) order by x.created_at desc), '[]'::jsonb)
      from (select * from public.billing_purchases
            where organization_id = p_org order by created_at desc limit 20) x
      join public.billing_products p on p.id = x.product_id),
    'ai', jsonb_build_object(
      'monthly_limit', coalesce((select pl.limit_value from public.organizations o
        join public.plan_limits pl on pl.plan_id = o.plan_id and pl.resource = 'ai_credits'
        where o.id = p_org), 0),
      'monthly_used', coalesce((select q.used from public.quota_usage q
        where q.organization_id = p_org and q.resource = 'ai_credits'
          and q.period_key = to_char(now(), 'YYYY-MM')), 0),
      'additional_balance', coalesce((select w.balance from public.ai_credit_wallets w
        where w.organization_id = p_org), 0)
    ),
    'meta_fees_included', false
  ) into v_result;
  return v_result;
end; $$;

grant execute on function public.billing_overview(uuid) to authenticated;
