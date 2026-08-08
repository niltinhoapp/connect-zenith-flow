-- 0069_recalibrate_ai_token_quotas.sql
-- ai_credits mede tokens reais (entrada + saída), não quantidade de cliques.
-- Os limites anteriores eram menores que uma única análise comum.

insert into public.plan_limits(plan_id, resource, limit_value, period) values
  ('free',       'ai_credits',   50000, 'month'),
  ('starter',    'ai_credits', 1000000, 'month'),
  ('pro',        'ai_credits', 5000000, 'month'),
  ('enterprise', 'ai_credits',      -1, 'month')
on conflict (plan_id, resource) do update set
  limit_value = excluded.limit_value,
  period = excluded.period;

