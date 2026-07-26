-- 0025_crm_adjust_comments.sql — Comments encadeados. Idempotente.
-- author_id e deleted_at já existem (0015). Adiciona edição e threading.
alter table public.comments
  add column if not exists edited_at timestamptz,
  add column if not exists reply_to  uuid references public.comments(id) on delete set null;

create index if not exists idx_comments_reply on public.comments(reply_to) where reply_to is not null;
