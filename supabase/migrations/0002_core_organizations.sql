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
