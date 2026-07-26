-- 0022_crm_adjust_deals.sql — Deals: campos de fechamento p/ relatórios. Idempotente.
alter table public.deals
  add column if not exists won_at               timestamptz,
  add column if not exists lost_at              timestamptz,
  add column if not exists loss_reason          text,
  add column if not exists win_reason           text,
  add column if not exists probability_override int check (probability_override between 0 and 100);
-- expected_close_date já existe (0014).
