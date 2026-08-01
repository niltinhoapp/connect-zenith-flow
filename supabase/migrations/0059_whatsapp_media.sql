-- 0059_whatsapp_media.sql — F3.1.4 · Mídia real (Storage + envio/recebimento). Idempotente.
-- Não altera OAuth/Embedded Signup/webhooks/IDs. Reusa jobs/quota/idempotência.
-- Fluxo outbound: cliente sobe arquivo p/ Storage (RLS por org) → wa_send_media
-- cria mensagem+mídia e enfileira whatsapp.send → worker baixa do Storage, faz
-- upload p/ Meta (/media), envia com media_id e marca sent. Token só no worker.

-- ── Bucket privado de mídia ──────────────────────────────────────────────────
insert into storage.buckets (id, name, public) values ('whatsapp-media', 'whatsapp-media', false)
on conflict (id) do nothing;

-- RLS no storage.objects: caminho = {organization_id}/{conversation_id}/{arquivo}.
-- Leitura: membro da org. Escrita: quem tem whatsapp.send na org. (service_role bypassa.)
drop policy if exists wa_media_select on storage.objects;
create policy wa_media_select on storage.objects for select to authenticated
  using (bucket_id = 'whatsapp-media'
         and public.is_org_member(nullif((storage.foldername(name))[1], '')::uuid));

drop policy if exists wa_media_insert on storage.objects;
create policy wa_media_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'whatsapp-media'
              and public.has_permission(nullif((storage.foldername(name))[1], '')::uuid, 'whatsapp.send'));

-- ── Envio de mídia (usuário) ─────────────────────────────────────────────────
-- Cria whatsapp_media (outbound, já no Storage) + messages(type media, pending)
-- e enfileira whatsapp.send. Cota atômica ANTES.
create or replace function public.wa_send_media(
  p_org uuid, p_conversation uuid, p_type text, p_storage_path text, p_mime text,
  p_size bigint, p_filename text default null, p_caption text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_conv public.conversations; v_media uuid; v_msg uuid;
begin
  if not public.has_permission(p_org, 'whatsapp.send') then raise exception 'forbidden'; end if;
  if p_type not in ('image','audio','document') then raise exception 'invalid media type: %', p_type; end if;

  select * into v_conv from public.conversations
    where id = p_conversation and organization_id = p_org and deleted_at is null;
  if v_conv.id is null then raise exception 'conversation not found'; end if;

  if not public.try_consume_quota(p_org, 'messages', 1) then raise exception 'quota exceeded: messages'; end if;

  insert into public.whatsapp_media(organization_id, direction, mime_type, filename, size_bytes, storage_path, status)
  values (p_org, 'outbound', p_mime, p_filename, p_size, p_storage_path, 'stored')
  returning id into v_media;

  insert into public.messages(organization_id, conversation_id, direction, type, body, media_id, status, sent_by, payload)
  values (p_org, p_conversation, 'outbound', p_type, nullif(p_caption, ''), v_media, 'pending', auth.uid(),
          jsonb_build_object('media', true))
  returning id into v_msg;

  update public.conversations
     set last_message_at = now(), last_message_preview = '[' || p_type || ']', updated_at = now()
   where id = p_conversation;

  perform public.enqueue_job(p_org, 'whatsapp.send', jsonb_build_object('message_id', v_msg),
    now(), 5, 5, null, v_msg::text, 'whatsapp.send:' || v_msg::text, 1);
  return v_msg;
end; $$;
grant execute on function public.wa_send_media(uuid, uuid, text, text, text, bigint, text, text) to authenticated, service_role;

-- ── Contexto de envio (service_role) — agora inclui mídia ───────────────────
-- Reescreve wa_send_context somando os campos de mídia (null p/ texto/template).
-- Campos existentes inalterados → caminho de texto/template não muda.
create or replace function public.wa_send_context(p_message_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
  select jsonb_build_object(
    'organization_id', m.organization_id, 'message_id', m.id, 'status', m.status,
    'type', m.type, 'body', m.body, 'to', c.contact_wa_id, 'provider', a.provider,
    'phone_number_id', pn.phone_number_id, 'access_token', cr.access_token,
    'template', case when t.id is not null then jsonb_build_object(
                  'name', t.name, 'language', t.language, 'components', t.components) end,
    'media', case when md.id is not null then jsonb_build_object(
                  'storage_path', md.storage_path, 'mime', md.mime_type, 'filename', md.filename) end
  ) into v
  from public.messages m
  join public.conversations c   on c.id = m.conversation_id
  left join public.whatsapp_phone_numbers pn on pn.id = c.phone_number_id
  left join public.whatsapp_accounts a       on a.id = c.account_id
  left join public.whatsapp_credentials cr    on cr.account_id = a.id
  left join public.whatsapp_templates t       on t.id = m.template_id
  left join public.whatsapp_media md          on md.id = m.media_id
  where m.id = p_message_id;
  return v;
end; $$;
grant execute on function public.wa_send_context(uuid) to service_role;

-- ── Recebimento: registra mídia inbound + enfileira download (service_role) ──
create or replace function public.wa_register_inbound_media(
  p_org uuid, p_message_id uuid, p_external_media_id text, p_mime text, p_filename text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_media uuid;
begin
  if auth.uid() is not null and not public.is_org_member(p_org) then raise exception 'forbidden'; end if;
  -- Idempotência por external_media_id (reentregas do webhook não duplicam).
  select id into v_media from public.whatsapp_media
    where organization_id = p_org and external_media_id = p_external_media_id and direction = 'inbound'
    limit 1;
  if v_media is not null then return v_media; end if;

  insert into public.whatsapp_media(organization_id, direction, external_media_id, mime_type, filename, status)
  values (p_org, 'inbound', p_external_media_id, p_mime, p_filename, 'pending')
  returning id into v_media;
  update public.messages set media_id = v_media where id = p_message_id and organization_id = p_org;
  perform public.enqueue_job(p_org, 'whatsapp.media.download',
    jsonb_build_object('media_id', v_media, 'external_media_id', p_external_media_id), now(), 5, 5, null, null,
    'whatsapp.media.download:' || v_media::text, 1);
  return v_media;
end; $$;
grant execute on function public.wa_register_inbound_media(uuid, uuid, text, text, text) to service_role;

-- ── Marca mídia armazenada (worker após download) ────────────────────────────
create or replace function public.wa_media_stored(
  p_media_id uuid, p_storage_path text, p_sha256 text default null, p_size bigint default null
) returns void language plpgsql security definer set search_path = public as $$
begin
  update public.whatsapp_media
     set storage_path = p_storage_path, sha256 = coalesce(p_sha256, sha256),
         size_bytes = coalesce(p_size, size_bytes), status = 'stored', updated_at = now()
   where id = p_media_id;
end; $$;
grant execute on function public.wa_media_stored(uuid, text, text, bigint) to service_role;

-- ── Contexto de download de mídia inbound (service_role) ────────────────────
-- Resolve a credencial da conta da org para o worker baixar a mídia da Meta.
create or replace function public.wa_media_download_context(p_media_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
  select jsonb_build_object(
    'media_id', md.id, 'organization_id', md.organization_id, 'status', md.status,
    'external_media_id', md.external_media_id, 'mime', md.mime_type,
    'phone_number_id', pn.phone_number_id, 'access_token', cr.access_token
  ) into v
  from public.whatsapp_media md
  left join public.whatsapp_accounts a on a.organization_id = md.organization_id and a.status = 'connected'
  left join public.whatsapp_credentials cr on cr.account_id = a.id
  left join public.whatsapp_phone_numbers pn on pn.account_id = a.id and pn.is_default
  where md.id = p_media_id
  limit 1;
  return v;
end; $$;
grant execute on function public.wa_media_download_context(uuid) to service_role;
