-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 0006_core_functions.sql                                                    ║
-- ║ Core · Funções de autorização (helpers de RLS)                             ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- Funções SECURITY DEFINER usadas pelas políticas RLS (0007).
--
-- POR QUE SECURITY DEFINER: elas consultam organization_members. Se uma policy
-- de organization_members chamasse uma função que lê organization_members SEM
-- security definer, a RLS reentraria recursivamente. Rodando como o dono, a
-- função ignora a RLS internamente e quebra a recursão — padrão recomendado
-- pelo Supabase. `set search_path = public` evita hijack de search_path.

-- Pertence à organização (vínculo ativo)?
create or replace function public.is_org_member(org uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = org
      and m.user_id = auth.uid()
      and m.deleted_at is null
  );
$$;

-- Possui a permissão `perm` na organização `org`?
create or replace function public.has_permission(org uuid, perm text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members m
    join public.role_permissions rp on rp.role_id = m.role_id
    join public.permissions p on p.id = rp.permission_id
    where m.organization_id = org
      and m.user_id = auth.uid()
      and m.deleted_at is null
      and p.key = perm
  );
$$;

-- Organização ativa do usuário atual.
create or replace function public.current_org()
returns uuid
language sql stable security definer set search_path = public
as $$
  select active_organization_id from public.profiles where id = auth.uid();
$$;

-- Compartilha alguma organização com o usuário alvo? (usado no RLS de profiles)
create or replace function public.shares_org_with(target uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members a
    join public.organization_members b on a.organization_id = b.organization_id
    where a.user_id = auth.uid()
      and b.user_id = target
      and a.deleted_at is null
      and b.deleted_at is null
  );
$$;

comment on function public.is_org_member  is 'Core/RLS: usuário atual é membro ativo da org?';
comment on function public.has_permission is 'Core/RLS: usuário atual tem a permissão na org?';
comment on function public.current_org    is 'Core: organização ativa do usuário atual.';
comment on function public.shares_org_with is 'Core/RLS: usuário atual compartilha org com o alvo?';
