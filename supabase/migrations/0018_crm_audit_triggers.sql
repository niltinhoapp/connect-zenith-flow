-- 0018_crm_audit_triggers.sql — Módulo CRM · auditoria automática. Idempotente.
-- Anexa audit_row_change() (AFTER INSERT/UPDATE/DELETE) a todas as tabelas do
-- CRM: toda operação CRUD gera um registro em audit_logs.

do $$
declare t text;
begin
  foreach t in array array[
    'customers','leads','pipelines','pipeline_stages','deals',
    'customer_timeline','comments','attachments',
    'customer_tags','deal_tags','customer_custom_fields','deal_custom_fields'
  ] loop
    execute format('drop trigger if exists trg_%1$s_audit on public.%1$s', t);
    execute format(
      'create trigger trg_%1$s_audit after insert or update or delete on public.%1$s '
      || 'for each row execute function public.audit_row_change()', t);
  end loop;
end $$;
