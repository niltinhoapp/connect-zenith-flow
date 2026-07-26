-- 0016_crm_reference.sql — Módulo CRM · Tabelas de referência. Idempotente.
-- Personalização por organização: catálogos de tags e definições de campos
-- customizados (que preenchem o jsonb custom_fields de customers/deals).

create table if not exists public.customer_tags (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  name             text not null,
  color            text not null default '#2563EB',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create unique index if not exists uq_customer_tags on public.customer_tags(organization_id, name);

create table if not exists public.deal_tags (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  name             text not null,
  color            text not null default '#2563EB',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create unique index if not exists uq_deal_tags on public.deal_tags(organization_id, name);

-- Definições de campos customizados (schema de personalização).
create table if not exists public.customer_custom_fields (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  key              text not null,
  label            text not null,
  field_type       text not null default 'text'
                     check (field_type in ('text','number','date','select','boolean')),
  options          jsonb not null default '[]'::jsonb,
  position         int not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create unique index if not exists uq_customer_custom_fields on public.customer_custom_fields(organization_id, key);

create table if not exists public.deal_custom_fields (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  key              text not null,
  label            text not null,
  field_type       text not null default 'text'
                     check (field_type in ('text','number','date','select','boolean')),
  options          jsonb not null default '[]'::jsonb,
  position         int not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create unique index if not exists uq_deal_custom_fields on public.deal_custom_fields(organization_id, key);

-- updated_at triggers
do $$
declare t text;
begin
  foreach t in array array['customer_tags','deal_tags','customer_custom_fields','deal_custom_fields'] loop
    execute format('drop trigger if exists trg_%1$s_updated_at on public.%1$s', t);
    execute format(
      'create trigger trg_%1$s_updated_at before update on public.%1$s for each row execute function public.set_updated_at()', t);
  end loop;
end $$;
