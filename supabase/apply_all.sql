-- ConnectWeb Automations — schema completo (migrations 0001–0056). Idempotente.

-- === 0001_core_foundation.sql ===
-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 0001_core_foundation.sql                                                   ║
-- ║ Core · Fundação                                                            ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- Extensões e utilitários compartilhados por todo o Core. Idempotente.
--
-- Convenções do projeto (ver docs/DATABASE.md):
--   • Toda entidade usa UUID (gen_random_uuid()).
--   • Toda tabela tem created_at + updated_at (updated_at via trigger).
--   • deleted_at (soft delete) onde faz sentido (organizations, roles, members).
--   • Tabelas append-only (audit_logs) e catálogos (permissions) não têm delete.

-- gen_random_uuid()
create extension if not exists pgcrypto;

-- ── set_updated_at() ─────────────────────────────────────────────────────────
-- Trigger genérico: mantém updated_at sincronizado em qualquer UPDATE.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ── slugify() ────────────────────────────────────────────────────────────────
-- Normaliza um texto em slug url-safe. Usado ao gerar slug de organização e
-- key de papéis customizados. Caracteres acentuados viram '-' (aceitável pois
-- o slug da organização recebe um sufixo aleatório de unicidade).
create or replace function public.slugify(v text)
returns text
language sql
immutable
strict
as $$
  select trim(both '-' from regexp_replace(lower(v), '[^a-z0-9]+', '-', 'g'));
$$;

comment on function public.set_updated_at is 'Core: mantém updated_at em UPDATEs.';
comment on function public.slugify is 'Core: gera slug url-safe a partir de texto.';

-- === 0002_core_organizations.sql ===
-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 0002_core_organizations.sql                                                ║
-- ║ Core · Organizations + Profiles                                            ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- O tenant (organizations) e o perfil de usuário (profiles, 1:1 com auth.users).
-- organization_members fica em 0004 (depende de roles em 0003). Idempotente.

-- ── organizations ────────────────────────────────────────────────────────────
create table if not exists public.organizations (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  slug             text not null unique,
  plan_id          text not null default 'free',            -- → src/config/plans.ts
  enabled_modules  text[] not null default array['dashboard','crm','clientes'],
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz                              -- soft delete
);
comment on table public.organizations is 'Core: tenant/empresa (workspace). Raiz do isolamento multi-tenant.';

drop trigger if exists trg_organizations_updated_at on public.organizations;
create trigger trg_organizations_updated_at
  before update on public.organizations
  for each row execute function public.set_updated_at();

-- ── profiles (1:1 auth.users) ────────────────────────────────────────────────
-- Sem deleted_at: o ciclo de vida segue auth.users (on delete cascade).
create table if not exists public.profiles (
  id                       uuid primary key references auth.users(id) on delete cascade,
  full_name                text not null default '',
  email                    text not null,
  avatar_url               text,
  active_organization_id   uuid references public.organizations(id) on delete set null,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
comment on table public.profiles is 'Core: perfil do usuário (espelha auth.users). active_organization_id = org ativa (multi-org).';

create index if not exists idx_profiles_active_org on public.profiles(active_organization_id);

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- === 0003_core_permissions.sql ===
-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 0003_core_permissions.sql                                                  ║
-- ║ Core · Permissions (RBAC)                                                  ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- Catálogo de permissões + papéis (sistema e customizados por organização) +
-- junção papel↔permissão. O seed dos dados fica em 0008. Idempotente.

-- ── permissions (catálogo global, somente leitura) ───────────────────────────
create table if not exists public.permissions (
  id           uuid primary key default gen_random_uuid(),
  key          text not null unique,          -- 'module.action', ex: 'crm.write'
  module       text not null,                 -- → src/config/modules.ts
  description  text not null default '',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
comment on table public.permissions is 'Core: catálogo global de permissões (module.action). Seed em 0008.';

drop trigger if exists trg_permissions_updated_at on public.permissions;
create trigger trg_permissions_updated_at
  before update on public.permissions
  for each row execute function public.set_updated_at();

-- ── roles (sistema + customizados por organização) ───────────────────────────
-- organization_id NULL  → papel de sistema (owner/admin/member/viewer), imutável.
-- organization_id setado → papel customizado da empresa (is_system = false).
create table if not exists public.roles (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid references public.organizations(id) on delete cascade,
  key              text not null,
  name             text not null,
  description      text not null default '',
  is_system        boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz
);
comment on table public.roles is 'Core: papéis RBAC. org NULL = papel de sistema; org setado = papel customizado.';

-- Unicidade de key: global para papéis de sistema, por-org para customizados.
create unique index if not exists uq_roles_system_key
  on public.roles(key) where organization_id is null;
create unique index if not exists uq_roles_org_key
  on public.roles(organization_id, key) where organization_id is not null;

drop trigger if exists trg_roles_updated_at on public.roles;
create trigger trg_roles_updated_at
  before update on public.roles
  for each row execute function public.set_updated_at();

-- ── role_permissions (N:N papel ↔ permissão) ─────────────────────────────────
create table if not exists public.role_permissions (
  role_id        uuid not null references public.roles(id) on delete cascade,
  permission_id  uuid not null references public.permissions(id) on delete cascade,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  primary key (role_id, permission_id)
);
comment on table public.role_permissions is 'Core: junção papel↔permissão.';

drop trigger if exists trg_role_permissions_updated_at on public.role_permissions;
create trigger trg_role_permissions_updated_at
  before update on public.role_permissions
  for each row execute function public.set_updated_at();

-- === 0004_core_members.sql ===
-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 0004_core_members.sql                                                      ║
-- ║ Core · Organization Members                                                ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- Junção N:N usuário ↔ organização, com papel (role). Suporta multi-org por
-- usuário. Idempotente.

create table if not exists public.organization_members (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  user_id          uuid not null references auth.users(id) on delete cascade,
  role_id          uuid not null references public.roles(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz
);
comment on table public.organization_members is 'Core: vínculo usuário↔organização + papel. Base do multi-tenant e do multi-org.';

-- Um vínculo ativo por (org, usuário). Partial index permite re-vincular após
-- soft delete sem colidir.
create unique index if not exists uq_org_members_active
  on public.organization_members(organization_id, user_id)
  where deleted_at is null;

create index if not exists idx_org_members_user on public.organization_members(user_id) where deleted_at is null;
create index if not exists idx_org_members_org  on public.organization_members(organization_id) where deleted_at is null;

drop trigger if exists trg_org_members_updated_at on public.organization_members;
create trigger trg_org_members_updated_at
  before update on public.organization_members
  for each row execute function public.set_updated_at();

-- === 0005_core_audit.sql ===
-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 0005_core_audit.sql                                                        ║
-- ║ Core · Audit Logs                                                          ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- Trilha de auditoria append-only (infra do Core desde a F1, mesmo sem UI).
-- Registros são imutáveis: escritos apenas via write_audit() (SECURITY DEFINER)
-- e nunca alterados/removidos pelo cliente (ver RLS em 0007). Idempotente.
--
-- Observação de convenção: mantém created_at + updated_at por padrão do projeto,
-- porém audit é append-only — updated_at permanece = created_at (sem UPDATEs).
-- Sem deleted_at (uma auditoria apagável não é auditoria).

create table if not exists public.audit_logs (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid references public.organizations(id) on delete set null,
  actor_id         uuid references auth.users(id) on delete set null,
  action           text not null,                    -- ex: 'organization.created'
  entity_type      text,                             -- ex: 'organization', 'role'
  entity_id        uuid,
  metadata         jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
comment on table public.audit_logs is 'Core: trilha de auditoria append-only. Escrita só via write_audit().';

create index if not exists idx_audit_org     on public.audit_logs(organization_id, created_at desc);
create index if not exists idx_audit_actor   on public.audit_logs(actor_id, created_at desc);

-- ── write_audit() ────────────────────────────────────────────────────────────
-- Ponto único de escrita da auditoria. SECURITY DEFINER: as demais RPCs do Core
-- chamam esta função para registrar eventos, ignorando RLS de inserção.
create or replace function public.write_audit(
  p_org         uuid,
  p_action      text,
  p_entity_type text default null,
  p_entity_id   uuid default null,
  p_metadata    jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_logs(organization_id, actor_id, action, entity_type, entity_id, metadata)
  values (p_org, auth.uid(), p_action, p_entity_type, p_entity_id, coalesce(p_metadata, '{}'::jsonb));
end;
$$;
comment on function public.write_audit is 'Core: registra evento na trilha de auditoria (append-only).';

-- === 0006_core_functions.sql ===
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

-- === 0007_core_rls.sql ===
-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 0007_core_rls.sql                                                          ║
-- ║ Core · Row Level Security (isolamento entre empresas)                      ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- Habilita RLS e define políticas para todas as tabelas do Core. Idempotente
-- (drop policy if exists antes de create). Políticas para o papel `authenticated`.
--
-- ISOLAMENTO: nenhuma empresa vê dados de outra. Toda leitura/escrita passa por
-- is_org_member()/has_permission(), que resolvem via auth.uid() (JWT). O cliente
-- nunca envia organization_id "confiável" — o Postgres decide o que ele vê.

-- Garantias de acesso do PostgREST (idempotente; Supabase já concede por padrão).
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;

-- ── organizations ────────────────────────────────────────────────────────────
alter table public.organizations enable row level security;

drop policy if exists org_select on public.organizations;
create policy org_select on public.organizations for select to authenticated
  using (deleted_at is null and public.is_org_member(id));

drop policy if exists org_update on public.organizations;
create policy org_update on public.organizations for update to authenticated
  using (public.has_permission(id, 'org.manage'))
  with check (public.has_permission(id, 'org.manage'));
-- INSERT/DELETE: apenas via RPC provision_organization / org.delete (definer).

-- ── profiles ─────────────────────────────────────────────────────────────────
alter table public.profiles enable row level security;

drop policy if exists profile_select on public.profiles;
create policy profile_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.shares_org_with(id));

drop policy if exists profile_update on public.profiles;
create policy profile_update on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());
-- INSERT: via trigger handle_new_user (definer).

-- ── roles ────────────────────────────────────────────────────────────────────
alter table public.roles enable row level security;

drop policy if exists roles_select on public.roles;
create policy roles_select on public.roles for select to authenticated
  using (deleted_at is null and (organization_id is null or public.is_org_member(organization_id)));

-- Papéis de sistema (org NULL) nunca são graváveis pelo cliente.
drop policy if exists roles_write on public.roles;
create policy roles_write on public.roles for all to authenticated
  using (organization_id is not null and public.has_permission(organization_id, 'roles.manage'))
  with check (organization_id is not null and public.has_permission(organization_id, 'roles.manage'));

-- ── permissions (catálogo: leitura para todos autenticados) ───────────────────
alter table public.permissions enable row level security;

drop policy if exists permissions_select on public.permissions;
create policy permissions_select on public.permissions for select to authenticated
  using (true);
-- Sem políticas de escrita: catálogo é semeado (0008) via migração/definer.

-- ── role_permissions ─────────────────────────────────────────────────────────
alter table public.role_permissions enable row level security;

drop policy if exists role_perms_select on public.role_permissions;
create policy role_perms_select on public.role_permissions for select to authenticated
  using (exists (
    select 1 from public.roles r
    where r.id = role_id
      and (r.organization_id is null or public.is_org_member(r.organization_id))
  ));

drop policy if exists role_perms_write on public.role_permissions;
create policy role_perms_write on public.role_permissions for all to authenticated
  using (exists (
    select 1 from public.roles r
    where r.id = role_id and r.organization_id is not null
      and public.has_permission(r.organization_id, 'roles.manage')
  ))
  with check (exists (
    select 1 from public.roles r
    where r.id = role_id and r.organization_id is not null
      and public.has_permission(r.organization_id, 'roles.manage')
  ));

-- ── organization_members ─────────────────────────────────────────────────────
alter table public.organization_members enable row level security;

drop policy if exists members_select on public.organization_members;
create policy members_select on public.organization_members for select to authenticated
  using (deleted_at is null and public.is_org_member(organization_id));

drop policy if exists members_write on public.organization_members;
create policy members_write on public.organization_members for all to authenticated
  using (public.has_permission(organization_id, 'members.manage'))
  with check (public.has_permission(organization_id, 'members.manage'));
-- O primeiro membro (Owner) é criado por provision_organization (definer).

-- ── audit_logs (leitura por membros; escrita só via write_audit definer) ──────
alter table public.audit_logs enable row level security;

drop policy if exists audit_select on public.audit_logs;
create policy audit_select on public.audit_logs for select to authenticated
  using (organization_id is not null and public.is_org_member(organization_id));
-- Sem policies de INSERT/UPDATE/DELETE: append-only via write_audit().

-- === 0008_core_seed.sql ===
-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 0008_core_seed.sql                                                         ║
-- ║ Core · Seed de permissões e papéis de sistema                              ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- Semeia o catálogo de permissões, os 4 papéis de sistema e o mapeamento
-- papel↔permissão. Totalmente idempotente (ON CONFLICT). Reexecutável.

-- ── Catálogo de permissões (module.action) ───────────────────────────────────
insert into public.permissions(key, module, description) values
  ('org.manage',           'organizations', 'Gerenciar dados e configurações da organização'),
  ('org.delete',           'organizations', 'Excluir a organização'),
  ('members.read',         'organizations', 'Ver membros da organização'),
  ('members.manage',       'organizations', 'Convidar/remover/alterar membros'),
  ('roles.manage',         'permissions',   'Criar e editar papéis e permissões'),
  ('billing.manage',       'billing',       'Gerenciar plano, assinatura e cobrança'),
  ('audit.read',           'audit',         'Consultar a trilha de auditoria'),
  ('dashboard.read',       'dashboard',     'Ver o dashboard'),
  ('crm.read',             'crm',           'Ver o CRM'),
  ('crm.write',            'crm',           'Editar o CRM'),
  ('clientes.read',        'clientes',      'Ver clientes'),
  ('clientes.write',       'clientes',      'Editar clientes'),
  ('whatsapp.read',        'whatsapp',      'Ver conversas de WhatsApp'),
  ('whatsapp.send',        'whatsapp',      'Enviar mensagens de WhatsApp'),
  ('automacoes.read',      'automacoes',    'Ver automações'),
  ('automacoes.write',     'automacoes',    'Editar automações'),
  ('automacoes.execute',   'automacoes',    'Executar/testar automações'),
  ('ia.use',               'ia',            'Usar recursos de IA'),
  ('relatorios.read',      'relatorios',    'Ver relatórios'),
  ('configuracoes.manage', 'configuracoes', 'Gerenciar configurações do workspace')
on conflict (key) do update set module = excluded.module, description = excluded.description;

-- ── Papéis de sistema (organization_id NULL, imutáveis) ───────────────────────
insert into public.roles(organization_id, key, name, description, is_system) values
  (null, 'owner',  'Proprietário', 'Controle total da organização',            true),
  (null, 'admin',  'Administrador', 'Gestão completa, exceto exclusão/cobrança', true),
  (null, 'member', 'Membro',        'Operação dos módulos do dia a dia',         true),
  (null, 'viewer', 'Visualizador',  'Acesso somente leitura',                    true)
on conflict (key) where organization_id is null
  do update set name = excluded.name, description = excluded.description;

-- ── Mapeamento papel → permissões ─────────────────────────────────────────────
-- owner: TODAS as permissões.
insert into public.role_permissions(role_id, permission_id)
select r.id, p.id
from public.roles r cross join public.permissions p
where r.organization_id is null and r.key = 'owner'
on conflict do nothing;

-- admin: tudo, exceto excluir org e gerenciar cobrança.
insert into public.role_permissions(role_id, permission_id)
select r.id, p.id
from public.roles r cross join public.permissions p
where r.organization_id is null and r.key = 'admin'
  and p.key not in ('org.delete', 'billing.manage')
on conflict do nothing;

-- member: operação dos módulos (sem gestão de org/papéis/cobrança/auditoria).
insert into public.role_permissions(role_id, permission_id)
select r.id, p.id
from public.roles r cross join public.permissions p
where r.organization_id is null and r.key = 'member'
  and p.key in (
    'dashboard.read','crm.read','crm.write','clientes.read','clientes.write',
    'whatsapp.read','whatsapp.send','automacoes.read','automacoes.write',
    'automacoes.execute','ia.use','relatorios.read','members.read'
  )
on conflict do nothing;

-- viewer: somente leitura dos módulos (exceto auditoria).
insert into public.role_permissions(role_id, permission_id)
select r.id, p.id
from public.roles r cross join public.permissions p
where r.organization_id is null and r.key = 'viewer'
  and p.key like '%.read' and p.key <> 'audit.read'
on conflict do nothing;

-- === 0009_core_provisioning.sql ===
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

-- === 0010_crm_foundation.sql ===
-- 0010_crm_foundation.sql — Módulo CRM · funções base compartilhadas. Idempotente.
-- Sequências por organização (códigos legíveis), geração de code e auditoria
-- automática via trigger genérico.

-- ── Sequências por organização (para códigos tipo CUST-00001) ────────────────
create table if not exists public.org_sequences (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  key             text not null,
  current         bigint not null default 0,
  primary key (organization_id, key)
);
alter table public.org_sequences enable row level security;  -- só via função definer

create or replace function public.next_sequence(p_org uuid, p_key text)
returns bigint language plpgsql security definer set search_path = public as $$
declare v bigint;
begin
  insert into public.org_sequences(organization_id, key, current)
  values (p_org, p_key, 1)
  on conflict (organization_id, key)
    do update set current = public.org_sequences.current + 1
  returning current into v;
  return v;
end; $$;

-- ── Geração automática de code (BEFORE INSERT). Args: prefixo, chave ─────────
create or replace function public.set_entity_code()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.code is null or new.code = '' then
    new.code := TG_ARGV[0] || '-' ||
      lpad(public.next_sequence(new.organization_id, TG_ARGV[1])::text, 5, '0');
  end if;
  return new;
end; $$;

-- ── Auditoria automática (AFTER INSERT/UPDATE/DELETE) ────────────────────────
-- Toda operação CRUD nas tabelas do CRM gera audit_logs via write_audit().
create or replace function public.audit_row_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_org uuid; v_id uuid; v_action text;
begin
  if TG_OP = 'DELETE' then
    v_org := OLD.organization_id; v_id := OLD.id;
    v_action := TG_TABLE_NAME || '.deleted';
  else
    v_org := NEW.organization_id; v_id := NEW.id;
    v_action := TG_TABLE_NAME || '.' || (case when TG_OP = 'INSERT' then 'created' else 'updated' end);
  end if;
  perform public.write_audit(v_org, v_action, TG_TABLE_NAME, v_id, '{}'::jsonb);
  return null;
end; $$;

-- === 0011_crm_customers.sql ===
-- 0011_crm_customers.sql — Módulo CRM · Customers. Idempotente.
-- Entidade Customer (pessoa ou empresa) preparada para crescer: contato,
-- documento, origem, tags, custom_fields (jsonb). Distinta de Lead (0012).

create table if not exists public.customers (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  code             text,                                    -- CUST-00001 (auto)
  type             text not null default 'person' check (type in ('person','company')),
  first_name       text,
  last_name        text,
  company_name     text,
  document         text,                                    -- CPF/CNPJ
  email            text,
  phone            text,
  mobile           text,
  website          text,
  status           text not null default 'active'
                     check (status in ('active','inactive','prospect','vip')),
  owner_id         uuid references auth.users(id) on delete set null,
  source           text,
  notes            text,
  tags             text[] not null default '{}',
  custom_fields    jsonb  not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz
);
comment on table public.customers is 'CRM: clientes (pessoa/empresa). Preparado para crescer (custom_fields, tags).';

create index if not exists idx_customers_org      on public.customers(organization_id) where deleted_at is null;
create index if not exists idx_customers_email     on public.customers(organization_id, email);
create index if not exists idx_customers_document  on public.customers(organization_id, document);
create index if not exists idx_customers_owner     on public.customers(owner_id);
create index if not exists idx_customers_status    on public.customers(organization_id, status);
create unique index if not exists uq_customers_code on public.customers(organization_id, code) where code is not null;

drop trigger if exists trg_customers_updated_at on public.customers;
create trigger trg_customers_updated_at before update on public.customers
  for each row execute function public.set_updated_at();

drop trigger if exists trg_customers_code on public.customers;
create trigger trg_customers_code before insert on public.customers
  for each row execute function public.set_entity_code('CUST', 'customer');

-- === 0012_crm_leads.sql ===
-- 0012_crm_leads.sql — Módulo CRM · Leads. Idempotente.
-- Lead = contato que ainda NÃO é cliente. Ao qualificar, converte-se em Customer
-- (converted_customer_id). Separação Lead/Customer/Deal como em CRMs robustos.

create table if not exists public.leads (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references public.organizations(id) on delete cascade,
  code                  text,                               -- LEAD-00001 (auto)
  name                  text not null,
  company_name          text,
  email                 text,
  phone                 text,
  source                text,
  status                text not null default 'new'
                          check (status in ('new','contacted','qualified','unqualified','converted')),
  owner_id              uuid references auth.users(id) on delete set null,
  notes                 text,
  tags                  text[] not null default '{}',
  custom_fields         jsonb  not null default '{}'::jsonb,
  converted_customer_id uuid references public.customers(id) on delete set null,
  converted_at          timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  deleted_at            timestamptz
);
comment on table public.leads is 'CRM: leads (pré-cliente). Converte para customers ao qualificar.';

create index if not exists idx_leads_org    on public.leads(organization_id) where deleted_at is null;
create index if not exists idx_leads_email  on public.leads(organization_id, email);
create index if not exists idx_leads_owner  on public.leads(owner_id);
create index if not exists idx_leads_status on public.leads(organization_id, status);
create unique index if not exists uq_leads_code on public.leads(organization_id, code) where code is not null;

drop trigger if exists trg_leads_updated_at on public.leads;
create trigger trg_leads_updated_at before update on public.leads
  for each row execute function public.set_updated_at();

drop trigger if exists trg_leads_code on public.leads;
create trigger trg_leads_code before insert on public.leads
  for each row execute function public.set_entity_code('LEAD', 'lead');

-- === 0013_crm_pipelines.sql ===
-- 0013_crm_pipelines.sql — Módulo CRM · Pipelines + Stages. Idempotente.
-- Múltiplos funis por empresa (Comercial, Suporte, Pós-venda, Renovação…) sem
-- tocar código. Estágio deixa de ser texto: vira linha em pipeline_stages.

create table if not exists public.pipelines (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  name             text not null,
  is_default       boolean not null default false,
  position         int not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz
);
comment on table public.pipelines is 'CRM: funis de negócio por organização.';
create unique index if not exists uq_pipelines_name on public.pipelines(organization_id, name) where deleted_at is null;

drop trigger if exists trg_pipelines_updated_at on public.pipelines;
create trigger trg_pipelines_updated_at before update on public.pipelines
  for each row execute function public.set_updated_at();

create table if not exists public.pipeline_stages (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  pipeline_id      uuid not null references public.pipelines(id) on delete cascade,
  name             text not null,
  position         int not null default 0,
  -- type define a semântica do estágio (aberto / ganho / perdido).
  type             text not null default 'open' check (type in ('open','won','lost')),
  probability      int not null default 0 check (probability between 0 and 100),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz
);
comment on table public.pipeline_stages is 'CRM: estágios de um funil (ordem + tipo open/won/lost).';
create index if not exists idx_stages_pipeline on public.pipeline_stages(pipeline_id, position) where deleted_at is null;

drop trigger if exists trg_pipeline_stages_updated_at on public.pipeline_stages;
create trigger trg_pipeline_stages_updated_at before update on public.pipeline_stages
  for each row execute function public.set_updated_at();

-- === 0014_crm_deals.sql ===
-- 0014_crm_deals.sql — Módulo CRM · Deals. Idempotente.
-- Oportunidade de negócio vinculada a um Customer, dentro de um pipeline/stage
-- (referências, não texto). O tipo do stage (open/won/lost) define o desfecho.

create table if not exists public.deals (
  id                   uuid primary key default gen_random_uuid(),
  organization_id      uuid not null references public.organizations(id) on delete cascade,
  code                 text,                                -- DEAL-00001 (auto)
  customer_id          uuid references public.customers(id) on delete set null,
  pipeline_id          uuid not null references public.pipelines(id),
  stage_id             uuid not null references public.pipeline_stages(id),
  title                text not null,
  amount               bigint not null default 0 check (amount >= 0),  -- centavos
  currency             text not null default 'BRL',
  owner_id             uuid references auth.users(id) on delete set null,
  source               text,
  notes                text,
  tags                 text[] not null default '{}',
  custom_fields        jsonb  not null default '{}'::jsonb,
  expected_close_date  date,
  closed_at            timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  deleted_at           timestamptz
);
comment on table public.deals is 'CRM: negócios/oportunidades (pipeline + stage referenciados).';

create index if not exists idx_deals_org      on public.deals(organization_id) where deleted_at is null;
create index if not exists idx_deals_customer on public.deals(customer_id);
create index if not exists idx_deals_pipeline on public.deals(pipeline_id);
create index if not exists idx_deals_stage    on public.deals(stage_id);
create index if not exists idx_deals_owner    on public.deals(owner_id);
create unique index if not exists uq_deals_code on public.deals(organization_id, code) where code is not null;

drop trigger if exists trg_deals_updated_at on public.deals;
create trigger trg_deals_updated_at before update on public.deals
  for each row execute function public.set_updated_at();

drop trigger if exists trg_deals_code on public.deals;
create trigger trg_deals_code before insert on public.deals
  for each row execute function public.set_entity_code('DEAL', 'deal');

-- === 0015_crm_engagement.sql ===
-- 0015_crm_engagement.sql — Módulo CRM · Timeline, Comments, Attachments. Idempotente.
-- Histórico da jornada do cliente + comentários + anexos (Supabase Storage).

-- ── customer_timeline (histórico de eventos da jornada) ──────────────────────
create table if not exists public.customer_timeline (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  customer_id      uuid references public.customers(id) on delete cascade,
  actor_id         uuid references auth.users(id) on delete set null,
  -- ex: customer.created, lead.converted, deal.created, whatsapp.sent, note,
  --     stage.changed, automation.executed, file.uploaded
  event_type       text not null,
  title            text not null,
  description      text,
  -- referência polimórfica ao objeto de origem (deal, comment, attachment…)
  related_type     text,
  related_id       uuid,
  metadata         jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz
);
comment on table public.customer_timeline is 'CRM: histórico/jornada do cliente (todos os eventos).';
create index if not exists idx_timeline_customer on public.customer_timeline(organization_id, customer_id, created_at desc);

drop trigger if exists trg_timeline_updated_at on public.customer_timeline;
create trigger trg_timeline_updated_at before update on public.customer_timeline
  for each row execute function public.set_updated_at();

-- ── comments (relacionável a customer / deal / lead / timeline) ───────────────
create table if not exists public.comments (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  author_id        uuid references auth.users(id) on delete set null,
  body             text not null,
  related_type     text not null check (related_type in ('customer','deal','lead','timeline')),
  related_id       uuid not null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz
);
comment on table public.comments is 'CRM: comentários polimórficos (customer/deal/lead/timeline).';
create index if not exists idx_comments_related on public.comments(organization_id, related_type, related_id);

drop trigger if exists trg_comments_updated_at on public.comments;
create trigger trg_comments_updated_at before update on public.comments
  for each row execute function public.set_updated_at();

-- ── attachments (Supabase Storage) ───────────────────────────────────────────
create table if not exists public.attachments (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  uploaded_by      uuid references auth.users(id) on delete set null,
  storage_bucket   text not null default 'attachments',
  storage_path     text not null,                          -- org/{id}/...
  file_name        text not null,
  mime_type        text,
  size_bytes       bigint,
  related_type     text check (related_type in ('customer','deal','lead','timeline','comment')),
  related_id       uuid,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz
);
comment on table public.attachments is 'CRM: anexos (metadados; binário no Supabase Storage).';
create index if not exists idx_attachments_related on public.attachments(organization_id, related_type, related_id);

drop trigger if exists trg_attachments_updated_at on public.attachments;
create trigger trg_attachments_updated_at before update on public.attachments
  for each row execute function public.set_updated_at();

-- === 0016_crm_reference.sql ===
-- 0016_crm_reference.sql — Módulo CRM · Tabelas de referência. Idempotente.
-- Personalização por organização: catálogos de tags e definições de campos
-- customizados (que preenchem o jsonb custom_fields de customers/deals).

create table if not exists public.customer_tags (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  name             text not null,
  color            text not null default '#2563EB',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create unique index if not exists uq_customer_tags on public.customer_tags(organization_id, name);

create table if not exists public.deal_tags (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  name             text not null,
  color            text not null default '#2563EB',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create unique index if not exists uq_deal_tags on public.deal_tags(organization_id, name);

-- Definições de campos customizados (schema de personalização).
create table if not exists public.customer_custom_fields (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  key              text not null,
  label            text not null,
  field_type       text not null default 'text'
                     check (field_type in ('text','number','date','select','boolean')),
  options          jsonb not null default '[]'::jsonb,
  position         int not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create unique index if not exists uq_customer_custom_fields on public.customer_custom_fields(organization_id, key);

create table if not exists public.deal_custom_fields (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  key              text not null,
  label            text not null,
  field_type       text not null default 'text'
                     check (field_type in ('text','number','date','select','boolean')),
  options          jsonb not null default '[]'::jsonb,
  position         int not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create unique index if not exists uq_deal_custom_fields on public.deal_custom_fields(organization_id, key);

-- updated_at triggers
do $$
declare t text;
begin
  foreach t in array array['customer_tags','deal_tags','customer_custom_fields','deal_custom_fields'] loop
    execute format('drop trigger if exists trg_%1$s_updated_at on public.%1$s', t);
    execute format(
      'create trigger trg_%1$s_updated_at before update on public.%1$s for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- === 0017_crm_permissions.sql ===
-- 0017_crm_permissions.sql — Módulo CRM · extensão do catálogo RBAC. Idempotente.
-- Novas permissões para leads e gestão de pipelines, mapeadas aos papéis de
-- sistema. (customers reusa clientes.*, deals reusa crm.*.)

insert into public.permissions(key, module, description) values
  ('leads.read',        'clientes', 'Ver leads'),
  ('leads.write',       'clientes', 'Editar/converter leads'),
  ('pipelines.manage',  'crm',      'Gerenciar funis e estágios')
on conflict (key) do update set module = excluded.module, description = excluded.description;

-- owner e admin recebem todas as novas permissões.
insert into public.role_permissions(role_id, permission_id)
select r.id, p.id
from public.roles r cross join public.permissions p
where r.organization_id is null and r.key in ('owner','admin')
  and p.key in ('leads.read','leads.write','pipelines.manage')
on conflict do nothing;

-- member: opera leads (sem gerenciar funis).
insert into public.role_permissions(role_id, permission_id)
select r.id, p.id
from public.roles r cross join public.permissions p
where r.organization_id is null and r.key = 'member'
  and p.key in ('leads.read','leads.write')
on conflict do nothing;

-- viewer: só leitura de leads.
insert into public.role_permissions(role_id, permission_id)
select r.id, p.id
from public.roles r cross join public.permissions p
where r.organization_id is null and r.key = 'viewer'
  and p.key = 'leads.read'
on conflict do nothing;

-- === 0018_crm_audit_triggers.sql ===
-- 0018_crm_audit_triggers.sql — Módulo CRM · auditoria automática. Idempotente.
-- Anexa audit_row_change() (AFTER INSERT/UPDATE/DELETE) a todas as tabelas do
-- CRM: toda operação CRUD gera um registro em audit_logs.

do $$
declare t text;
begin
  foreach t in array array[
    'customers','leads','pipelines','pipeline_stages','deals',
    'customer_timeline','comments','attachments',
    'customer_tags','deal_tags','customer_custom_fields','deal_custom_fields'
  ] loop
    execute format('drop trigger if exists trg_%1$s_audit on public.%1$s', t);
    execute format(
      'create trigger trg_%1$s_audit after insert or update or delete on public.%1$s '
      || 'for each row execute function public.audit_row_change()', t);
  end loop;
end $$;

-- === 0019_crm_rls.sql ===
-- 0019_crm_rls.sql — Módulo CRM · Row Level Security. Idempotente.
-- Isolamento por organização + gating por permissão (has_permission). As
-- escritas de sistema (triggers/RPCs SECURITY DEFINER) ignoram a RLS.

-- Tabelas com gating por permissão (read_perm / write_perm).
do $$
declare rec record;
begin
  for rec in
    select * from (values
      ('customers',              'clientes.read', 'clientes.write', true),
      ('leads',                  'leads.read',    'leads.write',    true),
      ('pipelines',              'crm.read',      'pipelines.manage', true),
      ('pipeline_stages',        'crm.read',      'pipelines.manage', true),
      ('deals',                  'crm.read',      'crm.write',      true),
      ('customer_timeline',      'clientes.read', 'clientes.write', true),
      ('customer_tags',          'clientes.read', 'clientes.write', false),
      ('deal_tags',              'crm.read',      'crm.write',      false),
      ('customer_custom_fields', 'clientes.read', 'clientes.write', false),
      ('deal_custom_fields',     'crm.read',      'crm.write',      false)
    ) as t(tbl, read_perm, write_perm, soft_delete)
  loop
    execute format('alter table public.%I enable row level security', rec.tbl);

    execute format('drop policy if exists %I on public.%I', rec.tbl || '_select', rec.tbl);
    execute format(
      'create policy %I on public.%I for select to authenticated using (%s public.has_permission(organization_id, %L))',
      rec.tbl || '_select', rec.tbl,
      case when rec.soft_delete then 'deleted_at is null and' else '' end,
      rec.read_perm);

    execute format('drop policy if exists %I on public.%I', rec.tbl || '_write', rec.tbl);
    execute format(
      'create policy %I on public.%I for all to authenticated '
      || 'using (public.has_permission(organization_id, %L)) '
      || 'with check (public.has_permission(organization_id, %L))',
      rec.tbl || '_write', rec.tbl, rec.write_perm, rec.write_perm);
  end loop;
end $$;

-- comments e attachments: qualquer membro da organização (colaboração).
do $$
declare t text;
begin
  foreach t in array array['comments','attachments'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (deleted_at is null and public.is_org_member(organization_id))',
      t || '_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_write', t);
    execute format(
      'create policy %I on public.%I for all to authenticated '
      || 'using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id))',
      t || '_write', t);
  end loop;
end $$;

-- org_sequences: RLS já habilitada (0010), sem políticas → sem acesso direto do
-- cliente; só as funções SECURITY DEFINER escrevem.

-- Concede privilégios do PostgREST às novas tabelas (idempotente).
grant select, insert, update, delete on all tables in schema public to authenticated;

-- === 0020_crm_provisioning.sql ===
-- 0020_crm_provisioning.sql — Módulo CRM · funil padrão no provisionamento. Idempotente.
-- Toda nova organização nasce com um pipeline "Comercial" e estágios padrão.

create or replace function public.create_default_pipeline(p_org uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_pipeline uuid;
begin
  insert into public.pipelines(organization_id, name, is_default, position)
  values (p_org, 'Comercial', true, 0)
  returning id into v_pipeline;

  insert into public.pipeline_stages(organization_id, pipeline_id, name, position, type, probability) values
    (p_org, v_pipeline, 'Lead',        0, 'open', 10),
    (p_org, v_pipeline, 'Qualificado', 1, 'open', 30),
    (p_org, v_pipeline, 'Proposta',    2, 'open', 60),
    (p_org, v_pipeline, 'Negociação',  3, 'open', 80),
    (p_org, v_pipeline, 'Ganho',       4, 'won',  100),
    (p_org, v_pipeline, 'Perdido',     5, 'lost', 0);

  return v_pipeline;
end; $$;

-- Redefine provision_organization para também semear o funil padrão.
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
  if v_uid is null then raise exception 'not authenticated'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'organization name required'; end if;

  v_slug := public.slugify(p_name) || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);

  insert into public.organizations(name, slug) values (trim(p_name), v_slug) returning * into v_org;

  select id into v_owner_role
  from public.roles where organization_id is null and key = 'owner' and is_system;
  if v_owner_role is null then raise exception 'owner system role missing (run seed 0008)'; end if;

  insert into public.organization_members(organization_id, user_id, role_id)
  values (v_org.id, v_uid, v_owner_role);

  update public.profiles set active_organization_id = v_org.id
    where id = v_uid and active_organization_id is null;

  perform public.create_default_pipeline(v_org.id);           -- funil inicial

  perform public.write_audit(v_org.id, 'organization.created', 'organization', v_org.id,
    jsonb_build_object('name', v_org.name));

  return v_org;
end;
$$;

-- === 0021_crm_adjust_customers.sql ===
-- 0021_crm_adjust_customers.sql — Customer: campos para IA/automação. Idempotente.
alter table public.customers
  add column if not exists last_contact_at  timestamptz,
  add column if not exists next_followup_at timestamptz,
  add column if not exists score            int,
  add column if not exists lifetime_value   bigint not null default 0,   -- centavos
  add column if not exists origin_channel   text;

create index if not exists idx_customers_followup
  on public.customers(organization_id, next_followup_at)
  where next_followup_at is not null;

-- === 0022_crm_adjust_deals.sql ===
-- 0022_crm_adjust_deals.sql — Deals: campos de fechamento p/ relatórios. Idempotente.
alter table public.deals
  add column if not exists won_at               timestamptz,
  add column if not exists lost_at              timestamptz,
  add column if not exists loss_reason          text,
  add column if not exists win_reason           text,
  add column if not exists probability_override int check (probability_override between 0 and 100);
-- expected_close_date já existe (0014).

-- === 0023_crm_adjust_pipelines.sql ===
-- 0023_crm_adjust_pipelines.sql — Pipelines: apresentação. Idempotente.
alter table public.pipelines
  add column if not exists color         text not null default '#2563EB',
  add column if not exists icon          text,
  add column if not exists display_order int not null default 0;
-- is_default já existe (0013).

-- === 0024_crm_adjust_leads.sql ===
-- 0024_crm_adjust_leads.sql — Lead: marco de qualificação. Idempotente.
-- Fluxo: new → contacted → qualified (qualified_at) → converted (vira Customer).
alter table public.leads
  add column if not exists qualified_at timestamptz;

-- === 0025_crm_adjust_comments.sql ===
-- 0025_crm_adjust_comments.sql — Comments encadeados. Idempotente.
-- author_id e deleted_at já existem (0015). Adiciona edição e threading.
alter table public.comments
  add column if not exists edited_at timestamptz,
  add column if not exists reply_to  uuid references public.comments(id) on delete set null;

create index if not exists idx_comments_reply on public.comments(reply_to) where reply_to is not null;

-- === 0026_crm_adjust_attachments.sql ===
-- 0026_crm_adjust_attachments.sql — Attachments: agnóstico de provedor. Idempotente.
-- storage_path, mime_type, size_bytes, uploaded_by já existem (0015).
alter table public.attachments
  add column if not exists storage_provider text not null default 'supabase',
  add column if not exists checksum         text;

-- === 0027_crm_adjust_timeline.sql ===
-- 0027_crm_adjust_timeline.sql — Timeline como hub de eventos de QUALQUER módulo.
-- Idempotente. Padroniza em event_type + payload (jsonb) + module, evitando
-- mudanças de schema quando novos módulos (WhatsApp, IA, Agenda, Financeiro,
-- Marketing, API…) passarem a registrar eventos.

-- Renomeia metadata → payload (uma vez).
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'customer_timeline' and column_name = 'metadata'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'customer_timeline' and column_name = 'payload'
  ) then
    alter table public.customer_timeline rename column metadata to payload;
  end if;
end $$;

alter table public.customer_timeline
  add column if not exists payload jsonb not null default '{}'::jsonb,
  add column if not exists module  text;   -- crm | whatsapp | ia | automation | ...

create index if not exists idx_timeline_module on public.customer_timeline(organization_id, module, created_at desc);

-- === 0028_crm_lead_conversion.sql ===
-- 0028_crm_lead_conversion.sql — Conversão Lead → Customer (transacional). Idempotente.
-- Regra de negócio: um Deal NUNCA nasce de um Lead. O Lead vira Customer aqui;
-- os Deals são criados depois, a partir do Customer.

create or replace function public.convert_lead_to_customer(p_lead_id uuid)
returns public.customers
language plpgsql security definer set search_path = public
as $$
declare
  v_lead     public.leads;
  v_customer public.customers;
  v_org      uuid;
begin
  select * into v_lead from public.leads where id = p_lead_id and deleted_at is null;
  if v_lead.id is null then raise exception 'lead not found'; end if;

  v_org := v_lead.organization_id;
  if not public.has_permission(v_org, 'leads.write') then raise exception 'forbidden'; end if;
  if v_lead.converted_customer_id is not null then raise exception 'lead already converted'; end if;

  insert into public.customers(
    organization_id, type, first_name, company_name, email, phone,
    source, notes, owner_id, status, origin_channel
  )
  values (
    v_org,
    case when coalesce(v_lead.company_name, '') <> '' then 'company' else 'person' end,
    v_lead.name, v_lead.company_name, v_lead.email, v_lead.phone,
    v_lead.source, v_lead.notes, v_lead.owner_id, 'active', v_lead.source
  )
  returning * into v_customer;

  update public.leads
    set status = 'converted', converted_customer_id = v_customer.id, converted_at = now()
    where id = p_lead_id;

  -- Timeline (hub) + auditoria
  insert into public.customer_timeline(organization_id, customer_id, actor_id, module, event_type, title, payload)
  values (v_org, v_customer.id, auth.uid(), 'crm', 'lead.converted', 'Lead convertido em cliente',
          jsonb_build_object('lead_id', p_lead_id, 'customer_code', v_customer.code));

  perform public.write_audit(v_org, 'lead.converted', 'lead', p_lead_id,
    jsonb_build_object('customer_id', v_customer.id));

  return v_customer;
end;
$$;

grant execute on function public.convert_lead_to_customer(uuid) to authenticated;

-- === 0029_crm_dashboard.sql ===
-- 0029_crm_dashboard.sql — Read model de indicadores do Dashboard. Idempotente.
-- Uma RPC com agregações no banco (evita N+1, um único round-trip). SECURITY
-- DEFINER + checagem de membro (RLS-equivalente). Preparada para IA consumir os
-- mesmos indicadores no futuro.

create or replace function public.dashboard_metrics(p_org uuid)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_active_customers int;
  v_leads_period     int;
  v_leads_converted  int;
  v_open_deals       int;
  v_revenue          bigint;
  v_won_count        int;
  v_pipeline         jsonb;
  v_activities       jsonb;
  v_series           jsonb;
begin
  if not public.is_org_member(p_org) then
    raise exception 'forbidden';
  end if;

  select count(*) into v_active_customers
    from public.customers
    where organization_id = p_org and status = 'active' and deleted_at is null;

  select count(*) into v_leads_period
    from public.leads
    where organization_id = p_org and deleted_at is null
      and created_at >= now() - interval '30 days';

  select count(*) into v_leads_converted
    from public.leads
    where organization_id = p_org and deleted_at is null and status = 'converted'
      and converted_at >= now() - interval '30 days';

  select count(*) into v_open_deals
    from public.deals
    where organization_id = p_org and deleted_at is null
      and won_at is null and lost_at is null;

  select coalesce(sum(amount), 0), count(*) into v_revenue, v_won_count
    from public.deals
    where organization_id = p_org and deleted_at is null
      and won_at >= date_trunc('month', now());

  select coalesce(
    jsonb_agg(jsonb_build_object('stage', s.name, 'count', coalesce(d.cnt, 0)) order by s.position),
    '[]'::jsonb
  ) into v_pipeline
  from public.pipeline_stages s
  left join (
    select stage_id, count(*) cnt
    from public.deals
    where organization_id = p_org and deleted_at is null and won_at is null and lost_at is null
    group by stage_id
  ) d on d.stage_id = s.id
  where s.organization_id = p_org and s.deleted_at is null and s.type = 'open';

  select coalesce(
    jsonb_agg(jsonb_build_object(
      'id', t.id, 'title', t.title, 'eventType', t.event_type,
      'module', t.module, 'createdAt', t.created_at
    ) order by t.created_at desc),
    '[]'::jsonb
  ) into v_activities
  from (
    select * from public.customer_timeline
    where organization_id = p_org and deleted_at is null
    order by created_at desc limit 8
  ) t;

  -- série de 7 dias: receita ganha (v) e novos leads (l) por dia
  with days as (
    select (current_date - (6 - g)) as d from generate_series(0, 6) g
  )
  select coalesce(
    jsonb_agg(jsonb_build_object(
      'date', days.d,
      'v', coalesce(rev.amount, 0),
      'l', coalesce(ld.cnt, 0)
    ) order by days.d),
    '[]'::jsonb
  ) into v_series
  from days
  left join (
    select date_trunc('day', won_at)::date d, sum(amount) amount
    from public.deals
    where organization_id = p_org and deleted_at is null and won_at >= current_date - 6
    group by 1
  ) rev on rev.d = days.d
  left join (
    select date_trunc('day', created_at)::date d, count(*) cnt
    from public.leads
    where organization_id = p_org and deleted_at is null and created_at >= current_date - 6
    group by 1
  ) ld on ld.d = days.d;

  return jsonb_build_object(
    'activeCustomers', v_active_customers,
    'revenueSeries', v_series,
    'leadsPeriod', v_leads_period,
    'openDeals', v_open_deals,
    'revenue', v_revenue,
    'wonCount', v_won_count,
    'avgTicket', case when v_won_count > 0 then (v_revenue / v_won_count) else 0 end,
    'conversionRate', case when v_leads_period > 0
      then round((v_leads_converted::numeric / v_leads_period) * 100, 1) else 0 end,
    'pipeline', v_pipeline,
    'recentActivities', v_activities
  );
end;
$$;

grant execute on function public.dashboard_metrics(uuid) to authenticated;

-- === 0030_crm_reports.sql ===
-- 0030_crm_reports.sql — Read model de Relatórios (agregações reais). Idempotente.
-- Uma RPC com as agregações dos gráficos. Preparada para a IA consumir os
-- mesmos números (mesma fonte da verdade). SECURITY DEFINER + checagem de membro.

create or replace function public.reports_metrics(p_org uuid)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_revenue_total bigint;
  v_won_count     int;
  v_trend         jsonb;
  v_funnel        jsonb;
  v_sources       jsonb;
begin
  if not public.is_org_member(p_org) then
    raise exception 'forbidden';
  end if;

  select coalesce(sum(amount), 0), count(*) into v_revenue_total, v_won_count
    from public.deals where organization_id = p_org and deleted_at is null and won_at is not null;

  -- Receita ganha por mês (12 meses)
  with months as (
    select date_trunc('month', current_date) - (interval '1 month' * (11 - g)) as m
    from generate_series(0, 11) g
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'm', to_char(months.m, 'Mon'),
    'v', coalesce(r.amount, 0)
  ) order by months.m), '[]'::jsonb) into v_trend
  from months
  left join (
    select date_trunc('month', won_at) m, sum(amount) amount
    from public.deals
    where organization_id = p_org and deleted_at is null and won_at is not null
    group by 1
  ) r on r.m = months.m;

  -- Funil: Leads → Qualificados → Convertidos → Negócios → Ganhos
  select jsonb_build_array(
    jsonb_build_object('s', 'Leads',        'v', (select count(*) from public.leads where organization_id = p_org and deleted_at is null)),
    jsonb_build_object('s', 'Qualificados', 'v', (select count(*) from public.leads where organization_id = p_org and deleted_at is null and qualified_at is not null)),
    jsonb_build_object('s', 'Convertidos',  'v', (select count(*) from public.leads where organization_id = p_org and deleted_at is null and status = 'converted')),
    jsonb_build_object('s', 'Negócios',     'v', (select count(*) from public.deals where organization_id = p_org and deleted_at is null)),
    jsonb_build_object('s', 'Ganhos',       'v', v_won_count)
  ) into v_funnel;

  -- Distribuição de leads por origem (top 5)
  select coalesce(jsonb_agg(jsonb_build_object('n', coalesce(src, 'Outros'), 'v', cnt) order by cnt desc), '[]'::jsonb)
    into v_sources
  from (
    select source src, count(*) cnt
    from public.leads
    where organization_id = p_org and deleted_at is null
    group by source
    order by cnt desc
    limit 5
  ) s;

  return jsonb_build_object(
    'revenueTotal', v_revenue_total,
    'wonCount', v_won_count,
    'avgTicket', case when v_won_count > 0 then (v_revenue_total / v_won_count) else 0 end,
    'revenueTrend', v_trend,
    'funnel', v_funnel,
    'sources', v_sources
  );
end;
$$;

grant execute on function public.reports_metrics(uuid) to authenticated;

-- === 0031_core_grants.sql ===
-- 0031_core_grants.sql — Grants ao papel service_role. Idempotente.
-- Descoberto na validação da F2.1: as migrations concediam privilégios a
-- `authenticated`, mas não a `service_role`. Os fluxos da app usam o papel
-- `authenticated` (JWT do usuário) e não eram afetados, porém o client admin
-- (src/server/supabase.ts · createSupabaseAdminClient) e jobs/webhooks (F3)
-- precisam disso. service_role ignora RLS, mas ainda exige GRANT.

grant usage on schema public to service_role;
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant execute on functions to service_role;

-- === 0032_platform_modules.sql ===
-- 0032_platform_modules.sql — Catálogo global de módulos instaláveis. Idempotente.
-- Sem organization_id (é catálogo compartilhado). `key` é o identificador lógico
-- único; as FKs usam `id` (uuid) para permitir renomear a key sem quebrar nada.

create table if not exists public.modules (
  id           uuid primary key default gen_random_uuid(),
  key          text not null unique,          -- identificador lógico (crm, whatsapp…)
  name         text not null,
  description  text not null default '',
  category     text not null default 'platform',
  is_core      boolean not null default false, -- core = sempre ativo p/ toda org
  icon         text,
  position     int not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
comment on table public.modules is 'Plataforma: catálogo global de módulos instaláveis.';

-- === 0033_platform_organization_modules.sql ===
-- 0033_platform_organization_modules.sql — Módulos contratados por organização. Idempotente.
-- Fonte da verdade do que cada empresa ativou. FK por module_id (uuid).

create table if not exists public.organization_modules (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  module_id        uuid not null references public.modules(id) on delete cascade,
  enabled          boolean not null default true,
  source           text not null default 'manual',  -- plan | manual | trial
  activated_at     timestamptz not null default now(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
comment on table public.organization_modules is 'Plataforma: ativação de módulos por organização (fonte da verdade).';
create unique index if not exists uq_org_modules on public.organization_modules(organization_id, module_id);
create index if not exists idx_org_modules_org on public.organization_modules(organization_id) where enabled;

-- === 0034_platform_module_configs.sql ===
-- 0034_platform_module_configs.sql — Configuração por módulo por organização. Idempotente.
-- Interface comum de config (jsonb) — evita condicionais espalhadas. Versionada
-- e auditável (schema_version, updated_by, validated_at).

create table if not exists public.module_configs (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  module_id        uuid not null references public.modules(id) on delete cascade,
  config           jsonb not null default '{}'::jsonb,
  schema_version   int not null default 1,
  updated_by       uuid references auth.users(id) on delete set null,
  validated_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
comment on table public.module_configs is 'Plataforma: configuração por módulo/org (schema comum, versionada).';
create unique index if not exists uq_module_configs on public.module_configs(organization_id, module_id);

-- === 0035_platform_jobs.sql ===
-- 0035_platform_jobs.sql — Fila de jobs (execução assíncrona genérica). Idempotente.
-- `type` (string) roteia — SEM lógica específica de módulo aqui. Preparado para
-- workers distribuídos: available_at + lease (lease_expires_at) + worker_version,
-- facilitando migrar depois para Redis/SQS/RabbitMQ/pg-boss sem mudar schema.

create table if not exists public.jobs (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid references public.organizations(id) on delete cascade,  -- null = job de sistema
  type              text not null,                       -- ex: whatsapp.send, automation.run
  payload           jsonb not null default '{}'::jsonb,
  status            text not null default 'queued'
                      check (status in ('queued','running','succeeded','failed','dead')),
  priority          int not null default 0,
  attempts          int not null default 0,
  max_attempts      int not null default 5,
  available_at      timestamptz not null default now(),  -- visível para claim a partir de
  locked_at         timestamptz,
  locked_by         text,                                -- id do worker
  lease_expires_at  timestamptz,                         -- reclaim se worker morrer
  worker_version    text,
  last_error        text,
  result            jsonb,
  trace_id          text,
  correlation_id    text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
comment on table public.jobs is 'Plataforma: fila de jobs assíncronos (genérica, lease-based).';
create index if not exists idx_jobs_claim on public.jobs(priority desc, available_at) where status = 'queued';
create index if not exists idx_jobs_lease on public.jobs(lease_expires_at) where status = 'running';
create index if not exists idx_jobs_org on public.jobs(organization_id, created_at desc);

-- === 0036_platform_job_dead_letter.sql ===
-- 0036_platform_job_dead_letter.sql — Dead Letter Queue. Idempotente.
-- Destino de jobs que esgotaram max_attempts. Append-only (sem updated_at).

create table if not exists public.job_dead_letter (
  id               uuid primary key default gen_random_uuid(),
  job_id           uuid,
  organization_id  uuid references public.organizations(id) on delete cascade,
  type             text not null,
  payload          jsonb not null default '{}'::jsonb,
  attempts         int not null default 0,
  last_error       text,
  failed_at        timestamptz not null default now(),
  created_at       timestamptz not null default now()
);
comment on table public.job_dead_letter is 'Plataforma: DLQ (jobs que falharam definitivamente).';
create index if not exists idx_dlq_org on public.job_dead_letter(organization_id, created_at desc);

-- === 0037_platform_job_schedules.sql ===
-- 0037_platform_job_schedules.sql — Scheduler (jobs recorrentes/agendados). Idempotente.
-- O scheduler (pg_cron + worker) enfileira um job quando next_run_at vence.

create table if not exists public.job_schedules (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid references public.organizations(id) on delete cascade,
  type              text not null,
  payload           jsonb not null default '{}'::jsonb,
  cron              text,            -- expressão cron (opcional)
  interval_seconds  int,             -- alternativa a cron
  next_run_at       timestamptz not null default now(),
  enabled           boolean not null default true,
  last_enqueued_at  timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
comment on table public.job_schedules is 'Plataforma: agendamentos recorrentes que enfileiram jobs.';
create index if not exists idx_schedules_due on public.job_schedules(next_run_at) where enabled;

-- === 0038_platform_quotas.sql ===
-- 0038_platform_quotas.sql — Limites por plano + uso por organização. Idempotente.
-- Enforcement centralizado no QuotaService (RPCs check_quota/consume_quota).

create table if not exists public.plan_limits (
  id           uuid primary key default gen_random_uuid(),
  plan_id      text not null,                 -- free | starter | pro | enterprise
  resource     text not null,                 -- customers | messages | ai_credits | storage_bytes | api_calls
  limit_value  bigint not null default -1,    -- -1 = ilimitado
  period       text not null default 'month' check (period in ('month','total')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
comment on table public.plan_limits is 'Plataforma: limites por plano (referência global).';
create unique index if not exists uq_plan_limits on public.plan_limits(plan_id, resource);

create table if not exists public.quota_usage (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  resource         text not null,
  period_key       text not null default 'total',   -- 'YYYY-MM' (mensal) ou 'total'
  used             bigint not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
comment on table public.quota_usage is 'Plataforma: uso corrente de recursos por organização.';
create unique index if not exists uq_quota_usage on public.quota_usage(organization_id, resource, period_key);

-- === 0039_platform_webhooks.sql ===
-- 0039_platform_webhooks.sql — Webhooks de saída + entregas. Idempotente.

create table if not exists public.webhooks (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  url              text not null,
  events           text[] not null default '{}',   -- nomes de eventos assinados
  secret           text,                            -- assinatura HMAC
  enabled          boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz
);
comment on table public.webhooks is 'Plataforma: endpoints de webhook (saída) por organização.';
create index if not exists idx_webhooks_org on public.webhooks(organization_id) where deleted_at is null;

create table if not exists public.webhook_deliveries (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  webhook_id       uuid not null references public.webhooks(id) on delete cascade,
  event            text not null,
  payload          jsonb not null default '{}'::jsonb,
  status           text not null default 'pending' check (status in ('pending','delivered','failed','dead')),
  attempts         int not null default 0,
  response_status  int,
  response_body    text,
  delivered_at     timestamptz,
  trace_id         text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
comment on table public.webhook_deliveries is 'Plataforma: tentativas de entrega de webhooks.';
create index if not exists idx_wh_deliveries_org on public.webhook_deliveries(organization_id, created_at desc);
create index if not exists idx_wh_deliveries_pending on public.webhook_deliveries(status) where status = 'pending';

-- === 0040_platform_operation_traces.sql ===
-- 0040_platform_operation_traces.sql — Observabilidade (traces de operações). Idempotente.
-- Store durável leve (append-only); o TracingProvider também exporta p/ OpenTelemetry.
-- Toda operação importante registra: trace_id, organization_id, correlation_id,
-- actor_id, operation, status, duration_ms.

create table if not exists public.operation_traces (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid references public.organizations(id) on delete cascade,
  trace_id         text not null,
  span_id          text,
  correlation_id   text,
  actor_id         uuid references auth.users(id) on delete set null,
  operation        text not null,
  status           text not null default 'success' check (status in ('success','error')),
  duration_ms      int,
  metadata         jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now()
);
comment on table public.operation_traces is 'Plataforma: observabilidade append-only (export futuro p/ OpenTelemetry).';
create index if not exists idx_traces_org on public.operation_traces(organization_id, created_at desc);
create index if not exists idx_traces_trace on public.operation_traces(trace_id);

-- === 0041_platform_market_templates.sql ===
-- 0041_platform_market_templates.sql — Templates de mercado (versionados). Idempotente.
-- Totalmente configuráveis via `definition jsonb` — nenhuma regra fixa no código.
-- Versionados: Clínica v1 → v2 → v3; orgs antigas permanecem na versão aplicada.

create table if not exists public.market_templates (
  id            uuid primary key default gen_random_uuid(),
  key           text not null,                 -- clinica, loja_virtual, oficina…
  version       int not null default 1,
  name          text not null,
  description   text not null default '',
  definition    jsonb not null default '{}'::jsonb,  -- default_modules[], pipelines[], custom_fields[], automations[], dashboard
  is_active     boolean not null default true,
  published_at  timestamptz,
  position      int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
comment on table public.market_templates is 'Plataforma: templates de mercado versionados (definição 100% em jsonb).';
create unique index if not exists uq_market_templates on public.market_templates(key, version);

alter table public.organizations
  add column if not exists market_template text,
  add column if not exists market_template_version int;

-- === 0042_platform_functions.sql ===
-- 0042_platform_functions.sql — RPCs da infraestrutura. Idempotente. SECURITY DEFINER.

-- ── Catálogo de módulos ──────────────────────────────────────────────────────
create or replace function public.has_module(p_org uuid, p_key text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.modules m
    where m.key = p_key and (
      m.is_core or exists (
        select 1 from public.organization_modules om
        where om.organization_id = p_org and om.module_id = m.id and om.enabled
      )
    )
  );
$$;

-- ── Queue ────────────────────────────────────────────────────────────────────
create or replace function public.enqueue_job(
  p_org uuid, p_type text, p_payload jsonb default '{}'::jsonb,
  p_available_at timestamptz default now(), p_priority int default 0,
  p_max_attempts int default 5, p_trace_id text default null, p_correlation_id text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  insert into public.jobs(organization_id, type, payload, available_at, priority, max_attempts, trace_id, correlation_id)
  values (p_org, p_type, coalesce(p_payload, '{}'::jsonb), coalesce(p_available_at, now()), p_priority, p_max_attempts, p_trace_id, p_correlation_id)
  returning id into v_id;
  return v_id;
end; $$;

-- Claim lease-based: pega jobs 'queued' vencidos OU 'running' com lease expirado
-- (reclaim de worker morto). FOR UPDATE SKIP LOCKED p/ concorrência.
create or replace function public.claim_jobs(p_worker text, p_limit int default 10, p_lease_seconds int default 60)
returns setof public.jobs language plpgsql security definer set search_path = public as $$
begin
  return query
  update public.jobs j set
    status = 'running', locked_at = now(), locked_by = p_worker,
    lease_expires_at = now() + make_interval(secs => p_lease_seconds),
    attempts = j.attempts + 1, updated_at = now()
  where j.id in (
    select id from public.jobs
    where (status = 'queued' and available_at <= now())
       or (status = 'running' and lease_expires_at < now())
    order by priority desc, available_at asc
    for update skip locked
    limit greatest(1, p_limit)
  )
  returning j.*;
end; $$;

create or replace function public.complete_job(p_id uuid, p_result jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = public as $$
  update public.jobs set status = 'succeeded', result = coalesce(p_result, '{}'::jsonb),
    locked_at = null, locked_by = null, lease_expires_at = null, updated_at = now()
  where id = p_id;
$$;

-- Falha: retry com backoff exponencial, ou DLQ ao esgotar max_attempts.
create or replace function public.fail_job(p_id uuid, p_error text)
returns text language plpgsql security definer set search_path = public as $$
declare j public.jobs;
begin
  select * into j from public.jobs where id = p_id;
  if j.id is null then return 'not_found'; end if;
  if j.attempts >= j.max_attempts then
    update public.jobs set status = 'dead', last_error = p_error,
      locked_at = null, locked_by = null, lease_expires_at = null, updated_at = now()
    where id = p_id;
    insert into public.job_dead_letter(job_id, organization_id, type, payload, attempts, last_error)
    values (j.id, j.organization_id, j.type, j.payload, j.attempts, p_error);
    return 'dead';
  end if;
  update public.jobs set status = 'queued', last_error = p_error,
    locked_at = null, locked_by = null, lease_expires_at = null,
    available_at = now() + make_interval(secs => least(3600, (power(2, j.attempts)::int) * 5)),
    updated_at = now()
  where id = p_id;
  return 'retry';
end; $$;

-- ── Quotas (QuotaService) ────────────────────────────────────────────────────
create or replace function public.check_quota(p_org uuid, p_resource text, p_amount bigint default 1)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare v_plan text; v_limit bigint; v_period text; v_key text; v_used bigint;
begin
  select plan_id into v_plan from public.organizations where id = p_org;
  select limit_value, period into v_limit, v_period
    from public.plan_limits where plan_id = coalesce(v_plan, 'free') and resource = p_resource;
  if v_limit is null or v_limit < 0 then return true; end if;   -- sem limite / ilimitado
  v_key := case when v_period = 'month' then to_char(now(), 'YYYY-MM') else 'total' end;
  select used into v_used from public.quota_usage
    where organization_id = p_org and resource = p_resource and period_key = v_key;
  return coalesce(v_used, 0) + p_amount <= v_limit;
end; $$;

create or replace function public.consume_quota(p_org uuid, p_resource text, p_amount bigint default 1)
returns void language plpgsql security definer set search_path = public as $$
declare v_plan text; v_period text; v_key text;
begin
  select plan_id into v_plan from public.organizations where id = p_org;
  select period into v_period from public.plan_limits where plan_id = coalesce(v_plan, 'free') and resource = p_resource;
  v_key := case when coalesce(v_period, 'month') = 'month' then to_char(now(), 'YYYY-MM') else 'total' end;
  insert into public.quota_usage(organization_id, resource, period_key, used)
  values (p_org, p_resource, v_key, p_amount)
  on conflict (organization_id, resource, period_key)
    do update set used = public.quota_usage.used + p_amount, updated_at = now();
end; $$;

-- ── Observabilidade ──────────────────────────────────────────────────────────
create or replace function public.write_trace(
  p_org uuid, p_trace_id text, p_operation text, p_status text default 'success',
  p_duration_ms int default null, p_correlation_id text default null,
  p_span_id text default null, p_metadata jsonb default '{}'::jsonb
) returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.operation_traces(organization_id, trace_id, span_id, correlation_id, actor_id, operation, status, duration_ms, metadata)
  values (p_org, p_trace_id, p_span_id, p_correlation_id, auth.uid(), p_operation, p_status, p_duration_ms, coalesce(p_metadata, '{}'::jsonb));
end; $$;

-- ── Webhooks (dispatch a partir do outbox do Event Bus) ──────────────────────
create or replace function public.dispatch_webhooks(p_org uuid, p_event text, p_payload jsonb default '{}'::jsonb)
returns int language plpgsql security definer set search_path = public as $$
declare w record; n int := 0;
begin
  for w in select id from public.webhooks
    where organization_id = p_org and enabled and deleted_at is null and p_event = any(events)
  loop
    insert into public.webhook_deliveries(organization_id, webhook_id, event, payload)
    values (p_org, w.id, p_event, coalesce(p_payload, '{}'::jsonb));
    n := n + 1;
  end loop;
  return n;
end; $$;

-- ── Market Templates (aplicação 100% data-driven) ───────────────────────────
create or replace function public.apply_market_template(p_org uuid, p_key text)
returns void language plpgsql security definer set search_path = public as $$
declare v_tpl public.market_templates; v_def jsonb; v_pipe jsonb; v_pipeline_id uuid; v_stage jsonb; v_field jsonb; v_pos int;
begin
  if not public.is_org_member(p_org) then raise exception 'forbidden'; end if;
  select * into v_tpl from public.market_templates
    where key = p_key and is_active order by version desc limit 1;
  if v_tpl.id is null then raise exception 'template not found: %', p_key; end if;
  v_def := v_tpl.definition;

  update public.organizations
    set market_template = p_key, market_template_version = v_tpl.version where id = p_org;

  for v_pipe in select value from jsonb_array_elements(coalesce(v_def -> 'pipelines', '[]'::jsonb)) loop
    insert into public.pipelines(organization_id, name, is_default, position, color)
    values (p_org, v_pipe ->> 'name', coalesce((v_pipe ->> 'is_default')::boolean, false),
            coalesce((v_pipe ->> 'position')::int, 0), coalesce(v_pipe ->> 'color', '#2563EB'))
    returning id into v_pipeline_id;
    v_pos := 0;
    for v_stage in select value from jsonb_array_elements(coalesce(v_pipe -> 'stages', '[]'::jsonb)) loop
      insert into public.pipeline_stages(organization_id, pipeline_id, name, position, type, probability)
      values (p_org, v_pipeline_id, v_stage ->> 'name', v_pos,
              coalesce(v_stage ->> 'type', 'open'), coalesce((v_stage ->> 'probability')::int, 0));
      v_pos := v_pos + 1;
    end loop;
  end loop;

  for v_field in select value from jsonb_array_elements(coalesce(v_def -> 'customer_custom_fields', '[]'::jsonb)) loop
    insert into public.customer_custom_fields(organization_id, key, label, field_type, position)
    values (p_org, v_field ->> 'key', v_field ->> 'label', coalesce(v_field ->> 'field_type', 'text'),
            coalesce((v_field ->> 'position')::int, 0))
    on conflict (organization_id, key) do nothing;
  end loop;

  perform public.write_audit(p_org, 'organization.template.applied', 'market_template', v_tpl.id,
    jsonb_build_object('key', p_key, 'version', v_tpl.version));
end; $$;

-- ── Grants de execução ───────────────────────────────────────────────────────
grant execute on function public.has_module(uuid, text) to authenticated;
grant execute on function public.enqueue_job(uuid, text, jsonb, timestamptz, int, int, text, text) to authenticated, service_role;
grant execute on function public.check_quota(uuid, text, bigint) to authenticated, service_role;
grant execute on function public.consume_quota(uuid, text, bigint) to authenticated, service_role;
grant execute on function public.write_trace(uuid, text, text, text, int, text, text, jsonb) to authenticated, service_role;
grant execute on function public.apply_market_template(uuid, text) to authenticated;
-- Worker-only (service_role): claim/complete/fail e dispatch de webhooks.
grant execute on function public.claim_jobs(text, int, int) to service_role;
grant execute on function public.complete_job(uuid, jsonb) to service_role;
grant execute on function public.fail_job(uuid, text) to service_role;
grant execute on function public.dispatch_webhooks(uuid, text, jsonb) to service_role;

-- === 0043_platform_seed.sql ===
-- 0043_platform_seed.sql — Seeds da plataforma. Idempotente (ON CONFLICT).

-- ── Catálogo de módulos ──────────────────────────────────────────────────────
insert into public.modules(key, name, category, is_core, position) values
  ('dashboard',     'Dashboard',     'core',           true,  0),
  ('clientes',      'Clientes',      'sales',          false, 1),
  ('crm',           'CRM',           'sales',          false, 2),
  ('whatsapp',      'WhatsApp',      'communication',  false, 3),
  ('automacoes',    'Automações',    'automation',     false, 4),
  ('ia',            'IA',            'intelligence',   false, 5),
  ('relatorios',    'Relatórios',    'sales',          false, 6),
  ('agenda',        'Agenda',        'productivity',   false, 7),
  ('financeiro',    'Financeiro',    'finance',        false, 8),
  ('marketing',     'Marketing',     'communication',  false, 9),
  ('api_publica',   'API Pública',   'platform',       false, 10),
  ('marketplace',   'Marketplace',   'platform',       false, 11),
  ('configuracoes', 'Configurações', 'core',           true,  12),
  ('billing',       'Cobrança',      'billing',        true,  13)
on conflict (key) do update set name = excluded.name, category = excluded.category, is_core = excluded.is_core;

-- ── Limites por plano (period: month, exceto customers/storage = total) ──────
insert into public.plan_limits(plan_id, resource, limit_value, period) values
  ('free','customers',500,'total'), ('free','messages',1000,'month'), ('free','ai_credits',1000,'month'), ('free','storage_bytes',1073741824,'total'), ('free','api_calls',1000,'month'),
  ('starter','customers',5000,'total'), ('starter','messages',20000,'month'), ('starter','ai_credits',20000,'month'), ('starter','storage_bytes',10737418240,'total'), ('starter','api_calls',50000,'month'),
  ('pro','customers',50000,'total'), ('pro','messages',200000,'month'), ('pro','ai_credits',150000,'month'), ('pro','storage_bytes',107374182400,'total'), ('pro','api_calls',500000,'month'),
  ('enterprise','customers',-1,'total'), ('enterprise','messages',-1,'month'), ('enterprise','ai_credits',-1,'month'), ('enterprise','storage_bytes',-1,'total'), ('enterprise','api_calls',-1,'month')
on conflict (plan_id, resource) do update set limit_value = excluded.limit_value, period = excluded.period;

-- ── Permissões novas + mapeamento (owner/admin) ──────────────────────────────
insert into public.permissions(key, module, description) values
  ('modules.manage',     'configuracoes', 'Ativar/desativar módulos da organização'),
  ('webhooks.manage',    'api_publica',   'Gerenciar webhooks'),
  ('observability.read', 'core',          'Ver traces/observabilidade')
on conflict (key) do update set module = excluded.module, description = excluded.description;

insert into public.role_permissions(role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.organization_id is null and r.key in ('owner','admin')
  and p.key in ('modules.manage','webhooks.manage','observability.read')
on conflict do nothing;

-- ── Market Templates (v1, definição 100% em jsonb) ───────────────────────────
insert into public.market_templates(key, version, name, description, definition, published_at, position) values
  ('generico', 1, 'Genérico', 'Funil comercial padrão', jsonb_build_object(
    'default_modules', jsonb_build_array('crm','clientes','whatsapp'),
    'pipelines', jsonb_build_array(jsonb_build_object('name','Comercial','is_default',true,'stages',
      jsonb_build_array(
        jsonb_build_object('name','Lead','type','open','probability',10),
        jsonb_build_object('name','Qualificado','type','open','probability',30),
        jsonb_build_object('name','Proposta','type','open','probability',60),
        jsonb_build_object('name','Negociação','type','open','probability',80),
        jsonb_build_object('name','Ganho','type','won','probability',100),
        jsonb_build_object('name','Perdido','type','lost','probability',0))))
  ), now(), 0),
  ('clinica', 1, 'Clínica', 'Gestão de pacientes e atendimentos', jsonb_build_object(
    'default_modules', jsonb_build_array('crm','clientes','agenda','whatsapp'),
    'pipelines', jsonb_build_array(jsonb_build_object('name','Atendimentos','is_default',true,'stages',
      jsonb_build_array(
        jsonb_build_object('name','Agendado','type','open','probability',30),
        jsonb_build_object('name','Em atendimento','type','open','probability',60),
        jsonb_build_object('name','Concluído','type','won','probability',100),
        jsonb_build_object('name','Faltou','type','lost','probability',0)))),
    'customer_custom_fields', jsonb_build_array(
      jsonb_build_object('key','convenio','label','Convênio','field_type','text'),
      jsonb_build_object('key','cpf','label','CPF','field_type','text'))
  ), now(), 1),
  ('loja_virtual', 1, 'Loja Virtual', 'Pedidos e pós-venda', jsonb_build_object(
    'default_modules', jsonb_build_array('crm','clientes','marketing','whatsapp'),
    'pipelines', jsonb_build_array(jsonb_build_object('name','Pedidos','is_default',true,'stages',
      jsonb_build_array(
        jsonb_build_object('name','Novo','type','open','probability',20),
        jsonb_build_object('name','Pago','type','open','probability',60),
        jsonb_build_object('name','Enviado','type','open','probability',80),
        jsonb_build_object('name','Entregue','type','won','probability',100),
        jsonb_build_object('name','Cancelado','type','lost','probability',0))))
  ), now(), 2),
  ('oficina', 1, 'Oficina', 'Ordens de serviço', jsonb_build_object(
    'default_modules', jsonb_build_array('crm','clientes','agenda'),
    'pipelines', jsonb_build_array(jsonb_build_object('name','Ordens de Serviço','is_default',true,'stages',
      jsonb_build_array(
        jsonb_build_object('name','Orçamento','type','open','probability',20),
        jsonb_build_object('name','Aprovado','type','open','probability',50),
        jsonb_build_object('name','Em execução','type','open','probability',75),
        jsonb_build_object('name','Pronto','type','open','probability',90),
        jsonb_build_object('name','Entregue','type','won','probability',100))))
  ), now(), 3),
  ('imobiliaria', 1, 'Imobiliária', 'Negociações de imóveis', jsonb_build_object(
    'default_modules', jsonb_build_array('crm','clientes','whatsapp','agenda'),
    'pipelines', jsonb_build_array(jsonb_build_object('name','Negociações','is_default',true,'stages',
      jsonb_build_array(
        jsonb_build_object('name','Visita','type','open','probability',25),
        jsonb_build_object('name','Proposta','type','open','probability',55),
        jsonb_build_object('name','Contrato','type','open','probability',85),
        jsonb_build_object('name','Fechado','type','won','probability',100),
        jsonb_build_object('name','Perdido','type','lost','probability',0))))
  ), now(), 4),
  ('restaurante', 1, 'Restaurante', 'Reservas e fidelização', jsonb_build_object(
    'default_modules', jsonb_build_array('clientes','marketing','whatsapp'),
    'pipelines', jsonb_build_array(jsonb_build_object('name','Reservas','is_default',true,'stages',
      jsonb_build_array(
        jsonb_build_object('name','Solicitada','type','open','probability',40),
        jsonb_build_object('name','Confirmada','type','open','probability',80),
        jsonb_build_object('name','Atendida','type','won','probability',100),
        jsonb_build_object('name','No-show','type','lost','probability',0))))
  ), now(), 5),
  ('prestador_servicos', 1, 'Prestador de Serviços', 'Projetos e propostas', jsonb_build_object(
    'default_modules', jsonb_build_array('crm','clientes','agenda','financeiro'),
    'pipelines', jsonb_build_array(jsonb_build_object('name','Projetos','is_default',true,'stages',
      jsonb_build_array(
        jsonb_build_object('name','Lead','type','open','probability',15),
        jsonb_build_object('name','Proposta','type','open','probability',50),
        jsonb_build_object('name','Contratado','type','open','probability',85),
        jsonb_build_object('name','Entregue','type','won','probability',100),
        jsonb_build_object('name','Perdido','type','lost','probability',0))))
  ), now(), 6)
on conflict (key, version) do update set name = excluded.name, definition = excluded.definition, published_at = excluded.published_at;

-- === 0044_platform_policies.sql ===
-- 0044_platform_policies.sql — RLS + grants da infraestrutura. Idempotente.

-- Grants (idempotente; RLS ainda gateia as linhas).
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant all privileges on all tables in schema public to service_role;

-- ── Catálogos globais: leitura para autenticados, sem escrita pelo cliente ────
do $$
declare t text;
begin
  foreach t in array array['modules','plan_limits','market_templates'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('create policy %I on public.%I for select to authenticated using (true)', t || '_select', t);
  end loop;
end $$;

-- ── Tabelas por org gateadas por permissão (read_perm / write_perm) ──────────
do $$
declare rec record;
begin
  for rec in
    select * from (values
      ('organization_modules', 'is_org_member',       'modules.manage'),
      ('module_configs',       'is_org_member',       'configuracoes.manage'),
      ('job_schedules',        'is_org_member',       'modules.manage'),
      ('webhooks',             'webhooks.manage',     'webhooks.manage')
    ) as t(tbl, read_expr, write_perm)
  loop
    execute format('alter table public.%I enable row level security', rec.tbl);
    execute format('drop policy if exists %I on public.%I', rec.tbl || '_select', rec.tbl);
    if rec.read_expr = 'is_org_member' then
      execute format('create policy %I on public.%I for select to authenticated using (public.is_org_member(organization_id))', rec.tbl || '_select', rec.tbl);
    else
      execute format('create policy %I on public.%I for select to authenticated using (public.has_permission(organization_id, %L))', rec.tbl || '_select', rec.tbl, rec.read_expr);
    end if;
    execute format('drop policy if exists %I on public.%I', rec.tbl || '_write', rec.tbl);
    execute format('create policy %I on public.%I for all to authenticated using (public.has_permission(organization_id, %L)) with check (public.has_permission(organization_id, %L))', rec.tbl || '_write', rec.tbl, rec.write_perm, rec.write_perm);
  end loop;
end $$;

-- ── Somente leitura por membro; escrita apenas via RPCs SECURITY DEFINER ─────
do $$
declare t text;
begin
  foreach t in array array['jobs','job_dead_letter','quota_usage','webhook_deliveries'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.is_org_member(organization_id))', t || '_select', t);
  end loop;
end $$;

-- ── operation_traces: leitura por observability.read; escrita via definer ────
alter table public.operation_traces enable row level security;
drop policy if exists operation_traces_select on public.operation_traces;
create policy operation_traces_select on public.operation_traces for select to authenticated
  using (organization_id is not null and public.has_permission(organization_id, 'observability.read'));

-- === 0045_platform_triggers.sql ===
-- 0045_platform_triggers.sql — updated_at + auditoria automática. Idempotente.

-- updated_at em todas as tabelas da F3.0 que têm a coluna.
do $$
declare t text;
begin
  foreach t in array array[
    'modules','organization_modules','module_configs','jobs','job_schedules',
    'plan_limits','quota_usage','webhooks','webhook_deliveries','market_templates'
  ] loop
    execute format('drop trigger if exists trg_%1$s_updated_at on public.%1$s', t);
    execute format('create trigger trg_%1$s_updated_at before update on public.%1$s for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- Auditoria automática nas tabelas de gestão com organization_id (evita ruído
-- em jobs/quota/traces/deliveries de alta frequência).
do $$
declare t text;
begin
  foreach t in array array['organization_modules','module_configs','webhooks'] loop
    execute format('drop trigger if exists trg_%1$s_audit on public.%1$s', t);
    execute format('create trigger trg_%1$s_audit after insert or update or delete on public.%1$s for each row execute function public.audit_row_change()', t);
  end loop;
end $$;

-- === 0046_hardening_guards.sql ===
-- 0046_hardening_guards.sql — C1 (guard multi-tenant) + M1 (template idempotente). Idempotente.
-- Guard: usuário autenticado só opera na própria org; service_role (auth.uid()=null) passa.

create or replace function public.check_quota(p_org uuid, p_resource text, p_amount bigint default 1)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare v_plan text; v_limit bigint; v_period text; v_key text; v_used bigint;
begin
  if auth.uid() is not null and not public.is_org_member(p_org) then raise exception 'forbidden'; end if;
  select plan_id into v_plan from public.organizations where id = p_org;
  select limit_value, period into v_limit, v_period from public.plan_limits where plan_id = coalesce(v_plan, 'free') and resource = p_resource;
  if v_limit is null or v_limit < 0 then return true; end if;
  v_key := case when v_period = 'month' then to_char(now(), 'YYYY-MM') else 'total' end;
  select used into v_used from public.quota_usage where organization_id = p_org and resource = p_resource and period_key = v_key;
  return coalesce(v_used, 0) + p_amount <= v_limit;
end; $$;

create or replace function public.consume_quota(p_org uuid, p_resource text, p_amount bigint default 1)
returns void language plpgsql security definer set search_path = public as $$
declare v_plan text; v_period text; v_key text;
begin
  if auth.uid() is not null and not public.is_org_member(p_org) then raise exception 'forbidden'; end if;
  select plan_id into v_plan from public.organizations where id = p_org;
  select period into v_period from public.plan_limits where plan_id = coalesce(v_plan, 'free') and resource = p_resource;
  v_key := case when coalesce(v_period, 'month') = 'month' then to_char(now(), 'YYYY-MM') else 'total' end;
  insert into public.quota_usage(organization_id, resource, period_key, used) values (p_org, p_resource, v_key, p_amount)
  on conflict (organization_id, resource, period_key) do update set used = public.quota_usage.used + p_amount, updated_at = now();
end; $$;

create or replace function public.write_trace(
  p_org uuid, p_trace_id text, p_operation text, p_status text default 'success',
  p_duration_ms int default null, p_correlation_id text default null,
  p_span_id text default null, p_metadata jsonb default '{}'::jsonb
) returns void language plpgsql security definer set search_path = public as $$
begin
  if p_org is not null and auth.uid() is not null and not public.is_org_member(p_org) then raise exception 'forbidden'; end if;
  insert into public.operation_traces(organization_id, trace_id, span_id, correlation_id, actor_id, operation, status, duration_ms, metadata)
  values (p_org, p_trace_id, p_span_id, p_correlation_id, auth.uid(), p_operation, p_status, p_duration_ms, coalesce(p_metadata, '{}'::jsonb));
end; $$;

-- M1: apply_market_template idempotente (aplica só uma vez por org).
create or replace function public.apply_market_template(p_org uuid, p_key text)
returns void language plpgsql security definer set search_path = public as $$
declare v_tpl public.market_templates; v_def jsonb; v_pipe jsonb; v_pipeline_id uuid; v_stage jsonb; v_field jsonb; v_pos int;
begin
  if not public.is_org_member(p_org) then raise exception 'forbidden'; end if;
  if (select market_template from public.organizations where id = p_org) is not null then return; end if;  -- idempotente
  select * into v_tpl from public.market_templates where key = p_key and is_active order by version desc limit 1;
  if v_tpl.id is null then raise exception 'template not found: %', p_key; end if;
  v_def := v_tpl.definition;

  update public.organizations set market_template = p_key, market_template_version = v_tpl.version where id = p_org;

  for v_pipe in select value from jsonb_array_elements(coalesce(v_def -> 'pipelines', '[]'::jsonb)) loop
    insert into public.pipelines(organization_id, name, is_default, position, color)
    values (p_org, v_pipe ->> 'name', coalesce((v_pipe ->> 'is_default')::boolean, false),
            coalesce((v_pipe ->> 'position')::int, 0), coalesce(v_pipe ->> 'color', '#2563EB'))
    returning id into v_pipeline_id;
    v_pos := 0;
    for v_stage in select value from jsonb_array_elements(coalesce(v_pipe -> 'stages', '[]'::jsonb)) loop
      insert into public.pipeline_stages(organization_id, pipeline_id, name, position, type, probability)
      values (p_org, v_pipeline_id, v_stage ->> 'name', v_pos, coalesce(v_stage ->> 'type', 'open'), coalesce((v_stage ->> 'probability')::int, 0));
      v_pos := v_pos + 1;
    end loop;
  end loop;

  for v_field in select value from jsonb_array_elements(coalesce(v_def -> 'customer_custom_fields', '[]'::jsonb)) loop
    insert into public.customer_custom_fields(organization_id, key, label, field_type, position)
    values (p_org, v_field ->> 'key', v_field ->> 'label', coalesce(v_field ->> 'field_type', 'text'), coalesce((v_field ->> 'position')::int, 0))
    on conflict (organization_id, key) do nothing;
  end loop;

  perform public.write_audit(p_org, 'organization.template.applied', 'market_template', v_tpl.id,
    jsonb_build_object('key', p_key, 'version', v_tpl.version));
end; $$;

-- === 0047_hardening_quota_atomic.sql ===
-- 0047_hardening_quota_atomic.sql — C2: consumo de cota atômico (sem race). Idempotente.
-- Verifica + incrementa em uma transação com lock de linha (FOR UPDATE).

create or replace function public.try_consume_quota(p_org uuid, p_resource text, p_amount bigint default 1)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_plan text; v_limit bigint; v_period text; v_key text; v_used bigint;
begin
  if auth.uid() is not null and not public.is_org_member(p_org) then raise exception 'forbidden'; end if;

  select plan_id into v_plan from public.organizations where id = p_org;
  select limit_value, period into v_limit, v_period
    from public.plan_limits where plan_id = coalesce(v_plan, 'free') and resource = p_resource;
  v_key := case when coalesce(v_period, 'month') = 'month' then to_char(now(), 'YYYY-MM') else 'total' end;

  -- garante a linha, então trava para serializar consumidores concorrentes
  insert into public.quota_usage(organization_id, resource, period_key, used)
  values (p_org, p_resource, v_key, 0)
  on conflict (organization_id, resource, period_key) do nothing;

  select used into v_used from public.quota_usage
    where organization_id = p_org and resource = p_resource and period_key = v_key
    for update;

  if v_limit is not null and v_limit >= 0 and v_used + p_amount > v_limit then
    return false;  -- não cabe
  end if;

  update public.quota_usage set used = v_used + p_amount, updated_at = now()
    where organization_id = p_org and resource = p_resource and period_key = v_key;
  return true;
end; $$;

grant execute on function public.try_consume_quota(uuid, text, bigint) to authenticated, service_role;

-- === 0048_hardening_infra.sql ===
-- 0048_hardening_infra.sql — C3 (job_types), H3 (idempotência + payload_version), H1 (domain_events). Idempotente.

-- ── C3: catálogo de tipos de job permitidos ──────────────────────────────────
create table if not exists public.job_types (
  key          text primary key,
  module       text not null default 'core',
  description  text not null default '',
  enabled      boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
comment on table public.job_types is 'Plataforma: allowlist de tipos de job (cada módulo registra os seus).';
insert into public.job_types(key, module, description) values
  ('outbox.relay', 'core', 'Relay do outbox → webhooks/reações'),
  ('noop',         'core', 'Job de teste')
on conflict (key) do update set module = excluded.module, description = excluded.description;

-- ── H3: chaves de idempotência (dedup de execução) ───────────────────────────
create table if not exists public.idempotency_keys (
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  key              text not null,
  created_at       timestamptz not null default now(),
  primary key (organization_id, key)
);
comment on table public.idempotency_keys is 'Plataforma: garante execução única por chave (handlers idempotentes).';

-- ── H3/versionamento: jobs.payload_version + idempotency_key ─────────────────
alter table public.jobs
  add column if not exists payload_version int not null default 1,
  add column if not exists idempotency_key text;
create unique index if not exists uq_jobs_idempotency
  on public.jobs(organization_id, type, idempotency_key) where idempotency_key is not null;

-- ── H1: outbox de eventos de domínio (Event Bus durável) ─────────────────────
create table if not exists public.domain_events (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  name             text not null,
  payload          jsonb not null default '{}'::jsonb,
  payload_version  int not null default 1,
  status           text not null default 'queued' check (status in ('queued','processing','done','failed')),
  attempts         int not null default 0,
  trace_id         text,
  correlation_id   text,
  occurred_at      timestamptz not null default now(),
  processed_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
comment on table public.domain_events is 'Plataforma: outbox transacional de eventos (Event Bus durável).';
create index if not exists idx_domain_events_org on public.domain_events(organization_id, occurred_at desc);
create index if not exists idx_domain_events_open on public.domain_events(status) where status <> 'done';

-- === 0049_hardening_enqueue_events.sql ===
-- 0049_hardening_enqueue_events.sql — enqueue consolidado + idempotência + outbox RPCs. Idempotente.

-- Remove a versão antiga (8 args) para evitar overload ambíguo.
drop function if exists public.enqueue_job(uuid, text, jsonb, timestamptz, int, int, text, text);

-- enqueue_job: guard (C1) + allowlist (C3) + dedup por idempotency_key (H3) + payload_version.
create or replace function public.enqueue_job(
  p_org uuid, p_type text, p_payload jsonb default '{}'::jsonb,
  p_available_at timestamptz default now(), p_priority int default 0,
  p_max_attempts int default 5, p_trace_id text default null, p_correlation_id text default null,
  p_idempotency_key text default null, p_payload_version int default 1
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_existing uuid;
begin
  if auth.uid() is not null and p_org is not null and not public.is_org_member(p_org) then raise exception 'forbidden'; end if;
  if not exists (select 1 from public.job_types where key = p_type and enabled) then
    raise exception 'unknown job type: %', p_type;
  end if;
  if p_idempotency_key is not null then
    select id into v_existing from public.jobs
      where organization_id = p_org and type = p_type and idempotency_key = p_idempotency_key limit 1;
    if v_existing is not null then return v_existing; end if;   -- dedup de enqueue
  end if;
  insert into public.jobs(organization_id, type, payload, payload_version, available_at, priority, max_attempts, trace_id, correlation_id, idempotency_key)
  values (p_org, p_type, coalesce(p_payload, '{}'::jsonb), coalesce(p_payload_version, 1), coalesce(p_available_at, now()),
          p_priority, p_max_attempts, p_trace_id, p_correlation_id, p_idempotency_key)
  returning id into v_id;
  return v_id;
end; $$;
grant execute on function public.enqueue_job(uuid, text, jsonb, timestamptz, int, int, text, text, text, int) to authenticated, service_role;

-- Idempotência de execução: adquire uma chave (true) ou já usada (false).
create or replace function public.claim_idempotency(p_org uuid, p_key text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_org_member(p_org) then raise exception 'forbidden'; end if;
  insert into public.idempotency_keys(organization_id, key) values (p_org, p_key) on conflict do nothing;
  return found;
end; $$;
grant execute on function public.claim_idempotency(uuid, text) to authenticated, service_role;

-- H1: publica evento no outbox e enfileira o relay (via Queue). Dedup do relay.
create or replace function public.publish_event(
  p_org uuid, p_name text, p_payload jsonb default '{}'::jsonb, p_payload_version int default 1, p_trace_id text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is not null and not public.is_org_member(p_org) then raise exception 'forbidden'; end if;
  insert into public.domain_events(organization_id, name, payload, payload_version, trace_id)
  values (p_org, p_name, coalesce(p_payload, '{}'::jsonb), coalesce(p_payload_version, 1), p_trace_id)
  returning id into v_id;
  perform public.enqueue_job(p_org, 'outbox.relay', jsonb_build_object('event_id', v_id), now(), 0, 5, p_trace_id, null,
                             'outbox.relay:' || v_id::text, 1);
  return v_id;
end; $$;
grant execute on function public.publish_event(uuid, text, jsonb, int, text) to authenticated, service_role;

-- Relay (worker): faz fan-out para webhooks e marca o evento processado.
create or replace function public.relay_domain_event(p_event_id uuid)
returns int language plpgsql security definer set search_path = public as $$
declare e public.domain_events; n int;
begin
  select * into e from public.domain_events where id = p_event_id;
  if e.id is null then return 0; end if;
  n := public.dispatch_webhooks(e.organization_id, e.name, e.payload);
  update public.domain_events set status = 'done', processed_at = now(), updated_at = now() where id = p_event_id;
  return n;
end; $$;
grant execute on function public.relay_domain_event(uuid) to service_role;

-- === 0050_hardening_dlq_manual.sql ===
-- 0050_hardening_dlq_manual.sql — DLQ manual (reprocessar/descartar) + permissão. Idempotente.
-- Base para a futura tela Configurações → Jobs (Reprocessar · Ignorar · Ver erro).

insert into public.permissions(key, module, description) values
  ('jobs.manage', 'configuracoes', 'Reprocessar/descartar jobs (Dead Letter Queue)')
on conflict (key) do update set description = excluded.description;

insert into public.role_permissions(role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.organization_id is null and r.key in ('owner','admin') and p.key = 'jobs.manage'
on conflict do nothing;

-- Reprocessar: reenfileira o job a partir da DLQ e remove o registro.
create or replace function public.retry_dead_letter(p_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare d public.job_dead_letter; v_id uuid;
begin
  select * into d from public.job_dead_letter where id = p_id;
  if d.id is null then raise exception 'not found'; end if;
  if d.organization_id is not null and not public.has_permission(d.organization_id, 'jobs.manage') then raise exception 'forbidden'; end if;
  v_id := public.enqueue_job(d.organization_id, d.type, d.payload, now(), 0, 5, null, null, null, 1);
  delete from public.job_dead_letter where id = p_id;
  return v_id;
end; $$;
grant execute on function public.retry_dead_letter(uuid) to authenticated;

-- Descartar: remove o registro da DLQ.
create or replace function public.discard_dead_letter(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare d public.job_dead_letter;
begin
  select * into d from public.job_dead_letter where id = p_id;
  if d.id is null then return; end if;
  if d.organization_id is not null and not public.has_permission(d.organization_id, 'jobs.manage') then raise exception 'forbidden'; end if;
  delete from public.job_dead_letter where id = p_id;
end; $$;
grant execute on function public.discard_dead_letter(uuid) to authenticated;

-- === 0051_hardening_policies.sql ===
-- 0051_hardening_policies.sql — RLS + grants + triggers das novas tabelas. Idempotente.

grant select, insert, update, delete on all tables in schema public to authenticated;
grant all privileges on all tables in schema public to service_role;

-- job_types: catálogo global (leitura para autenticados).
alter table public.job_types enable row level security;
drop policy if exists job_types_select on public.job_types;
create policy job_types_select on public.job_types for select to authenticated using (true);

-- domain_events: leitura por membro; escrita só via RPC definer.
alter table public.domain_events enable row level security;
drop policy if exists domain_events_select on public.domain_events;
create policy domain_events_select on public.domain_events for select to authenticated
  using (public.is_org_member(organization_id));

-- idempotency_keys: leitura por membro; escrita só via RPC definer.
alter table public.idempotency_keys enable row level security;
drop policy if exists idem_keys_select on public.idempotency_keys;
create policy idem_keys_select on public.idempotency_keys for select to authenticated
  using (public.is_org_member(organization_id));

-- updated_at triggers.
do $$
declare t text;
begin
  foreach t in array array['job_types','domain_events'] loop
    execute format('drop trigger if exists trg_%1$s_updated_at on public.%1$s', t);
    execute format('create trigger trg_%1$s_updated_at before update on public.%1$s for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- === 0052_whatsapp_schema.sql ===
-- 0052_whatsapp_schema.sql — Módulo F3.1 · WhatsApp Cloud API. Idempotente.
-- Modelo de dados do módulo WhatsApp: conta (WABA) + números, templates, mídia,
-- conversas, mensagens, eventos de status e envelopes de webhook.
-- Multi-tenant por organization_id; RLS em 0055; RPCs em 0053; seeds em 0054.
--
-- SEGURANÇA: o access token da Meta NÃO fica em whatsapp_accounts (que membros
-- podem ler). Fica em whatsapp_credentials, sem policy de select p/ authenticated
-- (só service_role — worker/webhook). Assim o token nunca chega ao cliente.

-- ── Conta WhatsApp Business (WABA) ───────────────────────────────────────────
create table if not exists public.whatsapp_accounts (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  provider         text not null default 'meta' check (provider in ('meta','evolution')),
  waba_id          text,                                    -- WhatsApp Business Account ID (Meta)
  business_id      text,                                    -- Meta Business Manager ID
  name             text,
  status           text not null default 'connected'
                     check (status in ('connected','disconnected','error','pending')),
  webhook_verify_token text,                                -- verificação do webhook (por org)
  connected_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz
);
comment on table public.whatsapp_accounts is 'F3.1: conta WABA por organização. Token fica em whatsapp_credentials.';
create index if not exists idx_wa_accounts_org on public.whatsapp_accounts(organization_id) where deleted_at is null;
create unique index if not exists uq_wa_accounts_waba on public.whatsapp_accounts(organization_id, waba_id) where waba_id is not null;

-- ── Credenciais (segredo) — só service_role lê (sem policy select p/ authenticated)
create table if not exists public.whatsapp_credentials (
  account_id       uuid primary key references public.whatsapp_accounts(id) on delete cascade,
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  access_token     text,                                    -- System User token (Meta). Sensível.
  app_secret       text,
  rotated_at       timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
comment on table public.whatsapp_credentials is 'F3.1: segredos da conta WhatsApp. Sem policy de SELECT p/ authenticated — só service_role.';
create index if not exists idx_wa_credentials_org on public.whatsapp_credentials(organization_id);

-- ── Números de telefone sob a WABA ───────────────────────────────────────────
create table if not exists public.whatsapp_phone_numbers (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references public.organizations(id) on delete cascade,
  account_id            uuid not null references public.whatsapp_accounts(id) on delete cascade,
  phone_number_id       text not null,                      -- Phone Number ID (Meta)
  display_phone_number  text,                               -- +55 11 9....
  verified_name         text,
  quality_rating        text,                               -- GREEN/YELLOW/RED
  status                text not null default 'active'
                          check (status in ('active','inactive','flagged','pending')),
  is_default            boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index if not exists idx_wa_numbers_org on public.whatsapp_phone_numbers(organization_id);
create index if not exists idx_wa_numbers_account on public.whatsapp_phone_numbers(account_id);
create unique index if not exists uq_wa_numbers_pnid on public.whatsapp_phone_numbers(organization_id, phone_number_id);

-- ── Templates (definição data-driven em jsonb) ───────────────────────────────
create table if not exists public.whatsapp_templates (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  account_id       uuid references public.whatsapp_accounts(id) on delete set null,
  external_id      text,                                    -- ID do template na Meta
  name             text not null,
  language         text not null default 'pt_BR',
  category         text not null default 'UTILITY'
                     check (category in ('MARKETING','UTILITY','AUTHENTICATION')),
  status           text not null default 'pending'
                     check (status in ('pending','approved','rejected','paused','disabled')),
  components       jsonb not null default '[]'::jsonb,      -- header/body/footer/buttons
  rejected_reason  text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz
);
create index if not exists idx_wa_templates_org on public.whatsapp_templates(organization_id) where deleted_at is null;
create unique index if not exists uq_wa_templates_name on public.whatsapp_templates(organization_id, name, language);

-- ── Mídia (imagens/PDFs/áudios) ──────────────────────────────────────────────
create table if not exists public.whatsapp_media (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations(id) on delete cascade,
  external_media_id text,                                   -- media id na Meta
  direction         text not null check (direction in ('inbound','outbound')),
  mime_type         text,
  filename          text,
  size_bytes        bigint,
  sha256            text,
  storage_path      text,                                   -- caminho no Storage
  status            text not null default 'pending'
                      check (status in ('pending','stored','failed')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists idx_wa_media_org on public.whatsapp_media(organization_id);

-- ── Conversas (thread por contato/número) ────────────────────────────────────
create table if not exists public.conversations (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references public.organizations(id) on delete cascade,
  account_id            uuid references public.whatsapp_accounts(id) on delete set null,
  phone_number_id       uuid references public.whatsapp_phone_numbers(id) on delete set null,
  contact_wa_id         text not null,                      -- número do contato (wa_id)
  contact_name          text,
  customer_id           uuid references public.customers(id) on delete set null,  -- vínculo CRM
  status                text not null default 'open'
                          check (status in ('open','pending','closed')),
  assigned_to           uuid references auth.users(id) on delete set null,
  unread_count          int not null default 0,
  last_message_at       timestamptz,
  last_message_preview  text,
  last_inbound_at       timestamptz,                        -- base da janela de 24h
  window_expires_at     timestamptz,                        -- janela de atendimento (24h)
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  deleted_at            timestamptz
);
comment on table public.conversations is 'F3.1: thread de conversa WhatsApp por contato. window_expires_at = janela de 24h.';
create index if not exists idx_conversations_org on public.conversations(organization_id) where deleted_at is null;
create index if not exists idx_conversations_status on public.conversations(organization_id, status) where deleted_at is null;
create index if not exists idx_conversations_assigned on public.conversations(assigned_to) where deleted_at is null;
create index if not exists idx_conversations_customer on public.conversations(customer_id);
create index if not exists idx_conversations_last_msg on public.conversations(organization_id, last_message_at desc) where deleted_at is null;
create unique index if not exists uq_conversations_contact on public.conversations(organization_id, phone_number_id, contact_wa_id);

-- ── Mensagens ────────────────────────────────────────────────────────────────
create table if not exists public.messages (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  conversation_id  uuid not null references public.conversations(id) on delete cascade,
  direction        text not null check (direction in ('inbound','outbound')),
  wa_message_id    text,                                    -- ID na Meta (idempotência)
  type             text not null default 'text'
                     check (type in ('text','image','document','audio','video','sticker',
                                     'template','location','contacts','interactive','reaction','system')),
  body             text,
  media_id         uuid references public.whatsapp_media(id) on delete set null,
  template_id      uuid references public.whatsapp_templates(id) on delete set null,
  status           text not null default 'pending'
                     check (status in ('pending','sent','delivered','read','failed','received')),
  sender           text,                                    -- wa_id (inbound) ou agente
  sent_by          uuid references auth.users(id) on delete set null,  -- agente (outbound)
  payload          jsonb not null default '{}'::jsonb,      -- envelope neutro/bruto
  error            jsonb,
  payload_version  int not null default 1,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
comment on table public.messages is 'F3.1: mensagens. wa_message_id único por org (idempotência de ingestão/envio).';
create index if not exists idx_messages_conversation on public.messages(conversation_id, created_at);
create index if not exists idx_messages_org on public.messages(organization_id);
create index if not exists idx_messages_status on public.messages(organization_id, status) where direction = 'outbound';
create unique index if not exists uq_messages_wamid on public.messages(organization_id, wa_message_id) where wa_message_id is not null;

-- ── Eventos de status (sent/delivered/read/failed) — timeline/auditoria ──────
create table if not exists public.message_status_events (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  message_id       uuid not null references public.messages(id) on delete cascade,
  status           text not null check (status in ('sent','delivered','read','failed')),
  occurred_at      timestamptz not null default now(),
  raw              jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now()
);
create index if not exists idx_msg_status_message on public.message_status_events(message_id, occurred_at);
create index if not exists idx_msg_status_org on public.message_status_events(organization_id);
create unique index if not exists uq_msg_status on public.message_status_events(message_id, status);

-- ── Envelopes de webhook (idempotência + auditoria da ingestão) ──────────────
create table if not exists public.whatsapp_webhook_events (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid references public.organizations(id) on delete cascade,  -- resolvido após lookup
  provider         text not null default 'meta',
  event_type       text,                                    -- message | status | template | ...
  external_id      text,                                    -- id p/ dedup (wamid / status id)
  payload          jsonb not null default '{}'::jsonb,
  status           text not null default 'received'
                     check (status in ('received','processed','failed','ignored')),
  error            text,
  received_at      timestamptz not null default now(),
  processed_at     timestamptz
);
create index if not exists idx_wa_webhook_org on public.whatsapp_webhook_events(organization_id);
create index if not exists idx_wa_webhook_status on public.whatsapp_webhook_events(status);
create unique index if not exists uq_wa_webhook_external on public.whatsapp_webhook_events(provider, external_id) where external_id is not null;

-- ── Triggers updated_at ──────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array[
    'whatsapp_accounts','whatsapp_credentials','whatsapp_phone_numbers','whatsapp_templates',
    'whatsapp_media','conversations','messages'
  ] loop
    execute format('drop trigger if exists trg_%s_updated_at on public.%I', t, t);
    execute format(
      'create trigger trg_%s_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      t, t);
  end loop;
end $$;

-- === 0053_whatsapp_functions.sql ===
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

-- === 0054_whatsapp_seed.sql ===
-- 0054_whatsapp_seed.sql — Módulo F3.1 · Seeds (RBAC + job_types). Idempotente.

-- ── Permissões do módulo ─────────────────────────────────────────────────────
insert into public.permissions(key, module, description) values
  ('whatsapp.read',             'whatsapp', 'Ver inbox e conversas'),
  ('whatsapp.send',             'whatsapp', 'Enviar mensagens'),
  ('whatsapp.assign',           'whatsapp', 'Atribuir conversas'),
  ('whatsapp.templates.manage', 'whatsapp', 'Gerenciar templates'),
  ('whatsapp.connect',          'whatsapp', 'Conectar/gerenciar conta WABA')
on conflict (key) do update set module = excluded.module, description = excluded.description;

-- owner/admin: todas.
insert into public.role_permissions(role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.organization_id is null and r.key in ('owner','admin')
  and p.key in ('whatsapp.read','whatsapp.send','whatsapp.assign','whatsapp.templates.manage','whatsapp.connect')
on conflict do nothing;

-- member: opera o inbox (ler, enviar, atribuir) — sem conectar conta/gerir templates.
insert into public.role_permissions(role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.organization_id is null and r.key = 'member'
  and p.key in ('whatsapp.read','whatsapp.send','whatsapp.assign')
on conflict do nothing;

-- viewer: só leitura.
insert into public.role_permissions(role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.organization_id is null and r.key = 'viewer'
  and p.key = 'whatsapp.read'
on conflict do nothing;

-- ── Tipos de job (allowlist) — cada módulo registra os seus (C3) ─────────────
insert into public.job_types(key, module, description) values
  ('whatsapp.send',           'whatsapp', 'Enviar mensagem via Provider'),
  ('whatsapp.status',         'whatsapp', 'Aplicar status de entrega (sent/delivered/read/failed)'),
  ('whatsapp.inbound',        'whatsapp', 'Processar mensagem recebida'),
  ('whatsapp.media.download', 'whatsapp', 'Baixar e armazenar mídia recebida'),
  ('whatsapp.template.sync',  'whatsapp', 'Sincronizar status de templates com a Meta')
on conflict (key) do nothing;

-- === 0055_whatsapp_rls.sql ===
-- 0055_whatsapp_rls.sql — Módulo F3.1 · Row Level Security. Idempotente.
-- Isolamento por organização + gating por permissão. Escritas de sistema
-- (RPCs SECURITY DEFINER / worker service_role) ignoram a RLS.

-- ── Tabelas com gating leitura/escrita ───────────────────────────────────────
do $$
declare rec record;
begin
  for rec in
    select * from (values
      ('whatsapp_accounts',      'whatsapp.read', 'whatsapp.connect',           true),
      ('whatsapp_phone_numbers', 'whatsapp.read', 'whatsapp.connect',           false),
      ('whatsapp_templates',     'whatsapp.read', 'whatsapp.templates.manage',  true),
      ('whatsapp_media',         'whatsapp.read', 'whatsapp.send',              false),
      ('conversations',          'whatsapp.read', 'whatsapp.send',              true),
      ('messages',               'whatsapp.read', 'whatsapp.send',              false)
    ) as t(tbl, read_perm, write_perm, soft_delete)
  loop
    execute format('alter table public.%I enable row level security', rec.tbl);

    execute format('drop policy if exists %I on public.%I', rec.tbl || '_select', rec.tbl);
    execute format(
      'create policy %I on public.%I for select to authenticated using (%s public.has_permission(organization_id, %L))',
      rec.tbl || '_select', rec.tbl,
      case when rec.soft_delete then 'deleted_at is null and' else '' end,
      rec.read_perm);

    execute format('drop policy if exists %I on public.%I', rec.tbl || '_write', rec.tbl);
    execute format(
      'create policy %I on public.%I for all to authenticated '
      || 'using (public.has_permission(organization_id, %L)) '
      || 'with check (public.has_permission(organization_id, %L))',
      rec.tbl || '_write', rec.tbl, rec.write_perm, rec.write_perm);
  end loop;
end $$;

-- ── Somente leitura para o cliente (escrita só service_role/RPC) ─────────────
do $$
declare rec record;
begin
  for rec in
    select * from (values
      ('message_status_events',    'whatsapp.read'),
      ('whatsapp_webhook_events',  'whatsapp.connect')
    ) as t(tbl, read_perm)
  loop
    execute format('alter table public.%I enable row level security', rec.tbl);
    execute format('drop policy if exists %I on public.%I', rec.tbl || '_select', rec.tbl);
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.has_permission(organization_id, %L))',
      rec.tbl || '_select', rec.tbl, rec.read_perm);
    -- sem policy de escrita: apenas RPCs SECURITY DEFINER / service_role escrevem.
  end loop;
end $$;

-- ── Credenciais: RLS habilitada e SEM policies → cliente não acessa o token. ─
-- Só service_role (worker/webhook) lê/escreve, pois bypassa RLS.
alter table public.whatsapp_credentials enable row level security;

-- Concede privilégios do PostgREST às novas tabelas (RLS decide o acesso real).
grant select, insert, update, delete on all tables in schema public to authenticated;

-- === 0056_whatsapp_send_rpcs.sql ===
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

