-- 0064_automation_idempotency.sql — idempotência retry-safe por nó de ação.
-- Um nó de ação só é "concluído" quando existe um step 'ok' dele na run. Assim,
-- ao reprocessar (retry), ações que falharam voltam a executar (a falha não é
-- mascarada) e ações já concluídas são puladas. Idempotente.
create or replace function public.automation_node_done(p_run_id uuid, p_node text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from public.automation_run_steps
    where run_id = p_run_id and node_key = p_node and type = 'action' and status = 'ok'
  );
$$;
grant execute on function public.automation_node_done(uuid, text) to service_role;
