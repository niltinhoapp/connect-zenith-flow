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
