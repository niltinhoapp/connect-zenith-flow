-- 0063_automation_action_guards.sql — corrige guard das RPCs de WhatsApp/conversa
-- para exemptar o service_role (worker/automações), alinhando à convenção do
-- projeto (publish_event/enqueue_job/automation_guard usam este mesmo padrão).
-- Única mudança por função: `if not has_permission(...)` →
--                           `if auth.uid() is not null and not has_permission(...)`.
-- Usuários autenticados continuam exigindo a permissão; muda só o sistema.
-- Idempotente (create or replace).

-- ── wa_send_message ─────────────────────────────────────────────────────────
create or replace function public.wa_send_message(
  p_org uuid, p_conversation uuid, p_type text default 'text',
  p_body text default null, p_template_id uuid default null, p_payload jsonb default '{}'::jsonb
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_conv public.conversations; v_msg uuid;
begin
  if auth.uid() is not null and not public.has_permission(p_org, 'whatsapp.send') then raise exception 'forbidden'; end if;

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

-- ── assign_conversation ─────────────────────────────────────────────────────
create or replace function public.assign_conversation(p_org uuid, p_conversation uuid, p_assignee uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.has_permission(p_org, 'whatsapp.assign') then raise exception 'forbidden'; end if;
  update public.conversations set assigned_to = p_assignee, updated_at = now()
    where id = p_conversation and organization_id = p_org and deleted_at is null;
  if not found then raise exception 'conversation not found'; end if;
  perform public.publish_event(p_org, 'whatsapp.conversation.assigned',
    jsonb_build_object('conversationId', p_conversation, 'assignedTo', p_assignee), 1, null);
end; $$;
grant execute on function public.assign_conversation(uuid, uuid, uuid) to authenticated, service_role;

-- ── wa_set_conversation_status ──────────────────────────────────────────────
create or replace function public.wa_set_conversation_status(p_org uuid, p_conversation uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.has_permission(p_org, 'whatsapp.send') then raise exception 'forbidden'; end if;
  if p_status not in ('open','pending','closed') then raise exception 'invalid status: %', p_status; end if;
  update public.conversations set status = p_status, updated_at = now()
    where id = p_conversation and organization_id = p_org and deleted_at is null;
  if not found then raise exception 'conversation not found'; end if;
  perform public.publish_event(p_org,
    case p_status when 'closed' then 'whatsapp.conversation.closed' else 'whatsapp.conversation.opened' end,
    jsonb_build_object('conversationId', p_conversation), 1, null);
end; $$;
grant execute on function public.wa_set_conversation_status(uuid, uuid, text) to authenticated, service_role;

-- ── wa_set_conversation_tags ────────────────────────────────────────────────
create or replace function public.wa_set_conversation_tags(p_org uuid, p_conversation uuid, p_tags text[])
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.has_permission(p_org, 'whatsapp.send') then raise exception 'forbidden'; end if;
  update public.conversations set tags = coalesce(p_tags, '{}'), updated_at = now()
    where id = p_conversation and organization_id = p_org and deleted_at is null;
  if not found then raise exception 'conversation not found'; end if;
end; $$;
grant execute on function public.wa_set_conversation_tags(uuid, uuid, text[]) to authenticated, service_role;
