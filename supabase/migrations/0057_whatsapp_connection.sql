-- 0057_whatsapp_connection.sql — Módulo F3.1 · Conexão WABA + suporte a webhook.
-- Idempotente. RPCs usadas pelas Edge Functions (whatsapp-connect / whatsapp-webhook).

-- ── Armazena a conexão (conta + número + credencial) atômico ────────────────
-- Chamado após Embedded Signup (ou conexão manual). Guard: service_role passa
-- (auth.uid() null); usuário precisa de whatsapp.connect. O token vai para
-- whatsapp_credentials (sem SELECT p/ cliente).
create or replace function public.wa_store_connection(
  p_org uuid, p_provider text, p_waba_id text, p_business_id text, p_name text,
  p_phone_number_id text, p_display text, p_verified_name text,
  p_access_token text, p_app_secret text default null, p_verify_token text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_account uuid; v_phone uuid; v_is_first boolean;
begin
  if auth.uid() is not null and not public.has_permission(p_org, 'whatsapp.connect') then
    raise exception 'forbidden';
  end if;

  -- Conta (upsert por org+waba_id)
  select id into v_account from public.whatsapp_accounts
    where organization_id = p_org and waba_id = p_waba_id and p_waba_id is not null limit 1;
  if v_account is null then
    insert into public.whatsapp_accounts(organization_id, provider, waba_id, business_id, name, status,
                                         webhook_verify_token, connected_at)
    values (p_org, coalesce(p_provider, 'meta'), p_waba_id, p_business_id, p_name, 'connected',
            p_verify_token, now())
    returning id into v_account;
  else
    update public.whatsapp_accounts set business_id = coalesce(p_business_id, business_id),
      name = coalesce(p_name, name), status = 'connected',
      webhook_verify_token = coalesce(p_verify_token, webhook_verify_token),
      connected_at = now(), updated_at = now()
    where id = v_account;
  end if;

  -- Credencial (segredo)
  insert into public.whatsapp_credentials(account_id, organization_id, access_token, app_secret, rotated_at)
  values (v_account, p_org, p_access_token, p_app_secret, now())
  on conflict (account_id) do update set access_token = excluded.access_token,
    app_secret = coalesce(excluded.app_secret, public.whatsapp_credentials.app_secret),
    rotated_at = now(), updated_at = now();

  -- Número (upsert por org+phone_number_id)
  select count(*) = 0 into v_is_first from public.whatsapp_phone_numbers where organization_id = p_org;
  select id into v_phone from public.whatsapp_phone_numbers
    where organization_id = p_org and phone_number_id = p_phone_number_id limit 1;
  if v_phone is null then
    insert into public.whatsapp_phone_numbers(organization_id, account_id, phone_number_id,
                                              display_phone_number, verified_name, status, is_default)
    values (p_org, v_account, p_phone_number_id, p_display, p_verified_name, 'active', v_is_first)
    returning id into v_phone;
  else
    update public.whatsapp_phone_numbers set account_id = v_account,
      display_phone_number = coalesce(p_display, display_phone_number),
      verified_name = coalesce(p_verified_name, verified_name), status = 'active', updated_at = now()
    where id = v_phone;
  end if;

  return jsonb_build_object('account_id', v_account, 'phone_id', v_phone);
end; $$;
grant execute on function public.wa_store_connection(uuid, text, text, text, text, text, text, text, text, text, text)
  to authenticated, service_role;

-- ── Resolve org + número interno a partir do phone_number_id da Meta ─────────
-- Usado pelo webhook (service_role) para rotear o evento ao tenant certo.
create or replace function public.wa_resolve_phone(p_phone_number_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
  select jsonb_build_object('organization_id', organization_id, 'phone_id', id, 'account_id', account_id)
    into v from public.whatsapp_phone_numbers where phone_number_id = p_phone_number_id limit 1;
  return v;
end; $$;
grant execute on function public.wa_resolve_phone(text) to service_role;

-- ── Log de envelope de webhook (auditoria + dedup best-effort) ──────────────
create or replace function public.wa_log_webhook(
  p_org uuid, p_provider text, p_event_type text, p_external_id text, p_payload jsonb
) returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.whatsapp_webhook_events(organization_id, provider, event_type, external_id,
                                             payload, status, processed_at)
  values (p_org, coalesce(p_provider, 'meta'), p_event_type, p_external_id,
          coalesce(p_payload, '{}'::jsonb), 'processed', now())
  on conflict (provider, external_id) where external_id is not null do nothing;
end; $$;
grant execute on function public.wa_log_webhook(uuid, text, text, text, jsonb) to service_role;
