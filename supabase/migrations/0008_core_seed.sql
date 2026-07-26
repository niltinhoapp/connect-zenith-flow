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
