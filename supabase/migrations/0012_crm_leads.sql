-- 0012_crm_leads.sql — Módulo CRM · Leads. Idempotente.
-- Lead = contato que ainda NÃO é cliente. Ao qualificar, converte-se em Customer
-- (converted_customer_id). Separação Lead/Customer/Deal como em CRMs robustos.

create table if not exists public.leads (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references public.organizations(id) on delete cascade,
  code                  text,                               -- LEAD-00001 (auto)
  name                  text not null,
  company_name          text,
  email                 text,
  phone                 text,
  source                text,
  status                text not null default 'new'
                          check (status in ('new','contacted','qualified','unqualified','converted')),
  owner_id              uuid references auth.users(id) on delete set null,
  notes                 text,
  tags                  text[] not null default '{}',
  custom_fields         jsonb  not null default '{}'::jsonb,
  converted_customer_id uuid references public.customers(id) on delete set null,
  converted_at          timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  deleted_at            timestamptz
);
comment on table public.leads is 'CRM: leads (pré-cliente). Converte para customers ao qualificar.';

create index if not exists idx_leads_org    on public.leads(organization_id) where deleted_at is null;
create index if not exists idx_leads_email  on public.leads(organization_id, email);
create index if not exists idx_leads_owner  on public.leads(owner_id);
create index if not exists idx_leads_status on public.leads(organization_id, status);
create unique index if not exists uq_leads_code on public.leads(organization_id, code) where code is not null;

drop trigger if exists trg_leads_updated_at on public.leads;
create trigger trg_leads_updated_at before update on public.leads
  for each row execute function public.set_updated_at();

drop trigger if exists trg_leads_code on public.leads;
create trigger trg_leads_code before insert on public.leads
  for each row execute function public.set_entity_code('LEAD', 'lead');
