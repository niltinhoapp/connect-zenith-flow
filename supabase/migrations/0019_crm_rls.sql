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
