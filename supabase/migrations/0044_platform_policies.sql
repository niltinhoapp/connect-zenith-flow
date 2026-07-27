-- 0044_platform_policies.sql — RLS + grants da infraestrutura. Idempotente.

-- Grants (idempotente; RLS ainda gateia as linhas).
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant all privileges on all tables in schema public to service_role;

-- ── Catálogos globais: leitura para autenticados, sem escrita pelo cliente ────
do $$
declare t text;
begin
  foreach t in array array['modules','plan_limits','market_templates'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('create policy %I on public.%I for select to authenticated using (true)', t || '_select', t);
  end loop;
end $$;

-- ── Tabelas por org gateadas por permissão (read_perm / write_perm) ──────────
do $$
declare rec record;
begin
  for rec in
    select * from (values
      ('organization_modules', 'is_org_member',       'modules.manage'),
      ('module_configs',       'is_org_member',       'configuracoes.manage'),
      ('job_schedules',        'is_org_member',       'modules.manage'),
      ('webhooks',             'webhooks.manage',     'webhooks.manage')
    ) as t(tbl, read_expr, write_perm)
  loop
    execute format('alter table public.%I enable row level security', rec.tbl);
    execute format('drop policy if exists %I on public.%I', rec.tbl || '_select', rec.tbl);
    if rec.read_expr = 'is_org_member' then
      execute format('create policy %I on public.%I for select to authenticated using (public.is_org_member(organization_id))', rec.tbl || '_select', rec.tbl);
    else
      execute format('create policy %I on public.%I for select to authenticated using (public.has_permission(organization_id, %L))', rec.tbl || '_select', rec.tbl, rec.read_expr);
    end if;
    execute format('drop policy if exists %I on public.%I', rec.tbl || '_write', rec.tbl);
    execute format('create policy %I on public.%I for all to authenticated using (public.has_permission(organization_id, %L)) with check (public.has_permission(organization_id, %L))', rec.tbl || '_write', rec.tbl, rec.write_perm, rec.write_perm);
  end loop;
end $$;

-- ── Somente leitura por membro; escrita apenas via RPCs SECURITY DEFINER ─────
do $$
declare t text;
begin
  foreach t in array array['jobs','job_dead_letter','quota_usage','webhook_deliveries'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.is_org_member(organization_id))', t || '_select', t);
  end loop;
end $$;

-- ── operation_traces: leitura por observability.read; escrita via definer ────
alter table public.operation_traces enable row level security;
drop policy if exists operation_traces_select on public.operation_traces;
create policy operation_traces_select on public.operation_traces for select to authenticated
  using (organization_id is not null and public.has_permission(organization_id, 'observability.read'));
