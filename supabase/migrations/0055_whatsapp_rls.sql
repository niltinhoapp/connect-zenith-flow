-- 0055_whatsapp_rls.sql — Módulo F3.1 · Row Level Security. Idempotente.
-- Isolamento por organização + gating por permissão. Escritas de sistema
-- (RPCs SECURITY DEFINER / worker service_role) ignoram a RLS.

-- ── Tabelas com gating leitura/escrita ───────────────────────────────────────
do $$
declare rec record;
begin
  for rec in
    select * from (values
      ('whatsapp_accounts',      'whatsapp.read', 'whatsapp.connect',           true),
      ('whatsapp_phone_numbers', 'whatsapp.read', 'whatsapp.connect',           false),
      ('whatsapp_templates',     'whatsapp.read', 'whatsapp.templates.manage',  true),
      ('whatsapp_media',         'whatsapp.read', 'whatsapp.send',              false),
      ('conversations',          'whatsapp.read', 'whatsapp.send',              true),
      ('messages',               'whatsapp.read', 'whatsapp.send',              false)
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

-- ── Somente leitura para o cliente (escrita só service_role/RPC) ─────────────
do $$
declare rec record;
begin
  for rec in
    select * from (values
      ('message_status_events',    'whatsapp.read'),
      ('whatsapp_webhook_events',  'whatsapp.connect')
    ) as t(tbl, read_perm)
  loop
    execute format('alter table public.%I enable row level security', rec.tbl);
    execute format('drop policy if exists %I on public.%I', rec.tbl || '_select', rec.tbl);
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.has_permission(organization_id, %L))',
      rec.tbl || '_select', rec.tbl, rec.read_perm);
    -- sem policy de escrita: apenas RPCs SECURITY DEFINER / service_role escrevem.
  end loop;
end $$;

-- ── Credenciais: RLS habilitada e SEM policies → cliente não acessa o token. ─
-- Só service_role (worker/webhook) lê/escreve, pois bypassa RLS.
alter table public.whatsapp_credentials enable row level security;

-- Concede privilégios do PostgREST às novas tabelas (RLS decide o acesso real).
grant select, insert, update, delete on all tables in schema public to authenticated;
