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
