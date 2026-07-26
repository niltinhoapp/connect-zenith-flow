-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 0009_core_provisioning.sql                                                 ║
-- ║ Core · Auth trigger + RPCs de provisionamento e RBAC                       ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- Fluxo de bootstrap do usuário/organização e RPCs consumidas pela aplicação.
-- Todas SECURITY DEFINER (executam o bootstrap antes de existir qualquer
-- membership, então precisam ignorar a RLS). Idempotente.

-- ── handle_new_user(): cria profile ao criar auth.users ──────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles(id, full_name, email, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email,
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── provision_organization(): cria org + Owner + define org ativa ─────────────
-- Chamada logo após o cadastro (o form coleta o nome da empresa).
create or replace function public.provision_organization(p_name text)
returns public.organizations
language plpgsql security definer set search_path = public
as $$
declare
  v_uid        uuid := auth.uid();
  v_org        public.organizations;
  v_owner_role uuid;
  v_slug       text;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if coalesce(trim(p_name), '') = '' then
    raise exception 'organization name required';
  end if;

  -- slug único (base + sufixo aleatório)
  v_slug := public.slugify(p_name) || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);

  insert into public.organizations(name, slug)
  values (trim(p_name), v_slug)
  returning * into v_org;

  select id into v_owner_role
  from public.roles
  where organization_id is null and key = 'owner' and is_system;

  if v_owner_role is null then
    raise exception 'owner system role missing (run seed 0008)';
  end if;

  insert into public.organization_members(organization_id, user_id, role_id)
  values (v_org.id, v_uid, v_owner_role);

  -- Define como org ativa se o usuário ainda não tiver uma.
  update public.profiles
    set active_organization_id = v_org.id
    where id = v_uid and active_organization_id is null;

  perform public.write_audit(
    v_org.id, 'organization.created', 'organization', v_org.id,
    jsonb_build_object('name', v_org.name)
  );

  return v_org;
end;
$$;

-- ── set_active_organization(): troca a organização ativa (multi-org) ─────────
create or replace function public.set_active_organization(p_org uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_org_member(p_org) then
    raise exception 'forbidden';
  end if;
  update public.profiles set active_organization_id = p_org where id = auth.uid();
  perform public.write_audit(p_org, 'organization.switched', 'organization', p_org, '{}'::jsonb);
end;
$$;

-- ── create_role(): papel customizado por organização (backend RBAC F1) ────────
-- A UI de gestão fica para a F2; o motor já existe aqui.
create or replace function public.create_role(
  p_org             uuid,
  p_name            text,
  p_permission_keys text[]
)
returns public.roles
language plpgsql security definer set search_path = public
as $$
declare
  v_role public.roles;
begin
  if not public.has_permission(p_org, 'roles.manage') then
    raise exception 'forbidden';
  end if;

  insert into public.roles(organization_id, key, name, is_system)
  values (p_org, public.slugify(p_name), p_name, false)
  returning * into v_role;

  insert into public.role_permissions(role_id, permission_id)
  select v_role.id, p.id
  from public.permissions p
  where p.key = any(p_permission_keys)
  on conflict do nothing;

  perform public.write_audit(
    p_org, 'role.created', 'role', v_role.id,
    jsonb_build_object('name', p_name, 'permissions', to_jsonb(p_permission_keys))
  );

  return v_role;
end;
$$;

-- Permissões de execução (idempotente).
grant execute on function public.provision_organization(text)  to authenticated;
grant execute on function public.set_active_organization(uuid) to authenticated;
grant execute on function public.create_role(uuid, text, text[]) to authenticated;
grant execute on function public.current_org()                 to authenticated;
grant execute on function public.is_org_member(uuid)           to authenticated;
grant execute on function public.has_permission(uuid, text)    to authenticated;
