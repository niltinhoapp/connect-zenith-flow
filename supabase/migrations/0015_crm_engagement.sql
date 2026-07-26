-- 0015_crm_engagement.sql — Módulo CRM · Timeline, Comments, Attachments. Idempotente.
-- Histórico da jornada do cliente + comentários + anexos (Supabase Storage).

-- ── customer_timeline (histórico de eventos da jornada) ──────────────────────
create table if not exists public.customer_timeline (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  customer_id      uuid references public.customers(id) on delete cascade,
  actor_id         uuid references auth.users(id) on delete set null,
  -- ex: customer.created, lead.converted, deal.created, whatsapp.sent, note,
  --     stage.changed, automation.executed, file.uploaded
  event_type       text not null,
  title            text not null,
  description      text,
  -- referência polimórfica ao objeto de origem (deal, comment, attachment…)
  related_type     text,
  related_id       uuid,
  metadata         jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz
);
comment on table public.customer_timeline is 'CRM: histórico/jornada do cliente (todos os eventos).';
create index if not exists idx_timeline_customer on public.customer_timeline(organization_id, customer_id, created_at desc);

drop trigger if exists trg_timeline_updated_at on public.customer_timeline;
create trigger trg_timeline_updated_at before update on public.customer_timeline
  for each row execute function public.set_updated_at();

-- ── comments (relacionável a customer / deal / lead / timeline) ───────────────
create table if not exists public.comments (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  author_id        uuid references auth.users(id) on delete set null,
  body             text not null,
  related_type     text not null check (related_type in ('customer','deal','lead','timeline')),
  related_id       uuid not null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz
);
comment on table public.comments is 'CRM: comentários polimórficos (customer/deal/lead/timeline).';
create index if not exists idx_comments_related on public.comments(organization_id, related_type, related_id);

drop trigger if exists trg_comments_updated_at on public.comments;
create trigger trg_comments_updated_at before update on public.comments
  for each row execute function public.set_updated_at();

-- ── attachments (Supabase Storage) ───────────────────────────────────────────
create table if not exists public.attachments (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  uploaded_by      uuid references auth.users(id) on delete set null,
  storage_bucket   text not null default 'attachments',
  storage_path     text not null,                          -- org/{id}/...
  file_name        text not null,
  mime_type        text,
  size_bytes       bigint,
  related_type     text check (related_type in ('customer','deal','lead','timeline','comment')),
  related_id       uuid,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz
);
comment on table public.attachments is 'CRM: anexos (metadados; binário no Supabase Storage).';
create index if not exists idx_attachments_related on public.attachments(organization_id, related_type, related_id);

drop trigger if exists trg_attachments_updated_at on public.attachments;
create trigger trg_attachments_updated_at before update on public.attachments
  for each row execute function public.set_updated_at();
