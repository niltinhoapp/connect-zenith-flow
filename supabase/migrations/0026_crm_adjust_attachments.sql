-- 0026_crm_adjust_attachments.sql — Attachments: agnóstico de provedor. Idempotente.
-- storage_path, mime_type, size_bytes, uploaded_by já existem (0015).
alter table public.attachments
  add column if not exists storage_provider text not null default 'supabase',
  add column if not exists checksum         text;
