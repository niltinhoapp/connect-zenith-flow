-- 0050_hardening_dlq_manual.sql — DLQ manual (reprocessar/descartar) + permissão. Idempotente.
-- Base para a futura tela Configurações → Jobs (Reprocessar · Ignorar · Ver erro).

insert into public.permissions(key, module, description) values
  ('jobs.manage', 'configuracoes', 'Reprocessar/descartar jobs (Dead Letter Queue)')
on conflict (key) do update set description = excluded.description;

insert into public.role_permissions(role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.organization_id is null and r.key in ('owner','admin') and p.key = 'jobs.manage'
on conflict do nothing;

-- Reprocessar: reenfileira o job a partir da DLQ e remove o registro.
create or replace function public.retry_dead_letter(p_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare d public.job_dead_letter; v_id uuid;
begin
  select * into d from public.job_dead_letter where id = p_id;
  if d.id is null then raise exception 'not found'; end if;
  if d.organization_id is not null and not public.has_permission(d.organization_id, 'jobs.manage') then raise exception 'forbidden'; end if;
  v_id := public.enqueue_job(d.organization_id, d.type, d.payload, now(), 0, 5, null, null, null, 1);
  delete from public.job_dead_letter where id = p_id;
  return v_id;
end; $$;
grant execute on function public.retry_dead_letter(uuid) to authenticated;

-- Descartar: remove o registro da DLQ.
create or replace function public.discard_dead_letter(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare d public.job_dead_letter;
begin
  select * into d from public.job_dead_letter where id = p_id;
  if d.id is null then return; end if;
  if d.organization_id is not null and not public.has_permission(d.organization_id, 'jobs.manage') then raise exception 'forbidden'; end if;
  delete from public.job_dead_letter where id = p_id;
end; $$;
grant execute on function public.discard_dead_letter(uuid) to authenticated;
