-- 0011_crm_customers.sql — Módulo CRM · Customers. Idempotente.
-- Entidade Customer (pessoa ou empresa) preparada para crescer: contato,
-- documento, origem, tags, custom_fields (jsonb). Distinta de Lead (0012).

create table if not exists public.customers (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  code             text,                                    -- CUST-00001 (auto)
  type             text not null default 'person' check (type in ('person','company')),
  first_name       text,
  last_name        text,
  company_name     text,
  document         text,                                    -- CPF/CNPJ
  email            text,
  phone            text,
  mobile           text,
  website          text,
  status           text not null default 'active'
                     check (status in ('active','inactive','prospect','vip')),
  owner_id         uuid references auth.users(id) on delete set null,
  source           text,
  notes            text,
  tags             text[] not null default '{}',
  custom_fields    jsonb  not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz
);
comment on table public.customers is 'CRM: clientes (pessoa/empresa). Preparado para crescer (custom_fields, tags).';

create index if not exists idx_customers_org      on public.customers(organization_id) where deleted_at is null;
create index if not exists idx_customers_email     on public.customers(organization_id, email);
create index if not exists idx_customers_document  on public.customers(organization_id, document);
create index if not exists idx_customers_owner     on public.customers(owner_id);
create index if not exists idx_customers_status    on public.customers(organization_id, status);
create unique index if not exists uq_customers_code on public.customers(organization_id, code) where code is not null;

drop trigger if exists trg_customers_updated_at on public.customers;
create trigger trg_customers_updated_at before update on public.customers
  for each row execute function public.set_updated_at();

drop trigger if exists trg_customers_code on public.customers;
create trigger trg_customers_code before insert on public.customers
  for each row execute function public.set_entity_code('CUST', 'customer');
