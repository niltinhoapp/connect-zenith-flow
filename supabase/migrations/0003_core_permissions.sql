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
