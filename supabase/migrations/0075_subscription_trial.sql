-- 0075_subscription_trial.sql
-- Período gratuito de 14 dias separado do catálogo/entitlement do plano.

alter table public.billing_subscriptions
  add column if not exists trial_started_at timestamptz,
  add column if not exists trial_ends_at timestamptz,
  add column if not exists provider_checkout_id text;

alter table public.billing_subscriptions drop constraint if exists billing_subscriptions_status_check;
alter table public.billing_subscriptions add constraint billing_subscriptions_status_check
  check (status in ('incomplete','trialing','trial_expired','active','past_due','unpaid','paused','canceled'));

create unique index if not exists uq_billing_subscription_checkout
  on public.billing_subscriptions(provider, provider_checkout_id)
  where provider_checkout_id is not null;

create or replace function public.create_organization_trial()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.billing_subscriptions(
    organization_id, product_id, status, trial_started_at, trial_ends_at
  ) values (
    new.id, 'connectweb_complete', 'trialing', now(), now() + interval '14 days'
  ) on conflict (organization_id) do nothing;
  return new;
end; $$;

drop trigger if exists on_organization_trial on public.organizations;
create trigger on_organization_trial
  after insert on public.organizations
  for each row execute function public.create_organization_trial();

-- Empresas existentes ganham trial apenas quando ainda não possuem assinatura.
insert into public.billing_subscriptions(
  organization_id, product_id, status, trial_started_at, trial_ends_at
)
select o.id, 'connectweb_complete', 'trialing', now(), now() + interval '14 days'
from public.organizations o
where o.deleted_at is null
on conflict (organization_id) do nothing;

create or replace function public.refresh_subscription_state(p_org uuid)
returns public.billing_subscriptions
language plpgsql security definer set search_path = public as $$
declare v_subscription public.billing_subscriptions;
begin
  if auth.role() is distinct from 'service_role' and not public.is_org_member(p_org) then
    raise exception 'forbidden';
  end if;
  update public.billing_subscriptions set status = 'trial_expired', updated_at = now()
  where organization_id = p_org and status = 'trialing' and trial_ends_at <= now();
  select * into v_subscription from public.billing_subscriptions where organization_id = p_org;
  return v_subscription;
end; $$;

create or replace function public.billing_access(p_org uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_subscription public.billing_subscriptions; v_days integer;
begin
  if not public.is_org_member(p_org) then raise exception 'forbidden'; end if;
  select * into v_subscription from public.refresh_subscription_state(p_org);
  v_days := case when v_subscription.status = 'trialing'
    then greatest(0, ceil(extract(epoch from (v_subscription.trial_ends_at - now())) / 86400.0)::integer)
    else 0 end;
  return jsonb_build_object(
    'status', v_subscription.status,
    'trial_started_at', v_subscription.trial_started_at,
    'trial_ends_at', v_subscription.trial_ends_at,
    'trial_days_remaining', v_days,
    'can_use_paid_features', v_subscription.status in ('trialing','active'),
    'can_buy_addons', v_subscription.status = 'active',
    'needs_subscription', v_subscription.status in ('trial_expired','incomplete','past_due','unpaid','paused','canceled')
  );
end; $$;

create or replace function public.attach_asaas_subscription_checkout(
  p_org uuid, p_customer_id text, p_checkout_id text, p_checkout_url text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'forbidden'; end if;
  update public.billing_customer_profiles set provider = 'asaas',
    provider_customer_id = coalesce(nullif(left(trim(p_customer_id), 255), ''), provider_customer_id), updated_at = now()
  where organization_id = p_org;
  update public.billing_subscriptions set provider = 'asaas',
    provider_customer_id = coalesce(nullif(left(trim(p_customer_id), 255), ''), provider_customer_id),
    provider_checkout_id = left(trim(p_checkout_id), 255),
    metadata = metadata || jsonb_build_object('checkout_url', left(trim(p_checkout_url), 2048)),
    updated_at = now()
  where organization_id = p_org returning id into v_id;
  if v_id is null then raise exception 'subscription not found'; end if;
  return v_id;
end; $$;

create or replace function public.activate_asaas_subscription(
  p_checkout_id text, p_provider_subscription_id text default null
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.role() is distinct from 'service_role' then raise exception 'forbidden'; end if;
  update public.billing_subscriptions set
    status = 'active', provider = 'asaas',
    provider_subscription_id = coalesce(nullif(trim(p_provider_subscription_id), ''), provider_subscription_id),
    current_period_start = now(), current_period_end = now() + interval '1 month',
    trial_ends_at = coalesce(trial_ends_at, now()), updated_at = now()
  where provider = 'asaas' and provider_checkout_id = p_checkout_id;
end; $$;

grant execute on function public.refresh_subscription_state(uuid) to authenticated, service_role;
grant execute on function public.billing_access(uuid) to authenticated;
grant execute on function public.attach_asaas_subscription_checkout(uuid, text, text, text) to service_role;
grant execute on function public.activate_asaas_subscription(text, text) to service_role;
revoke all on function public.attach_asaas_subscription_checkout(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.activate_asaas_subscription(text, text) from public, anon, authenticated;
revoke all on function public.refresh_subscription_state(uuid) from public, anon;

-- Pacotes adicionais só podem ser comprados por assinantes ativos.
create or replace function public.request_ai_addon_purchase(
  p_org uuid, p_product text, p_idempotency_key text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_product public.billing_products; v_id uuid; v_status text;
begin
  if not public.has_permission(p_org, 'billing.manage') then raise exception 'forbidden'; end if;
  if nullif(trim(p_idempotency_key), '') is null then raise exception 'idempotency key required'; end if;
  select status into v_status from public.refresh_subscription_state(p_org);
  if v_status <> 'active' then raise exception 'active subscription required'; end if;
  select * into v_product from public.billing_products
   where id = p_product and kind = 'ai_addon' and is_active;
  if v_product.id is null then raise exception 'addon not found'; end if;
  insert into public.billing_purchases(
    organization_id, product_id, amount_cents, currency, credits,
    idempotency_key, created_by
  ) values (
    p_org, v_product.id, v_product.price_cents, v_product.currency,
    v_product.ai_credits, trim(p_idempotency_key), auth.uid()
  ) on conflict (organization_id, idempotency_key) do update
      set updated_at = public.billing_purchases.updated_at
  returning id into v_id;
  return v_id;
end; $$;

grant execute on function public.request_ai_addon_purchase(uuid, text, text) to authenticated;
