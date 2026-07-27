-- 0045_platform_triggers.sql — updated_at + auditoria automática. Idempotente.

-- updated_at em todas as tabelas da F3.0 que têm a coluna.
do $$
declare t text;
begin
  foreach t in array array[
    'modules','organization_modules','module_configs','jobs','job_schedules',
    'plan_limits','quota_usage','webhooks','webhook_deliveries','market_templates'
  ] loop
    execute format('drop trigger if exists trg_%1$s_updated_at on public.%1$s', t);
    execute format('create trigger trg_%1$s_updated_at before update on public.%1$s for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- Auditoria automática nas tabelas de gestão com organization_id (evita ruído
-- em jobs/quota/traces/deliveries de alta frequência).
do $$
declare t text;
begin
  foreach t in array array['organization_modules','module_configs','webhooks'] loop
    execute format('drop trigger if exists trg_%1$s_audit on public.%1$s', t);
    execute format('create trigger trg_%1$s_audit after insert or update or delete on public.%1$s for each row execute function public.audit_row_change()', t);
  end loop;
end $$;
