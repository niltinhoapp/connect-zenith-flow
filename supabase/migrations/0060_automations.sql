-- 0060_automations.sql — F3.2 · Motor de Automações Visuais. Idempotente.
-- Reusa Event Bus/outbox, Queue/Jobs/Worker, quotas, RLS e auditoria já validados.
-- Comunicação entre módulos só por eventos/jobs; ações externas via Provider/RPC.

-- ── Automação (cabeçalho) ────────────────────────────────────────────────────
create table if not exists public.automations (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  name             text not null,
  description      text,
  status           text not null default 'draft' check (status in ('draft','active','paused')),
  trigger_type     text not null,                          -- ex.: lead.created, manual, scheduled
  trigger_config   jsonb not null default '{}'::jsonb,     -- ex.: cron, filtros do gatilho
  current_version  int not null default 1,
  created_by       uuid references auth.users(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz
);
create index if not exists idx_automations_org on public.automations(organization_id) where deleted_at is null;
create index if not exists idx_automations_trigger on public.automations(organization_id, trigger_type, status) where deleted_at is null;

-- ── Versão do fluxo (snapshot do grafo) ─────────────────────────────────────
create table if not exists public.automation_versions (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  automation_id    uuid not null references public.automations(id) on delete cascade,
  version          int not null,
  graph            jsonb not null default '{}'::jsonb,     -- snapshot { nodes, edges } p/ histórico
  created_by       uuid references auth.users(id) on delete set null,
  created_at       timestamptz not null default now()
);
create unique index if not exists uq_automation_versions on public.automation_versions(automation_id, version);

-- ── Nós do fluxo (por versão) ────────────────────────────────────────────────
create table if not exists public.automation_nodes (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  automation_id    uuid not null references public.automations(id) on delete cascade,
  version          int not null,
  node_key         text not null,                          -- id lógico do nó no grafo
  type             text not null check (type in ('trigger','condition','delay','action','branch')),
  config           jsonb not null default '{}'::jsonb,
  position         jsonb not null default '{}'::jsonb,      -- {x,y} p/ o canvas
  created_at       timestamptz not null default now()
);
create index if not exists idx_automation_nodes on public.automation_nodes(automation_id, version);
create unique index if not exists uq_automation_nodes_key on public.automation_nodes(automation_id, version, node_key);

-- ── Arestas do fluxo (ramificações sim/não) ─────────────────────────────────
create table if not exists public.automation_edges (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  automation_id    uuid not null references public.automations(id) on delete cascade,
  version          int not null,
  from_node        text not null,
  to_node          text not null,
  branch           text check (branch in ('yes','no')),    -- null = fluxo linear; yes/no p/ condição
  created_at       timestamptz not null default now()
);
create index if not exists idx_automation_edges on public.automation_edges(automation_id, version);

-- ── Execução do fluxo ────────────────────────────────────────────────────────
create table if not exists public.automation_runs (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  automation_id    uuid not null references public.automations(id) on delete cascade,
  version          int not null,
  trigger_event    text,
  context          jsonb not null default '{}'::jsonb,     -- payload do gatilho (lead/deal/msg…)
  status           text not null default 'queued'
                     check (status in ('queued','running','succeeded','failed','paused','canceled')),
  current_node     text,
  idempotency_key  text,
  error            text,
  started_at       timestamptz,
  finished_at      timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists idx_automation_runs on public.automation_runs(automation_id, created_at desc);
create index if not exists idx_automation_runs_org on public.automation_runs(organization_id, status);
create unique index if not exists uq_automation_runs_idem on public.automation_runs(automation_id, idempotency_key) where idempotency_key is not null;

-- ── Passos da execução (log por etapa) ──────────────────────────────────────
create table if not exists public.automation_run_steps (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  run_id           uuid not null references public.automation_runs(id) on delete cascade,
  node_key         text not null,
  type             text not null,
  status           text not null check (status in ('ok','failed','skipped','waiting')),
  input            jsonb not null default '{}'::jsonb,
  output           jsonb not null default '{}'::jsonb,
  error            text,
  occurred_at      timestamptz not null default now()
);
create index if not exists idx_automation_run_steps on public.automation_run_steps(run_id, occurred_at);

-- ── Triggers updated_at ──────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['automations','automation_runs'] loop
    execute format('drop trigger if exists trg_%s_updated_at on public.%I', t, t);
    execute format('create trigger trg_%s_updated_at before update on public.%I for each row execute function public.set_updated_at()', t, t);
  end loop;
end $$;

-- ── Permissões (RBAC) ────────────────────────────────────────────────────────
insert into public.permissions(key, module, description) values
  ('automacoes.read',   'automacoes', 'Ver automações e execuções'),
  ('automacoes.manage', 'automacoes', 'Criar/editar/ativar automações'),
  ('automacoes.run',    'automacoes', 'Executar/testar automações')
on conflict (key) do update set module = excluded.module, description = excluded.description;

insert into public.role_permissions(role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.organization_id is null and r.key in ('owner','admin')
  and p.key in ('automacoes.read','automacoes.manage','automacoes.run')
on conflict do nothing;

insert into public.role_permissions(role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.organization_id is null and r.key = 'member'
  and p.key in ('automacoes.read','automacoes.run')
on conflict do nothing;

insert into public.role_permissions(role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.organization_id is null and r.key = 'viewer' and p.key = 'automacoes.read'
on conflict do nothing;

-- ── Job types (allowlist C3) ─────────────────────────────────────────────────
insert into public.job_types(key, module, description) values
  ('automation.run', 'automacoes', 'Executa/continua uma run de automação (steps + delays)')
on conflict (key) do nothing;

-- ── RLS (multi-tenant + RBAC) ────────────────────────────────────────────────
-- Definição do fluxo: leitura c/ automacoes.read; escrita c/ automacoes.manage.
-- Runs/steps: só leitura ao usuário (o worker/service_role escreve, bypassa RLS).
alter table public.automations          enable row level security;
alter table public.automation_versions  enable row level security;
alter table public.automation_nodes     enable row level security;
alter table public.automation_edges     enable row level security;
alter table public.automation_runs      enable row level security;
alter table public.automation_run_steps enable row level security;

do $$
declare
  t text;
  read_tables text[] := array['automations','automation_versions','automation_nodes','automation_edges'];
begin
  -- Definição do fluxo: SELECT (read) + ALL (manage)
  foreach t in array read_tables loop
    execute format('drop policy if exists %1$s_select on public.%1$I', t);
    execute format($p$create policy %1$s_select on public.%1$I for select to authenticated
      using (public.has_permission(organization_id, 'automacoes.read'))$p$, t);
    execute format('drop policy if exists %1$s_write on public.%1$I', t);
    execute format($p$create policy %1$s_write on public.%1$I for all to authenticated
      using (public.has_permission(organization_id, 'automacoes.manage'))
      with check (public.has_permission(organization_id, 'automacoes.manage'))$p$, t);
  end loop;
  -- 'automations' esconde soft-deleted no SELECT
  execute 'drop policy if exists automations_select on public.automations';
  execute $p$create policy automations_select on public.automations for select to authenticated
    using (deleted_at is null and public.has_permission(organization_id, 'automacoes.read'))$p$;
  -- Runs/steps: somente leitura ao usuário
  foreach t in array array['automation_runs','automation_run_steps'] loop
    execute format('drop policy if exists %1$s_select on public.%1$I', t);
    execute format($p$create policy %1$s_select on public.%1$I for select to authenticated
      using (public.has_permission(organization_id, 'automacoes.read'))$p$, t);
  end loop;
end $$;

-- ── Grants (o papel authenticated só acessa a tabela com GRANT; RLS filtra linhas)
-- Sem isto o frontend recebe 403 "permission denied for table". Padrão do projeto:
-- re-conceder em "all tables" ao fim de cada migration que cria tabelas.
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
