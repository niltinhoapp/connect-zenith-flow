-- 0027_crm_adjust_timeline.sql — Timeline como hub de eventos de QUALQUER módulo.
-- Idempotente. Padroniza em event_type + payload (jsonb) + module, evitando
-- mudanças de schema quando novos módulos (WhatsApp, IA, Agenda, Financeiro,
-- Marketing, API…) passarem a registrar eventos.

-- Renomeia metadata → payload (uma vez).
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'customer_timeline' and column_name = 'metadata'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'customer_timeline' and column_name = 'payload'
  ) then
    alter table public.customer_timeline rename column metadata to payload;
  end if;
end $$;

alter table public.customer_timeline
  add column if not exists payload jsonb not null default '{}'::jsonb,
  add column if not exists module  text;   -- crm | whatsapp | ia | automation | ...

create index if not exists idx_timeline_module on public.customer_timeline(organization_id, module, created_at desc);
