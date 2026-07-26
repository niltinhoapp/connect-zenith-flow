-- 0024_crm_adjust_leads.sql — Lead: marco de qualificação. Idempotente.
-- Fluxo: new → contacted → qualified (qualified_at) → converted (vira Customer).
alter table public.leads
  add column if not exists qualified_at timestamptz;
