-- 0071_billing_and_ai_addons.sql
-- Plano comercial único + pacotes avulsos de IA, independente do PSP.

create table if not exists public.billing_products (
  id text primary key,
  kind text not null check (kind in ('subscription','ai_addon')),
  name text not null,
  description text not null default '',
  price_cents integer not null check (price_cents >= 0),
  currency text not null default 'BRL' check (currency = 'BRL'),
  billing_interval text check (billing_interval in ('month') or billing_interval is null),
  ai_credits bigint not null default 0 check (ai_credits >= 0),
  position integer not null default 0,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.billing_products
  (id, kind, name, description, price_cents, billing_interval, ai_credits, position, metadata)
values
  ('connectweb_complete', 'subscription', 'ConnectWeb Completo',
   'Todos os módulos e fluxos da ConnectWeb.', 54979, 'month', 5000000, 0,
   '{"all_modules":true,"meta_fees_included":false}'::jsonb),
  ('ai_advantage', 'ai_addon', 'IA Advantage',
   'Créditos adicionais para uso pontual.', 5990, null, 1000000, 10, '{}'::jsonb),
  ('ai_turbo', 'ai_addon', 'IA Turbo',
   'Créditos adicionais para atendimento e automações intensivas.', 14990, null, 3000000, 20, '{}'::jsonb),
  ('ai_ultra', 'ai_addon', 'IA Ultra',
   'Créditos adicionais para operações de alto volume.', 39990, null, 10000000, 30, '{}'::jsonb)
on conflict (id) do update set
  name = excluded.name, description = excluded.description,
  price_cents = excluded.price_cents, billing_interval = excluded.billing_interval,
  ai_credits = excluded.ai_credits, position = excluded.position,
  metadata = excluded.metadata, is_active = true, updated_at = now();

-- Um único plano comercial. Módulos podem ser desligados pela empresa, mas
-- isso não muda preço nem entitlement. Mensagens da Meta não são limitadas ou
-- cobradas pela ConnectWeb.
insert into public.plan_limits(plan_id, resource, limit_value, period) values
  ('connectweb_complete', 'customers',          -1, 'total'),
  ('connectweb_complete', 'messages',           -1, 'month'),
  ('connectweb_complete', 'ai_credits',    5000000, 'month'),
  ('connectweb_complete', 'storage_bytes', 107374182400, 'total'),
  ('connectweb_complete', 'api_calls',      500000, 'month')
on conflict (plan_id, resource) do update set
  limit_value = excluded.limit_value, period = excluded.period, updated_at = now();

alter table public.organizations alter column plan_id set default 'connectweb_complete';
alter table public.organizations alter column enabled_modules set default
  array['dashboard','crm','clientes','whatsapp','automacoes','ia','relatorios','configuracoes','billing'];

update public.organizations set
  plan_id = 'connectweb_complete',
  enabled_modules = array['dashboard','crm','clientes','whatsapp','automacoes','ia','relatorios','configuracoes','billing'],
  updated_at = now()
where deleted_at is null;

create table if not exists public.billing_subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.organizations(id) on delete cascade,
  product_id text not null default 'connectweb_complete' references public.billing_products(id),
  status text not null default 'incomplete'
    check (status in ('incomplete','trialing','active','past_due','unpaid','paused','canceled')),
  provider text,
  provider_customer_id text,
  provider_subscription_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  canceled_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists uq_billing_subscription_provider
  on public.billing_subscriptions(provider, provider_subscription_id)
  where provider_subscription_id is not null;

create table if not exists public.billing_purchases (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  product_id text not null references public.billing_products(id),
  status text not null default 'pending'
    check (status in ('pending','paid','failed','canceled','refunded')),
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null default 'BRL' check (currency = 'BRL'),
  credits bigint not null check (credits > 0),
  idempotency_key text not null,
  provider text,
  provider_checkout_id text,
  provider_payment_id text,
  paid_at timestamptz,
  failed_at timestamptz,
  refunded_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, idempotency_key)
);
create index if not exists idx_billing_purchases_org_created
  on public.billing_purchases(organization_id, created_at desc);
create unique index if not exists uq_billing_purchase_provider_payment
  on public.billing_purchases(provider, provider_payment_id)
  where provider_payment_id is not null;

create table if not exists public.ai_credit_wallets (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  balance bigint not null default 0 check (balance >= 0),
  total_purchased bigint not null default 0 check (total_purchased >= 0),
  total_consumed bigint not null default 0 check (total_consumed >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_credit_ledger (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  purchase_id uuid references public.billing_purchases(id) on delete set null,
  kind text not null check (kind in ('purchase','consume','refund','adjustment')),
  amount bigint not null check (amount <> 0),
  balance_after bigint not null check (balance_after >= 0),
  idempotency_key text not null,
  description text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (organization_id, idempotency_key)
);
create index if not exists idx_ai_credit_ledger_org_created
  on public.ai_credit_ledger(organization_id, created_at desc);

-- Leitura multiempresa; mutações somente por RPC/webhook seguro.
alter table public.billing_products enable row level security;
alter table public.billing_subscriptions enable row level security;
alter table public.billing_purchases enable row level security;
alter table public.ai_credit_wallets enable row level security;
alter table public.ai_credit_ledger enable row level security;

drop policy if exists billing_products_select on public.billing_products;
create policy billing_products_select on public.billing_products for select to authenticated using (is_active);

do $$
declare t text;
begin
  foreach t in array array['billing_subscriptions','billing_purchases','ai_credit_wallets','ai_credit_ledger'] loop
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.is_org_member(organization_id))',
      t || '_select', t
    );
  end loop;
end $$;

create or replace function public.request_ai_addon_purchase(
  p_org uuid, p_product text, p_idempotency_key text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_product public.billing_products; v_id uuid;
begin
  if not public.has_permission(p_org, 'billing.manage') then raise exception 'forbidden'; end if;
  if nullif(trim(p_idempotency_key), '') is null then raise exception 'idempotency key required'; end if;
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

-- Chamada somente pelo webhook de pagamento usando service_role.
create or replace function public.settle_ai_addon_purchase(
  p_purchase uuid, p_provider text, p_payment_id text
) returns bigint
language plpgsql security definer set search_path = public as $$
declare v_purchase public.billing_purchases; v_balance bigint;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'forbidden'; end if;
  if nullif(trim(p_provider), '') is null or nullif(trim(p_payment_id), '') is null then
    raise exception 'provider and payment id required';
  end if;
  select * into v_purchase from public.billing_purchases where id = p_purchase for update;
  if v_purchase.id is null then raise exception 'purchase not found'; end if;
  if v_purchase.status = 'paid' then
    select balance into v_balance from public.ai_credit_wallets where organization_id = v_purchase.organization_id;
    return coalesce(v_balance, 0);
  end if;
  if v_purchase.status <> 'pending' then raise exception 'purchase is not pending'; end if;

  insert into public.ai_credit_wallets(organization_id, balance, total_purchased)
  values (v_purchase.organization_id, v_purchase.credits, v_purchase.credits)
  on conflict (organization_id) do update set
    balance = public.ai_credit_wallets.balance + excluded.balance,
    total_purchased = public.ai_credit_wallets.total_purchased + excluded.total_purchased,
    updated_at = now()
  returning balance into v_balance;

  insert into public.ai_credit_ledger(
    organization_id, purchase_id, kind, amount, balance_after,
    idempotency_key, description
  ) values (
    v_purchase.organization_id, v_purchase.id, 'purchase', v_purchase.credits, v_balance,
    'purchase:' || v_purchase.id::text, 'Pacote adicional de IA'
  ) on conflict (organization_id, idempotency_key) do nothing;

  update public.billing_purchases set
    status = 'paid', provider = left(p_provider, 50),
    provider_payment_id = left(p_payment_id, 255), paid_at = now(), updated_at = now()
  where id = v_purchase.id;
  return v_balance;
end; $$;

-- Estende a cota atômica existente: franquia mensal primeiro, carteira depois.
create or replace function public.try_consume_quota(
  p_org uuid, p_resource text, p_amount bigint default 1
) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_plan text; v_limit bigint; v_period text; v_key text; v_used bigint;
  v_included_part bigint; v_bonus_part bigint; v_balance bigint;
begin
  if p_amount <= 0 then raise exception 'amount must be positive'; end if;
  if auth.uid() is not null and not public.is_org_member(p_org) then raise exception 'forbidden'; end if;

  select plan_id into v_plan from public.organizations where id = p_org;
  select limit_value, period into v_limit, v_period from public.plan_limits
   where plan_id = coalesce(v_plan, 'free') and resource = p_resource;
  v_key := case when coalesce(v_period, 'month') = 'month' then to_char(now(), 'YYYY-MM') else 'total' end;

  insert into public.quota_usage(organization_id, resource, period_key, used)
  values (p_org, p_resource, v_key, 0)
  on conflict (organization_id, resource, period_key) do nothing;
  select used into v_used from public.quota_usage
   where organization_id = p_org and resource = p_resource and period_key = v_key
   for update;

  if p_resource <> 'ai_credits' or v_limit is null or v_limit < 0 then
    if v_limit is not null and v_limit >= 0 and v_used + p_amount > v_limit then return false; end if;
    update public.quota_usage set used = v_used + p_amount, updated_at = now()
     where organization_id = p_org and resource = p_resource and period_key = v_key;
    return true;
  end if;

  v_included_part := least(p_amount, greatest(v_limit - v_used, 0));
  v_bonus_part := p_amount - v_included_part;
  if v_bonus_part > 0 then
    insert into public.ai_credit_wallets(organization_id) values (p_org)
    on conflict (organization_id) do nothing;
    select balance into v_balance from public.ai_credit_wallets where organization_id = p_org for update;
    if v_balance < v_bonus_part then return false; end if;
    v_balance := v_balance - v_bonus_part;
    update public.ai_credit_wallets set
      balance = v_balance, total_consumed = total_consumed + v_bonus_part, updated_at = now()
    where organization_id = p_org;
    insert into public.ai_credit_ledger(
      organization_id, kind, amount, balance_after, idempotency_key, description
    ) values (
      p_org, 'consume', -v_bonus_part, v_balance,
      'consume:' || gen_random_uuid()::text, 'Uso adicional de IA'
    );
  end if;

  update public.quota_usage set used = v_used + v_included_part, updated_at = now()
   where organization_id = p_org and resource = p_resource and period_key = v_key;
  return true;
end; $$;

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

grant execute on function public.request_ai_addon_purchase(uuid, text, text) to authenticated;
grant execute on function public.settle_ai_addon_purchase(uuid, text, text) to service_role;
grant execute on function public.billing_overview(uuid) to authenticated;
grant execute on function public.try_consume_quota(uuid, text, bigint) to authenticated, service_role;
revoke all on function public.settle_ai_addon_purchase(uuid, text, text) from public, anon, authenticated;
