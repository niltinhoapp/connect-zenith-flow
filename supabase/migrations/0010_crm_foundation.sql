-- 0010_crm_foundation.sql — Módulo CRM · funções base compartilhadas. Idempotente.
-- Sequências por organização (códigos legíveis), geração de code e auditoria
-- automática via trigger genérico.

-- ── Sequências por organização (para códigos tipo CUST-00001) ────────────────
create table if not exists public.org_sequences (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  key             text not null,
  current         bigint not null default 0,
  primary key (organization_id, key)
);
alter table public.org_sequences enable row level security;  -- só via função definer

create or replace function public.next_sequence(p_org uuid, p_key text)
returns bigint language plpgsql security definer set search_path = public as $$
declare v bigint;
begin
  insert into public.org_sequences(organization_id, key, current)
  values (p_org, p_key, 1)
  on conflict (organization_id, key)
    do update set current = public.org_sequences.current + 1
  returning current into v;
  return v;
end; $$;

-- ── Geração automática de code (BEFORE INSERT). Args: prefixo, chave ─────────
create or replace function public.set_entity_code()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.code is null or new.code = '' then
    new.code := TG_ARGV[0] || '-' ||
      lpad(public.next_sequence(new.organization_id, TG_ARGV[1])::text, 5, '0');
  end if;
  return new;
end; $$;

-- ── Auditoria automática (AFTER INSERT/UPDATE/DELETE) ────────────────────────
-- Toda operação CRUD nas tabelas do CRM gera audit_logs via write_audit().
create or replace function public.audit_row_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_org uuid; v_id uuid; v_action text;
begin
  if TG_OP = 'DELETE' then
    v_org := OLD.organization_id; v_id := OLD.id;
    v_action := TG_TABLE_NAME || '.deleted';
  else
    v_org := NEW.organization_id; v_id := NEW.id;
    v_action := TG_TABLE_NAME || '.' || (case when TG_OP = 'INSERT' then 'created' else 'updated' end);
  end if;
  perform public.write_audit(v_org, v_action, TG_TABLE_NAME, v_id, '{}'::jsonb);
  return null;
end; $$;
