-- 0028_crm_lead_conversion.sql — Conversão Lead → Customer (transacional). Idempotente.
-- Regra de negócio: um Deal NUNCA nasce de um Lead. O Lead vira Customer aqui;
-- os Deals são criados depois, a partir do Customer.

create or replace function public.convert_lead_to_customer(p_lead_id uuid)
returns public.customers
language plpgsql security definer set search_path = public
as $$
declare
  v_lead     public.leads;
  v_customer public.customers;
  v_org      uuid;
begin
  select * into v_lead from public.leads where id = p_lead_id and deleted_at is null;
  if v_lead.id is null then raise exception 'lead not found'; end if;

  v_org := v_lead.organization_id;
  if not public.has_permission(v_org, 'leads.write') then raise exception 'forbidden'; end if;
  if v_lead.converted_customer_id is not null then raise exception 'lead already converted'; end if;

  insert into public.customers(
    organization_id, type, first_name, company_name, email, phone,
    source, notes, owner_id, status, origin_channel
  )
  values (
    v_org,
    case when coalesce(v_lead.company_name, '') <> '' then 'company' else 'person' end,
    v_lead.name, v_lead.company_name, v_lead.email, v_lead.phone,
    v_lead.source, v_lead.notes, v_lead.owner_id, 'active', v_lead.source
  )
  returning * into v_customer;

  update public.leads
    set status = 'converted', converted_customer_id = v_customer.id, converted_at = now()
    where id = p_lead_id;

  -- Timeline (hub) + auditoria
  insert into public.customer_timeline(organization_id, customer_id, actor_id, module, event_type, title, payload)
  values (v_org, v_customer.id, auth.uid(), 'crm', 'lead.converted', 'Lead convertido em cliente',
          jsonb_build_object('lead_id', p_lead_id, 'customer_code', v_customer.code));

  perform public.write_audit(v_org, 'lead.converted', 'lead', p_lead_id,
    jsonb_build_object('customer_id', v_customer.id));

  return v_customer;
end;
$$;

grant execute on function public.convert_lead_to_customer(uuid) to authenticated;
