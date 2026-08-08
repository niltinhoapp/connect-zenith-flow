-- 0068_whatsapp_conversation_insights.sql — análise estruturada por conversa.

create table if not exists public.conversation_insights (
  id                      uuid primary key default gen_random_uuid(),
  organization_id         uuid not null references public.organizations(id) on delete cascade,
  conversation_id         uuid not null references public.conversations(id) on delete cascade,
  intent                  text not null check (intent in ('sale','support','billing','post_sale','other')),
  temperature             text not null check (temperature in ('hot','warm','cold')),
  urgency                 text not null check (urgency in ('high','medium','low')),
  sentiment               text not null check (sentiment in ('positive','neutral','negative')),
  summary                 text not null,
  next_best_action        text not null,
  suggested_reply         text,
  reasons                 text[] not null default '{}',
  source_last_message_at  timestamptz,
  model                   text,
  tokens_in               int not null default 0,
  tokens_out              int not null default 0,
  generated_at            timestamptz not null default now(),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique (organization_id, conversation_id)
);
create index if not exists idx_conversation_insights_org on public.conversation_insights(organization_id, generated_at desc);

drop trigger if exists trg_conversation_insights_updated_at on public.conversation_insights;
create trigger trg_conversation_insights_updated_at before update on public.conversation_insights
  for each row execute function public.set_updated_at();

alter table public.conversation_insights enable row level security;
drop policy if exists conversation_insights_select on public.conversation_insights;
create policy conversation_insights_select on public.conversation_insights for select to authenticated
  using (public.has_permission(organization_id, 'whatsapp.read'));
-- Escrita somente pela RPC para impedir insights forjados pelo cliente.

create or replace function public.wa_upsert_conversation_insight(
  p_conversation uuid,
  p_intent text,
  p_temperature text,
  p_urgency text,
  p_sentiment text,
  p_summary text,
  p_next_best_action text,
  p_suggested_reply text,
  p_reasons text[],
  p_source_last_message_at timestamptz,
  p_model text,
  p_tokens_in int,
  p_tokens_out int
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_org uuid; v_id uuid;
begin
  select organization_id into v_org from public.conversations
    where id = p_conversation and deleted_at is null;
  if v_org is null then raise exception 'conversation not found'; end if;
  if auth.uid() is null
     or not public.has_permission(v_org, 'whatsapp.read')
     or not public.has_permission(v_org, 'ia.use') then raise exception 'forbidden'; end if;
  if p_intent not in ('sale','support','billing','post_sale','other')
     or p_temperature not in ('hot','warm','cold')
     or p_urgency not in ('high','medium','low')
     or p_sentiment not in ('positive','neutral','negative') then raise exception 'invalid insight'; end if;

  insert into public.conversation_insights(
    organization_id, conversation_id, intent, temperature, urgency, sentiment,
    summary, next_best_action, suggested_reply, reasons, source_last_message_at,
    model, tokens_in, tokens_out, generated_at
  ) values (
    v_org, p_conversation, p_intent, p_temperature, p_urgency, p_sentiment,
    left(trim(p_summary), 1000), left(trim(p_next_best_action), 500),
    nullif(left(trim(coalesce(p_suggested_reply, '')), 1000), ''),
    (coalesce(p_reasons, '{}'))[1:5], p_source_last_message_at,
    left(p_model, 100), greatest(p_tokens_in, 0), greatest(p_tokens_out, 0), now()
  ) on conflict (organization_id, conversation_id) do update set
    intent = excluded.intent, temperature = excluded.temperature, urgency = excluded.urgency,
    sentiment = excluded.sentiment, summary = excluded.summary,
    next_best_action = excluded.next_best_action, suggested_reply = excluded.suggested_reply,
    reasons = excluded.reasons, source_last_message_at = excluded.source_last_message_at,
    model = excluded.model, tokens_in = excluded.tokens_in, tokens_out = excluded.tokens_out,
    generated_at = now(), updated_at = now()
  returning id into v_id;
  return v_id;
end; $$;

revoke all on function public.wa_upsert_conversation_insight(uuid,text,text,text,text,text,text,text,text[],timestamptz,text,int,int) from public;
grant execute on function public.wa_upsert_conversation_insight(uuid,text,text,text,text,text,text,text,text[],timestamptz,text,int,int) to authenticated;
grant select on public.conversation_insights to authenticated;
grant all on public.conversation_insights to service_role;
