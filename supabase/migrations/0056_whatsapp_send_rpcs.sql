-- 0056_whatsapp_send_rpcs.sql — Módulo F3.1 · Conclusão do envio (worker). Idempotente.
-- O worker (service_role) resolve o contexto de envio (inclui o token, que só
-- service_role acessa), chama o Provider e registra o desfecho.

-- ── Contexto de envio (service_role) ─────────────────────────────────────────
-- Junta mensagem + conversa + número + credencial (+ template) num envelope
-- neutro para o worker. O access_token só sai por aqui (SECURITY DEFINER).
create or replace function public.wa_send_context(p_message_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
  select jsonb_build_object(
    'organization_id', m.organization_id,
    'message_id',      m.id,
    'status',          m.status,
    'type',            m.type,
    'body',            m.body,
    'to',              c.contact_wa_id,
    'provider',        a.provider,
    'phone_number_id', pn.phone_number_id,
    'access_token',    cr.access_token,
    'template',        case when t.id is not null then jsonb_build_object(
                          'name', t.name, 'language', t.language, 'components', t.components) end
  ) into v
  from public.messages m
  join public.conversations c   on c.id = m.conversation_id
  left join public.whatsapp_phone_numbers pn on pn.id = c.phone_number_id
  left join public.whatsapp_accounts a       on a.id = c.account_id
  left join public.whatsapp_credentials cr    on cr.account_id = a.id
  left join public.whatsapp_templates t       on t.id = m.template_id
  where m.id = p_message_id;
  return v;
end; $$;
grant execute on function public.wa_send_context(uuid) to service_role;

-- ── Marcar enviada (service_role) ────────────────────────────────────────────
create or replace function public.wa_mark_sent(p_org uuid, p_message_id uuid, p_wa_message_id text)
returns void language plpgsql security definer set search_path = public as $$
declare v_conv uuid;
begin
  update public.messages
     set wa_message_id = p_wa_message_id, status = 'sent', updated_at = now()
   where id = p_message_id and organization_id = p_org and status = 'pending'
   returning conversation_id into v_conv;
  if v_conv is null then return; end if;  -- já processada (idempotente)

  insert into public.message_status_events(organization_id, message_id, status)
  values (p_org, p_message_id, 'sent') on conflict (message_id, status) do nothing;

  perform public.publish_event(p_org, 'whatsapp.message.sent',
    jsonb_build_object('conversationId', v_conv, 'messageId', p_message_id), 1, null);
end; $$;
grant execute on function public.wa_mark_sent(uuid, uuid, text) to service_role;

-- ── Marcar falha (service_role) ──────────────────────────────────────────────
create or replace function public.wa_mark_failed(p_org uuid, p_message_id uuid, p_error jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare v_conv uuid;
begin
  update public.messages
     set status = 'failed', error = coalesce(p_error, '{}'::jsonb), updated_at = now()
   where id = p_message_id and organization_id = p_org
   returning conversation_id into v_conv;
  if v_conv is null then return; end if;

  perform public.publish_event(p_org, 'whatsapp.message.failed',
    jsonb_build_object('conversationId', v_conv, 'messageId', p_message_id), 1, null);
end; $$;
grant execute on function public.wa_mark_failed(uuid, uuid, jsonb) to service_role;
