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
