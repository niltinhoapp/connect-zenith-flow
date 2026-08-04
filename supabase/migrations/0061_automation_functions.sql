-- 0061_automation_functions.sql — RPCs do motor de automações. Idempotente.
-- Guard C1: usuário precisa de permissão; service_role (auth.uid() null) passa
-- (worker). Ações externas ocorrem nos jobs, nunca aqui.

-- ── Guard interno ────────────────────────────────────────────────────────────
create or replace function public.automation_guard(p_org uuid, p_perm text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.has_permission(p_org, p_perm) then
    raise exception 'forbidden';
  end if;
end; $$;
grant execute on function public.automation_guard(uuid, text) to authenticated, service_role;

-- ── Salvar/versionar fluxo (snapshot imutável por versão) ─────────────────────
-- p_graph = { "nodes":[{node_key,type,config,position}], "edges":[{from_node,to_node,branch}] }
create or replace function public.automation_save(
  p_org uuid, p_id uuid, p_name text, p_description text,
  p_trigger_type text, p_trigger_config jsonb, p_graph jsonb
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_version int; n jsonb; e jsonb;
begin
  perform public.automation_guard(p_org, 'automacoes.manage');

  if p_id is null then
    insert into public.automations(organization_id, name, description, trigger_type, trigger_config, current_version, created_by)
    values (p_org, p_name, p_description, p_trigger_type, coalesce(p_trigger_config,'{}'::jsonb), 1, auth.uid())
    returning id, current_version into v_id, v_version;
  else
    update public.automations
      set name = p_name, description = p_description, trigger_type = p_trigger_type,
          trigger_config = coalesce(p_trigger_config,'{}'::jsonb),
          current_version = current_version + 1, updated_at = now()
      where id = p_id and organization_id = p_org and deleted_at is null
      returning id, current_version into v_id, v_version;
    if v_id is null then raise exception 'automation not found'; end if;
  end if;

  -- Snapshot da versão (histórico) + nós/arestas imutáveis dessa versão.
  insert into public.automation_versions(organization_id, automation_id, version, graph, created_by)
  values (p_org, v_id, v_version, coalesce(p_graph,'{}'::jsonb), auth.uid());

  for n in select * from jsonb_array_elements(coalesce(p_graph->'nodes','[]'::jsonb)) loop
    insert into public.automation_nodes(organization_id, automation_id, version, node_key, type, config, position)
    values (p_org, v_id, v_version, n->>'node_key', n->>'type',
            coalesce(n->'config','{}'::jsonb), coalesce(n->'position','{}'::jsonb));
  end loop;
  for e in select * from jsonb_array_elements(coalesce(p_graph->'edges','[]'::jsonb)) loop
    insert into public.automation_edges(organization_id, automation_id, version, from_node, to_node, branch)
    values (p_org, v_id, v_version, e->>'from_node', e->>'to_node', nullif(e->>'branch',''));
  end loop;

  return jsonb_build_object('id', v_id, 'version', v_version);
end; $$;
grant execute on function public.automation_save(uuid, uuid, text, text, text, jsonb, jsonb) to authenticated, service_role;

-- ── Ativar / pausar / rascunho ───────────────────────────────────────────────
create or replace function public.automation_set_status(p_org uuid, p_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.automation_guard(p_org, 'automacoes.manage');
  if p_status not in ('draft','active','paused') then raise exception 'invalid status'; end if;
  update public.automations set status = p_status, updated_at = now()
    where id = p_id and organization_id = p_org and deleted_at is null;
  if not found then raise exception 'automation not found'; end if;
end; $$;
grant execute on function public.automation_set_status(uuid, uuid, text) to authenticated, service_role;

-- ── Duplicar (clona header + versão atual) ───────────────────────────────────
create or replace function public.automation_duplicate(p_org uuid, p_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_new uuid; src public.automations; v_ver int;
begin
  perform public.automation_guard(p_org, 'automacoes.manage');
  select * into src from public.automations where id = p_id and organization_id = p_org and deleted_at is null;
  if src.id is null then raise exception 'automation not found'; end if;
  v_ver := src.current_version;

  insert into public.automations(organization_id, name, description, status, trigger_type, trigger_config, current_version, created_by)
  values (p_org, src.name || ' (cópia)', src.description, 'draft', src.trigger_type, src.trigger_config, 1, auth.uid())
  returning id into v_new;

  insert into public.automation_versions(organization_id, automation_id, version, graph, created_by)
  select p_org, v_new, 1, graph, auth.uid() from public.automation_versions
    where automation_id = p_id and version = v_ver;
  insert into public.automation_nodes(organization_id, automation_id, version, node_key, type, config, position)
  select p_org, v_new, 1, node_key, type, config, position from public.automation_nodes
    where automation_id = p_id and version = v_ver;
  insert into public.automation_edges(organization_id, automation_id, version, from_node, to_node, branch)
  select p_org, v_new, 1, from_node, to_node, branch from public.automation_edges
    where automation_id = p_id and version = v_ver;
  return v_new;
end; $$;
grant execute on function public.automation_duplicate(uuid, uuid) to authenticated, service_role;

-- ── Excluir (soft delete) ────────────────────────────────────────────────────
create or replace function public.automation_delete(p_org uuid, p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.automation_guard(p_org, 'automacoes.manage');
  update public.automations set status = 'paused', deleted_at = now(), updated_at = now()
    where id = p_id and organization_id = p_org and deleted_at is null;
end; $$;
grant execute on function public.automation_delete(uuid, uuid) to authenticated, service_role;

-- ── Iniciar execução (manual/teste/dispatch) ────────────────────────────────
-- Cria a run (idempotente por p_idempotency) e enfileira automation.run.
create or replace function public.automation_start_run(
  p_org uuid, p_automation_id uuid, p_trigger_event text,
  p_context jsonb default '{}'::jsonb, p_idempotency text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_run uuid; v_ver int; v_status text;
begin
  perform public.automation_guard(p_org, 'automacoes.run');
  select current_version, status into v_ver, v_status
    from public.automations where id = p_automation_id and organization_id = p_org and deleted_at is null;
  if v_ver is null then raise exception 'automation not found'; end if;

  -- Idempotência: run única por (automation, idempotency_key).
  if p_idempotency is not null then
    select id into v_run from public.automation_runs
      where automation_id = p_automation_id and idempotency_key = p_idempotency limit 1;
    if v_run is not null then return v_run; end if;
  end if;

  insert into public.automation_runs(organization_id, automation_id, version, trigger_event, context, status, idempotency_key)
  values (p_org, p_automation_id, v_ver, p_trigger_event, coalesce(p_context,'{}'::jsonb), 'queued', p_idempotency)
  returning id into v_run;

  perform public.enqueue_job(p_org, 'automation.run', jsonb_build_object('run_id', v_run),
    now(), 0, 5, null, null, 'automation.run:' || v_run::text || ':start', 1);
  return v_run;
end; $$;
grant execute on function public.automation_start_run(uuid, uuid, text, jsonb, text) to authenticated, service_role;

-- ── Dispatch por evento (Event Bus → automações ativas) ──────────────────────
-- Chamado pelo relay do outbox. Idempotente por (automation, evento).
create or replace function public.automation_dispatch_event(
  p_org uuid, p_event text, p_payload jsonb, p_event_id uuid
) returns int language plpgsql security definer set search_path = public as $$
declare a record; n int := 0;
begin
  for a in
    select id from public.automations
    where organization_id = p_org and status = 'active' and deleted_at is null
      and trigger_type = p_event
  loop
    perform public.automation_start_run(
      p_org, a.id, p_event, p_payload, 'evt:' || coalesce(p_event_id::text, md5(p_payload::text)));
    n := n + 1;
  end loop;
  return n;
end; $$;
grant execute on function public.automation_dispatch_event(uuid, text, jsonb, uuid) to service_role;

-- ── Contexto de execução (worker) ────────────────────────────────────────────
create or replace function public.automation_run_context(p_run_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.automation_runs; v_nodes jsonb; v_edges jsonb;
begin
  select * into r from public.automation_runs where id = p_run_id;
  if r.id is null then return null; end if;
  select coalesce(jsonb_agg(jsonb_build_object('node_key',node_key,'type',type,'config',config)), '[]'::jsonb)
    into v_nodes from public.automation_nodes where automation_id = r.automation_id and version = r.version;
  select coalesce(jsonb_agg(jsonb_build_object('from_node',from_node,'to_node',to_node,'branch',branch)), '[]'::jsonb)
    into v_edges from public.automation_edges where automation_id = r.automation_id and version = r.version;
  return jsonb_build_object(
    'run_id', r.id, 'organization_id', r.organization_id, 'automation_id', r.automation_id,
    'version', r.version, 'status', r.status, 'current_node', r.current_node,
    'trigger_event', r.trigger_event, 'context', r.context,
    'nodes', v_nodes, 'edges', v_edges);
end; $$;
grant execute on function public.automation_run_context(uuid) to service_role;

-- ── Registrar step (log por etapa) ───────────────────────────────────────────
create or replace function public.automation_record_step(
  p_run_id uuid, p_node text, p_type text, p_status text,
  p_input jsonb default '{}'::jsonb, p_output jsonb default '{}'::jsonb, p_error text default null
) returns void language plpgsql security definer set search_path = public as $$
declare v_org uuid;
begin
  select organization_id into v_org from public.automation_runs where id = p_run_id;
  if v_org is null then return; end if;
  insert into public.automation_run_steps(organization_id, run_id, node_key, type, status, input, output, error)
  values (v_org, p_run_id, p_node, p_type, p_status, coalesce(p_input,'{}'::jsonb), coalesce(p_output,'{}'::jsonb), p_error);
end; $$;
grant execute on function public.automation_record_step(uuid, text, text, text, jsonb, jsonb, text) to service_role;

-- ── Avançar/finalizar run ────────────────────────────────────────────────────
create or replace function public.automation_advance_run(
  p_run_id uuid, p_current_node text, p_status text, p_error text default null
) returns void language plpgsql security definer set search_path = public as $$
declare r public.automation_runs;
begin
  select * into r from public.automation_runs where id = p_run_id;
  if r.id is null then return; end if;
  update public.automation_runs set
    current_node = p_current_node,
    status = p_status,
    error = coalesce(p_error, error),
    started_at = coalesce(started_at, case when p_status = 'running' then now() end),
    finished_at = case when p_status in ('succeeded','failed','canceled') then now() else finished_at end,
    updated_at = now()
  where id = p_run_id;

  -- Eventos de ciclo de vida (Event Bus durável).
  if p_status = 'running' and r.started_at is null then
    perform public.publish_event(r.organization_id, 'automation.started',
      jsonb_build_object('automationId', r.automation_id, 'runId', r.id));
  elsif p_status = 'succeeded' then
    perform public.publish_event(r.organization_id, 'automation.completed',
      jsonb_build_object('automationId', r.automation_id, 'runId', r.id));
  elsif p_status = 'failed' then
    perform public.publish_event(r.organization_id, 'automation.failed',
      jsonb_build_object('automationId', r.automation_id, 'runId', r.id, 'error', coalesce(p_error,'')));
  end if;
end; $$;
grant execute on function public.automation_advance_run(uuid, text, text, text) to service_role;

-- ── Relay: além dos webhooks, faz fan-out para automações ativas ─────────────
create or replace function public.relay_domain_event(p_event_id uuid)
returns int language plpgsql security definer set search_path = public as $$
declare e public.domain_events; n int;
begin
  select * into e from public.domain_events where id = p_event_id;
  if e.id is null then return 0; end if;
  n := public.dispatch_webhooks(e.organization_id, e.name, e.payload);
  perform public.automation_dispatch_event(e.organization_id, e.name, e.payload, e.id);
  update public.domain_events set status = 'done', processed_at = now(), updated_at = now() where id = p_event_id;
  return n;
end; $$;
grant execute on function public.relay_domain_event(uuid) to service_role;
