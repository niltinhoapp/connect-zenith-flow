-- 0067_fix_api_key_pgcrypto_schema.sql — qualifica pgcrypto no Supabase hospedado.
-- O projeto instala pgcrypto no schema `extensions`; funções SECURITY DEFINER
-- usam search_path restrito e devem qualificar digest/gen_random_bytes.

create or replace function public.api_key_create(
  p_org uuid, p_name text, p_scopes text[], p_expires_at timestamptz default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_secret text; v_prefix text; v_scopes text[];
begin
  if auth.uid() is null or not public.has_permission(p_org, 'api.keys.manage') then
    raise exception 'forbidden';
  end if;
  if char_length(trim(p_name)) < 2 or char_length(trim(p_name)) > 100 then
    raise exception 'invalid name';
  end if;
  if p_expires_at is not null and p_expires_at <= now() then raise exception 'invalid expiry'; end if;
  select coalesce(array_agg(s.key order by s.key), '{}') into v_scopes
  from public.api_scopes s where s.key = any(coalesce(p_scopes, '{}'));
  if cardinality(v_scopes) <> cardinality(coalesce(p_scopes, '{}')) then raise exception 'invalid scope'; end if;
  if cardinality(v_scopes) = 0 then raise exception 'at least one scope required'; end if;

  v_secret := 'cw_live_' || encode(extensions.gen_random_bytes(32), 'hex');
  v_prefix := left(v_secret, 16);
  insert into public.api_keys(organization_id, name, key_prefix, key_hash, scopes, expires_at, created_by)
  values (p_org, trim(p_name), v_prefix, extensions.digest(v_secret, 'sha256'), v_scopes, p_expires_at, auth.uid())
  returning id into v_id;
  perform public.write_audit(p_org, 'api.key.created', 'api_key', v_id,
    jsonb_build_object('name', trim(p_name), 'prefix', v_prefix, 'scopes', v_scopes, 'expires_at', p_expires_at));
  return jsonb_build_object('id', v_id, 'secret', v_secret, 'prefix', v_prefix);
end; $$;

create or replace function public.verify_api_key(
  p_key text, p_method text default null, p_path text default null, p_request_id text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v public.api_keys; v_allowed boolean;
begin
  select * into v from public.api_keys
    where key_hash = extensions.digest(coalesce(p_key, ''), 'sha256') and revoked_at is null
      and (expires_at is null or expires_at > now()) limit 1;
  if v.id is null then return jsonb_build_object('valid', false, 'reason', 'invalid'); end if;
  v_allowed := public.try_consume_quota(v.organization_id, 'api_calls', 1);
  if not v_allowed then
    insert into public.api_request_logs(organization_id, api_key_id, method, path, response_status, request_id)
    values (v.organization_id, v.id, p_method, p_path, 429, p_request_id);
    return jsonb_build_object('valid', false, 'reason', 'quota');
  end if;
  update public.api_keys set last_used_at = now() where id = v.id;
  insert into public.api_request_logs(organization_id, api_key_id, method, path, request_id)
  values (v.organization_id, v.id, p_method, p_path, p_request_id);
  return jsonb_build_object('valid', true, 'organization_id', v.organization_id,
    'api_key_id', v.id, 'scopes', v.scopes);
end; $$;

revoke all on function public.api_key_create(uuid, text, text[], timestamptz) from public;
revoke all on function public.verify_api_key(text, text, text, text) from public;
grant execute on function public.api_key_create(uuid, text, text[], timestamptz) to authenticated;
grant execute on function public.verify_api_key(text, text, text, text) to service_role;
