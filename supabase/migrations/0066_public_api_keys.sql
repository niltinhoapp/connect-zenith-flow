-- 0066_public_api_keys.sql — API Pública · chaves, escopos e logs de requisição.
-- O segredo é retornado uma única vez por api_key_create(). Somente SHA-256 é persistido.

create table if not exists public.api_scopes (
  key          text primary key,
  description  text not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

insert into public.api_scopes(key, description) values
  ('customers:read',  'Consultar clientes'),
  ('customers:write', 'Criar e atualizar clientes'),
  ('deals:read',      'Consultar oportunidades do CRM'),
  ('deals:write',     'Criar e atualizar oportunidades'),
  ('messages:read',   'Consultar conversas e mensagens'),
  ('messages:send',   'Enviar mensagens'),
  ('reports:read',    'Consultar indicadores e relatórios')
on conflict (key) do update set description = excluded.description, updated_at = now();

create table if not exists public.api_keys (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  name             text not null check (char_length(name) between 2 and 100),
  key_prefix       text not null,
  key_hash         bytea not null unique,
  scopes           text[] not null default '{}',
  expires_at       timestamptz,
  last_used_at     timestamptz,
  created_by       uuid references auth.users(id) on delete set null,
  revoked_at       timestamptz,
  revoked_by       uuid references auth.users(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint api_keys_expiry_future check (expires_at is null or expires_at > created_at)
);
create index if not exists idx_api_keys_org on public.api_keys(organization_id, created_at desc);
create index if not exists idx_api_keys_active on public.api_keys(organization_id) where revoked_at is null;

drop trigger if exists trg_api_keys_updated_at on public.api_keys;
create trigger trg_api_keys_updated_at before update on public.api_keys
  for each row execute function public.set_updated_at();

create table if not exists public.api_request_logs (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  api_key_id       uuid references public.api_keys(id) on delete set null,
  method           text,
  path             text,
  response_status  int,
  duration_ms      int,
  request_id       text,
  ip_hash          text,
  created_at       timestamptz not null default now()
);
create index if not exists idx_api_request_logs_org on public.api_request_logs(organization_id, created_at desc);
create index if not exists idx_api_request_logs_key on public.api_request_logs(api_key_id, created_at desc);

insert into public.permissions(key, module, description) values
  ('api.keys.manage', 'api_publica', 'Criar e revogar chaves da API Pública')
on conflict (key) do update set module = excluded.module, description = excluded.description;

insert into public.role_permissions(role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.organization_id is null and r.key in ('owner','admin') and p.key = 'api.keys.manage'
on conflict do nothing;

alter table public.api_scopes enable row level security;
alter table public.api_keys enable row level security;
alter table public.api_request_logs enable row level security;

drop policy if exists api_scopes_select on public.api_scopes;
create policy api_scopes_select on public.api_scopes for select to authenticated using (true);

drop policy if exists api_keys_select on public.api_keys;
create policy api_keys_select on public.api_keys for select to authenticated
  using (public.has_permission(organization_id, 'api.keys.manage'));

drop policy if exists api_request_logs_select on public.api_request_logs;
create policy api_request_logs_select on public.api_request_logs for select to authenticated
  using (public.has_permission(organization_id, 'api.keys.manage'));
-- Sem policies de escrita: mutações somente pelas RPCs abaixo.

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

  v_secret := 'cw_live_' || encode(gen_random_bytes(32), 'hex');
  v_prefix := left(v_secret, 16);
  insert into public.api_keys(organization_id, name, key_prefix, key_hash, scopes, expires_at, created_by)
  values (p_org, trim(p_name), v_prefix, digest(v_secret, 'sha256'), v_scopes, p_expires_at, auth.uid())
  returning id into v_id;
  perform public.write_audit(p_org, 'api.key.created', 'api_key', v_id,
    jsonb_build_object('name', trim(p_name), 'prefix', v_prefix, 'scopes', v_scopes, 'expires_at', p_expires_at));
  return jsonb_build_object('id', v_id, 'secret', v_secret, 'prefix', v_prefix);
end; $$;

create or replace function public.api_key_revoke(p_org uuid, p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_name text; v_prefix text;
begin
  if auth.uid() is null or not public.has_permission(p_org, 'api.keys.manage') then raise exception 'forbidden'; end if;
  update public.api_keys set revoked_at = now(), revoked_by = auth.uid()
    where id = p_id and organization_id = p_org and revoked_at is null
    returning name, key_prefix into v_name, v_prefix;
  if not found then raise exception 'api key not found'; end if;
  perform public.write_audit(p_org, 'api.key.revoked', 'api_key', p_id,
    jsonb_build_object('name', v_name, 'prefix', v_prefix));
end; $$;

-- Gateway server-side: valida segredo, expiração e cota de modo atômico.
-- Nunca concedido a authenticated/anon: somente service_role pode autenticar uma API pública.
create or replace function public.verify_api_key(
  p_key text, p_method text default null, p_path text default null, p_request_id text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v public.api_keys; v_allowed boolean;
begin
  select * into v from public.api_keys
    where key_hash = digest(coalesce(p_key, ''), 'sha256') and revoked_at is null
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
revoke all on function public.api_key_revoke(uuid, uuid) from public;
revoke all on function public.verify_api_key(text, text, text, text) from public;
grant execute on function public.api_key_create(uuid, text, text[], timestamptz) to authenticated;
grant execute on function public.api_key_revoke(uuid, uuid) to authenticated;
grant execute on function public.verify_api_key(text, text, text, text) to service_role;
grant select on public.api_scopes, public.api_keys, public.api_request_logs to authenticated;
grant all on public.api_scopes, public.api_keys, public.api_request_logs to service_role;
