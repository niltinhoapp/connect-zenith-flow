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
