-- 0072_asaas_billing_provider.sql
-- Adaptador persistente do Asaas. Valores e créditos continuam definidos no
-- catálogo interno; o PSP nunca é tratado como fonte de entitlement.

create table if not exists public.billing_customer_profiles (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  legal_name text not null,
  email text not null,
  tax_id text not null,
  phone text,
  provider text,
  provider_customer_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists uq_billing_customer_provider
  on public.billing_customer_profiles(provider, provider_customer_id)
  where provider_customer_id is not null;

create table if not exists public.billing_provider_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null,
  event_type text not null,
  provider_object_id text,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'received'
    check (status in ('received','processed','ignored','failed')),
  error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (provider, provider_event_id)
);
create index if not exists idx_billing_provider_events_status
  on public.billing_provider_events(status, received_at);

alter table public.billing_customer_profiles enable row level security;
alter table public.billing_provider_events enable row level security;

drop policy if exists billing_customer_profiles_select on public.billing_customer_profiles;
create policy billing_customer_profiles_select on public.billing_customer_profiles
  for select to authenticated using (public.is_org_member(organization_id));
-- Eventos contêm o payload bruto do PSP e são deliberadamente service_role-only.

create or replace function public.store_billing_customer_profile(
  p_org uuid, p_legal_name text, p_email text, p_tax_id text, p_phone text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare v_tax text := regexp_replace(coalesce(p_tax_id, ''), '\D', '', 'g');
begin
  if not public.has_permission(p_org, 'billing.manage') then raise exception 'forbidden'; end if;
  if length(trim(coalesce(p_legal_name, ''))) < 2 then raise exception 'legal name required'; end if;
  if trim(coalesce(p_email, '')) !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'invalid email'; end if;
  if length(v_tax) not in (11, 14) then raise exception 'invalid tax id'; end if;

  insert into public.billing_customer_profiles(organization_id, legal_name, email, tax_id, phone)
  values (p_org, trim(p_legal_name), lower(trim(p_email)), v_tax,
          nullif(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), ''))
  on conflict (organization_id) do update set
    legal_name = excluded.legal_name, email = excluded.email, tax_id = excluded.tax_id,
    phone = excluded.phone, updated_at = now();
end; $$;

-- Anexa os identificadores criados no PSP sem permitir alteração de preço.
create or replace function public.attach_asaas_addon_checkout(
  p_purchase uuid, p_customer_id text, p_payment_id text, p_invoice_url text
) returns void
language plpgsql security definer set search_path = public as $$
declare v_purchase public.billing_purchases;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'forbidden'; end if;
  select * into v_purchase from public.billing_purchases where id = p_purchase for update;
  if v_purchase.id is null then raise exception 'purchase not found'; end if;
  if v_purchase.status <> 'pending' then raise exception 'purchase is not pending'; end if;

  update public.billing_customer_profiles set
    provider = 'asaas', provider_customer_id = left(trim(p_customer_id), 255), updated_at = now()
  where organization_id = v_purchase.organization_id;

  update public.billing_purchases set
    provider = 'asaas', provider_checkout_id = left(trim(p_payment_id), 255),
    provider_payment_id = left(trim(p_payment_id), 255),
    metadata = metadata || jsonb_build_object('invoice_url', left(trim(p_invoice_url), 2048)),
    updated_at = now()
  where id = v_purchase.id;
end; $$;

create or replace function public.record_billing_provider_event(
  p_provider text, p_event_id text, p_event_type text,
  p_object_id text, p_payload jsonb
) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_inserted integer;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'forbidden'; end if;
  insert into public.billing_provider_events(
    provider, provider_event_id, event_type, provider_object_id, payload
  ) values (
    left(trim(p_provider), 50), left(trim(p_event_id), 255), left(trim(p_event_type), 100),
    left(trim(coalesce(p_object_id, '')), 255), coalesce(p_payload, '{}'::jsonb)
  ) on conflict (provider, provider_event_id) do update set
    status = 'received', error = null, processed_at = null, received_at = now()
  where public.billing_provider_events.status = 'failed';
  get diagnostics v_inserted = row_count;
  return v_inserted = 1;
end; $$;

create or replace function public.finish_billing_provider_event(
  p_provider text, p_event_id text, p_status text, p_error text default null
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.role() is distinct from 'service_role' then raise exception 'forbidden'; end if;
  if p_status not in ('processed','ignored','failed') then raise exception 'invalid event status'; end if;
  update public.billing_provider_events set
    status = p_status, error = left(p_error, 2000), processed_at = now()
  where provider = p_provider and provider_event_id = p_event_id;
end; $$;

create or replace function public.fail_asaas_addon_purchase(
  p_payment_id text, p_status text
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.role() is distinct from 'service_role' then raise exception 'forbidden'; end if;
  if p_status not in ('failed','canceled') then raise exception 'invalid purchase status'; end if;
  update public.billing_purchases set
    status = p_status,
    failed_at = case when p_status = 'failed' then now() else failed_at end,
    updated_at = now()
  where provider = 'asaas' and provider_payment_id = p_payment_id and status = 'pending';
end; $$;

grant execute on function public.store_billing_customer_profile(uuid, text, text, text, text) to authenticated;
grant execute on function public.attach_asaas_addon_checkout(uuid, text, text, text) to service_role;
grant execute on function public.record_billing_provider_event(text, text, text, text, jsonb) to service_role;
grant execute on function public.finish_billing_provider_event(text, text, text, text) to service_role;
grant execute on function public.fail_asaas_addon_purchase(text, text) to service_role;

revoke all on function public.attach_asaas_addon_checkout(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.record_billing_provider_event(text, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.finish_billing_provider_event(text, text, text, text) from public, anon, authenticated;
revoke all on function public.fail_asaas_addon_purchase(text, text) from public, anon, authenticated;
