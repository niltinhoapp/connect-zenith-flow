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
