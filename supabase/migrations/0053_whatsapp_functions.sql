-- 0053_whatsapp_functions.sql — Módulo F3.1 · RPCs do WhatsApp. Idempotente.
-- SECURITY DEFINER + guard (has_permission p/ usuário, is_org_member/service_role
-- p/ worker/webhook). Envio consome cota atômica e enfileira job idempotente.

-- ── Envio (usuário) ──────────────────────────────────────────────────────────
-- Cria a mensagem (pending) e enfileira 'whatsapp.send'. Cota atômica ANTES.
create or replace function public.wa_send_message(
  p_org uuid, p_conversation uuid, p_type text default 'text',
  p_body text default null, p_template_id uuid default null, p_payload jsonb default '{}'::jsonb
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_conv public.conversations; v_msg uuid;
begin
  if not public.has_permission(p_org, 'whatsapp.send') then raise exception 'forbidden'; end if;

  select * into v_conv from public.conversations
    where id = p_conversation and organization_id = p_org and deleted_at is null;
  if v_conv.id is null then raise exception 'conversation not found'; end if;

  if not public.try_consume_quota(p_org, 'messages', 1) then
    raise exception 'quota exceeded: messages';
  end if;

  insert into public.messages(organization_id, conversation_id, direction, type, body,
                              template_id, status, sent_by, payload)
  values (p_org, p_conversation, 'outbound', p_type, p_body, p_template_id, 'pending', auth.uid(),
          coalesce(p_payload, '{}'::jsonb))
  returning id into v_msg;

  update public.conversations
     set last_message_at = now(),
         last_message_preview = left(coalesce(p_body, '[' || p_type || ']'), 140),
         updated_at = now()
   where id = p_conversation;

  perform public.enqueue_job(p_org, 'whatsapp.send',
    jsonb_build_object('message_id', v_msg), now(), 5, 5, null, v_msg::text,
    'whatsapp.send:' || v_msg::text, 1);

  return v_msg;
end; $$;
grant execute on function public.wa_send_message(uuid, uuid, text, text, uuid, jsonb) to authenticated, service_role;

-- ── Aplicar status (worker/webhook · service_role) ──────────────────────────
-- Registra o evento de status e avança o status da mensagem (monotônico; failed
-- sempre vence). Publica whatsapp.message.<status> no outbox.
create or replace function public.wa_apply_status(
  p_org uuid, p_wa_message_id text, p_status text,
  p_occurred_at timestamptz default now(), p_raw jsonb default '{}'::jsonb
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_msg public.messages; v_cur int; v_new int;
begin
  if auth.uid() is not null and not public.is_org_member(p_org) then raise exception 'forbidden'; end if;

  select * into v_msg from public.messages
    where organization_id = p_org and wa_message_id = p_wa_message_id;
  if v_msg.id is null then return null; end if;  -- status de mensagem desconhecida: ignora

  insert into public.message_status_events(organization_id, message_id, status, occurred_at, raw)
  values (p_org, v_msg.id, p_status, coalesce(p_occurred_at, now()), coalesce(p_raw, '{}'::jsonb))
  on conflict (message_id, status) do nothing;

  v_cur := case v_msg.status when 'sent' then 1 when 'delivered' then 2 when 'read' then 3 else 0 end;
  v_new := case p_status when 'sent' then 1 when 'delivered' then 2 when 'read' then 3 else 0 end;

  if p_status = 'failed' then
    update public.messages set status = 'failed', error = coalesce(p_raw, '{}'::jsonb), updated_at = now()
      where id = v_msg.id;
  elsif v_new > v_cur then
    update public.messages set status = p_status, updated_at = now() where id = v_msg.id;
  end if;

  perform public.publish_event(p_org, 'whatsapp.message.' || p_status,
    jsonb_build_object('conversationId', v_msg.conversation_id, 'messageId', v_msg.id), 1, null);

  return v_msg.id;
end; $$;
grant execute on function public.wa_apply_status(uuid, text, text, timestamptz, jsonb) to service_role;

-- ── Ingestão de mensagem recebida (webhook · service_role) ───────────────────
-- Faz upsert da conversa (janela de 24h) e insere a mensagem inbound (idempotente
-- por wa_message_id). Publica whatsapp.message.received.
create or replace function public.wa_ingest_inbound(
  p_org uuid, p_phone_number_id uuid, p_contact_wa_id text, p_contact_name text,
  p_wa_message_id text, p_type text default 'text', p_body text default null,
  p_payload jsonb default '{}'::jsonb
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_conv uuid; v_account uuid; v_msg uuid;
begin
  if auth.uid() is not null and not public.is_org_member(p_org) then raise exception 'forbidden'; end if;

  select account_id into v_account from public.whatsapp_phone_numbers where id = p_phone_number_id;

  insert into public.conversations(organization_id, account_id, phone_number_id, contact_wa_id,
                                   contact_name, status, unread_count, last_message_at,
                                   last_message_preview, last_inbound_at, window_expires_at)
  values (p_org, v_account, p_phone_number_id, p_contact_wa_id, p_contact_name, 'open', 1, now(),
          left(coalesce(p_body, '[' || p_type || ']'), 140), now(), now() + interval '24 hours')
  on conflict (organization_id, phone_number_id, contact_wa_id) do update set
    contact_name = coalesce(excluded.contact_name, public.conversations.contact_name),
    status = case when public.conversations.status = 'closed' then 'open' else public.conversations.status end,
    unread_count = public.conversations.unread_count + 1,
    last_message_at = now(),
    last_message_preview = excluded.last_message_preview,
    last_inbound_at = now(),
    window_expires_at = now() + interval '24 hours',
    updated_at = now()
  returning id into v_conv;

  insert into public.messages(organization_id, conversation_id, direction, wa_message_id, type,
                              body, status, sender, payload)
  values (p_org, v_conv, 'inbound', p_wa_message_id, p_type, p_body, 'received', p_contact_wa_id,
          coalesce(p_payload, '{}'::jsonb))
  on conflict (organization_id, wa_message_id) where wa_message_id is not null do nothing
  returning id into v_msg;

  if v_msg is null then  -- duplicata (idempotência): retorna a existente, não republica
    select id into v_msg from public.messages
      where organization_id = p_org and wa_message_id = p_wa_message_id;
    return v_msg;
  end if;

  perform public.publish_event(p_org, 'whatsapp.message.received',
    jsonb_build_object('conversationId', v_conv, 'messageId', v_msg), 1, null);

  return v_msg;
end; $$;
grant execute on function public.wa_ingest_inbound(uuid, uuid, text, text, text, text, text, jsonb) to service_role;

-- ── Atribuir conversa (usuário) ──────────────────────────────────────────────
create or replace function public.assign_conversation(p_org uuid, p_conversation uuid, p_assignee uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_permission(p_org, 'whatsapp.assign') then raise exception 'forbidden'; end if;
  update public.conversations set assigned_to = p_assignee, updated_at = now()
    where id = p_conversation and organization_id = p_org and deleted_at is null;
  if not found then raise exception 'conversation not found'; end if;
  perform public.publish_event(p_org, 'whatsapp.conversation.assigned',
    jsonb_build_object('conversationId', p_conversation, 'assignedTo', p_assignee), 1, null);
end; $$;
grant execute on function public.assign_conversation(uuid, uuid, uuid) to authenticated, service_role;

-- ── Marcar conversa como lida (usuário) ──────────────────────────────────────
create or replace function public.mark_conversation_read(p_org uuid, p_conversation uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_permission(p_org, 'whatsapp.read') then raise exception 'forbidden'; end if;
  update public.conversations set unread_count = 0, updated_at = now()
    where id = p_conversation and organization_id = p_org and deleted_at is null;
end; $$;
grant execute on function public.mark_conversation_read(uuid, uuid) to authenticated, service_role;

-- ── Contadores da inbox (usuário) ────────────────────────────────────────────
create or replace function public.inbox_counters(p_org uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_open int; v_unread int; v_mine int;
begin
  if not public.has_permission(p_org, 'whatsapp.read') then raise exception 'forbidden'; end if;
  select count(*) filter (where status = 'open'),
         coalesce(sum(unread_count), 0),
         count(*) filter (where assigned_to = auth.uid() and status <> 'closed')
    into v_open, v_unread, v_mine
    from public.conversations where organization_id = p_org and deleted_at is null;
  return jsonb_build_object('open', v_open, 'unread', v_unread, 'mine', v_mine);
end; $$;
grant execute on function public.inbox_counters(uuid) to authenticated, service_role;
