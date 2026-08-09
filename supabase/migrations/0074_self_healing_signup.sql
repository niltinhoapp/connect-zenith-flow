-- 0074_self_healing_signup.sql
-- Repara cadastros em que o Auth foi criado, mas perfil/workspace não foram
-- concluídos. Idempotente e serializado por usuário.

create or replace function public.ensure_user_workspace(p_company_name text default null)
returns public.organizations
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_auth auth.users;
  v_org public.organizations;
  v_name text;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text, 0));

  select * into v_auth from auth.users where id = v_uid;
  if v_auth.id is null then raise exception 'auth user not found'; end if;

  insert into public.profiles(id, full_name, email, avatar_url)
  values (
    v_uid,
    coalesce(v_auth.raw_user_meta_data->>'full_name', ''),
    coalesce(v_auth.email, ''),
    v_auth.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do update set
    full_name = case
      when nullif(trim(public.profiles.full_name), '') is null
        then excluded.full_name else public.profiles.full_name end,
    email = case
      when nullif(trim(public.profiles.email), '') is null
        then excluded.email else public.profiles.email end,
    updated_at = now();

  select o.* into v_org
  from public.organization_members m
  join public.organizations o on o.id = m.organization_id and o.deleted_at is null
  where m.user_id = v_uid and m.deleted_at is null
  order by m.created_at
  limit 1;

  if v_org.id is not null then
    update public.profiles set active_organization_id = coalesce(active_organization_id, v_org.id)
    where id = v_uid;
    return v_org;
  end if;

  v_name := coalesce(
    nullif(trim(p_company_name), ''),
    nullif(trim(v_auth.raw_user_meta_data->>'company_name'), ''),
    'Minha empresa'
  );
  select * into v_org from public.provision_organization(v_name);
  return v_org;
end;
$$;

grant execute on function public.ensure_user_workspace(text) to authenticated;
revoke all on function public.ensure_user_workspace(text) from public, anon;
