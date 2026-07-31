-- 0058_whatsapp_service.sql — F3.1.3 · Atendimento + Respostas. Idempotente.
-- Tags e notas internas na conversa; respostas rápidas; RPCs de status/tags.
-- Reusa RLS por organização + permissões whatsapp.* já existentes.

-- ── Tags na conversa ─────────────────────────────────────────────────────────
alter table public.conversations add column if not exists tags text[] not null default '{}';
create index if not exists idx_conversations_tags on public.conversations using gin (tags);

-- ── Notas internas (não vão para o cliente) ─────────────────────────────────
create table if not exists public.conversation_notes (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  conversation_id  uuid not null references public.conversations(id) on delete cascade,
  author_id        uuid references auth.users(id) on delete set null,
  body             text not null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists idx_conv_notes_conv on public.conversation_notes(conversation_id, created_at);
create index if not exists idx_conv_notes_org on public.conversation_notes(organization_id);

-- ── Respostas rápidas (canned responses, por organização) ───────────────────
create table if not exists public.quick_replies (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  shortcut         text not null,                          -- ex.: /ola
  title            text not null,
  body             text not null,
  created_by       uuid references auth.users(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz
);
create index if not exists idx_quick_replies_org on public.quick_replies(organization_id) where deleted_at is null;
create unique index if not exists uq_quick_replies_shortcut on public.quick_replies(organization_id, shortcut) where deleted_at is null;

-- ── RPCs de atendimento ──────────────────────────────────────────────────────
-- Status: open|pending|closed (UI rotula como Aberta|Pendente|Resolvida).
create or replace function public.wa_set_conversation_status(p_org uuid, p_conversation uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_permission(p_org, 'whatsapp.send') then raise exception 'forbidden'; end if;
  if p_status not in ('open','pending','closed') then raise exception 'invalid status: %', p_status; end if;
  update public.conversations set status = p_status, updated_at = now()
    where id = p_conversation and organization_id = p_org and deleted_at is null;
  if not found then raise exception 'conversation not found'; end if;
  perform public.publish_event(p_org,
    case p_status when 'closed' then 'whatsapp.conversation.closed' else 'whatsapp.conversation.opened' end,
    jsonb_build_object('conversationId', p_conversation), 1, null);
end; $$;
grant execute on function public.wa_set_conversation_status(uuid, uuid, text) to authenticated, service_role;

create or replace function public.wa_set_conversation_tags(p_org uuid, p_conversation uuid, p_tags text[])
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_permission(p_org, 'whatsapp.send') then raise exception 'forbidden'; end if;
  update public.conversations set tags = coalesce(p_tags, '{}'), updated_at = now()
    where id = p_conversation and organization_id = p_org and deleted_at is null;
  if not found then raise exception 'conversation not found'; end if;
end; $$;
grant execute on function public.wa_set_conversation_tags(uuid, uuid, text[]) to authenticated, service_role;

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.conversation_notes enable row level security;
drop policy if exists conversation_notes_select on public.conversation_notes;
create policy conversation_notes_select on public.conversation_notes for select to authenticated
  using (public.has_permission(organization_id, 'whatsapp.read'));
drop policy if exists conversation_notes_write on public.conversation_notes;
create policy conversation_notes_write on public.conversation_notes for all to authenticated
  using (public.has_permission(organization_id, 'whatsapp.send'))
  with check (public.has_permission(organization_id, 'whatsapp.send'));

alter table public.quick_replies enable row level security;
drop policy if exists quick_replies_select on public.quick_replies;
create policy quick_replies_select on public.quick_replies for select to authenticated
  using (deleted_at is null and public.has_permission(organization_id, 'whatsapp.read'));
drop policy if exists quick_replies_write on public.quick_replies;
create policy quick_replies_write on public.quick_replies for all to authenticated
  using (public.has_permission(organization_id, 'whatsapp.send'))
  with check (public.has_permission(organization_id, 'whatsapp.send'));

grant select, insert, update, delete on all tables in schema public to authenticated;

-- ── Triggers updated_at ──────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['conversation_notes','quick_replies'] loop
    execute format('drop trigger if exists trg_%s_updated_at on public.%I', t, t);
    execute format('create trigger trg_%s_updated_at before update on public.%I for each row execute function public.set_updated_at()', t, t);
  end loop;
end $$;
