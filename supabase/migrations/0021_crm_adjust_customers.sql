-- 0021_crm_adjust_customers.sql — Customer: campos para IA/automação. Idempotente.
alter table public.customers
  add column if not exists last_contact_at  timestamptz,
  add column if not exists next_followup_at timestamptz,
  add column if not exists score            int,
  add column if not exists lifetime_value   bigint not null default 0,   -- centavos
  add column if not exists origin_channel   text;

create index if not exists idx_customers_followup
  on public.customers(organization_id, next_followup_at)
  where next_followup_at is not null;
