-- ConnectWeb Automations — schema completo (migrations 0001–0031).
-- Idempotente. Aplicar no SQL Editor do Supabase.

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

