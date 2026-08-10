-- 0070_whatsapp_awaiting_reply.sql
-- Sinal confiável de conversa aguardando resposta: o último inbound é mais
-- recente que o último outbound. Não depende de unread_count (que zera ao abrir).

alter table public.conversations
  add column if not exists last_outbound_at timestamptz;

update public.conversations c
   set last_outbound_at = x.last_outbound_at
  from (
    select conversation_id, max(created_at) as last_outbound_at
      from public.messages
     where direction = 'outbound'
       and status in ('sent', 'delivered', 'read')
     group by conversation_id
  ) x
 where c.id = x.conversation_id
   and c.last_outbound_at is distinct from x.last_outbound_at;

create or replace function public.sync_conversation_last_outbound()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Uma tentativa pendente ou recusada pela Meta não conta como resposta.
  if new.direction = 'outbound' and new.status in ('sent', 'delivered', 'read') then
    update public.conversations
       set last_outbound_at = greatest(coalesce(last_outbound_at, '-infinity'::timestamptz), new.created_at),
           updated_at = now()
     where id = new.conversation_id
       and organization_id = new.organization_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_messages_last_outbound on public.messages;
create trigger trg_messages_last_outbound
after insert or update of status on public.messages
for each row execute function public.sync_conversation_last_outbound();

create index if not exists idx_conversations_awaiting_reply
  on public.conversations(organization_id, last_inbound_at desc)
  where deleted_at is null and last_inbound_at is not null;
