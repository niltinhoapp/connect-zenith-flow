-- 0062_automation_action.sql — executor de ações dos nós (service_role/worker).
-- Reusa RPCs já validadas (wa_send_message, wa_set_conversation_status/tags,
-- assign_conversation) e escreve no CRM pelas tabelas existentes. O worker
-- interpola o config com o contexto ANTES de chamar (valores já concretos).
-- webhook.call é feito pelo worker (HTTP externo), não aqui.

create or replace function public.automation_action(
  p_org uuid, p_action text, p_config jsonb
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_conv   uuid := nullif(p_config->>'conversation_id','')::uuid;
  v_cust   uuid := nullif(p_config->>'customer_id','')::uuid;
  v_deal   uuid := nullif(p_config->>'deal_id','')::uuid;
  v_id     uuid;
  v_tag    text := p_config->>'tag';
begin
  if p_action = 'whatsapp.send' then
    v_id := public.wa_send_message(p_org, v_conv, 'text', p_config->>'body', null, coalesce(p_config->'payload','{}'::jsonb));
    return jsonb_build_object('message_id', v_id);

  elsif p_action = 'whatsapp.send_template' then
    v_id := public.wa_send_message(p_org, v_conv, 'template', null,
              nullif(p_config->>'template_id','')::uuid, coalesce(p_config->'payload','{}'::jsonb));
    return jsonb_build_object('message_id', v_id);

  elsif p_action = 'whatsapp.set_status' then
    perform public.wa_set_conversation_status(p_org, v_conv, p_config->>'status');
    return jsonb_build_object('ok', true);

  elsif p_action = 'conversation.assign' then
    perform public.assign_conversation(p_org, v_conv, nullif(p_config->>'assignee_id','')::uuid);
    return jsonb_build_object('ok', true);

  elsif p_action = 'conversation.add_tags' then
    -- Merge com as tags atuais da conversa (idempotente).
    perform public.wa_set_conversation_tags(p_org, v_conv, (
      select array(select distinct unnest(
        coalesce((select tags from public.conversations where id = v_conv and organization_id = p_org), '{}')
        || coalesce(array(select jsonb_array_elements_text(p_config->'tags')), '{}')))
    ));
    return jsonb_build_object('ok', true);

  elsif p_action = 'customer.add_tag' then
    update public.customers set tags = array(select distinct unnest(tags || array[v_tag])), updated_at = now()
      where id = v_cust and organization_id = p_org and v_tag is not null;
    return jsonb_build_object('ok', true);

  elsif p_action = 'customer.remove_tag' then
    update public.customers set tags = array_remove(tags, v_tag), updated_at = now()
      where id = v_cust and organization_id = p_org;
    return jsonb_build_object('ok', true);

  elsif p_action = 'customer.create' then
    insert into public.customers(organization_id, type, first_name, last_name, company_name,
                                 email, phone, mobile, document, source, status)
    values (p_org, coalesce(p_config->>'type','person'), p_config->>'first_name', p_config->>'last_name',
            p_config->>'company_name', p_config->>'email', p_config->>'phone', p_config->>'mobile',
            p_config->>'document', p_config->>'source', coalesce(p_config->>'status','active'))
    returning id into v_id;
    return jsonb_build_object('customer_id', v_id);

  elsif p_action = 'customer.update' then
    update public.customers set
      first_name = coalesce(p_config->>'first_name', first_name),
      last_name  = coalesce(p_config->>'last_name', last_name),
      email      = coalesce(p_config->>'email', email),
      phone      = coalesce(p_config->>'phone', phone),
      status     = coalesce(p_config->>'status', status),
      updated_at = now()
    where id = v_cust and organization_id = p_org;
    return jsonb_build_object('ok', true);

  elsif p_action = 'deal.create' then
    insert into public.deals(organization_id, customer_id, pipeline_id, stage_id, title, amount, source)
    values (p_org, v_cust,
            nullif(p_config->>'pipeline_id','')::uuid, nullif(p_config->>'stage_id','')::uuid,
            coalesce(p_config->>'title','Novo negócio'),
            coalesce(nullif(p_config->>'amount','')::bigint, 0), p_config->>'source')
    returning id into v_id;
    return jsonb_build_object('deal_id', v_id);

  elsif p_action = 'deal.move_stage' then
    update public.deals set stage_id = nullif(p_config->>'stage_id','')::uuid, updated_at = now()
      where id = v_deal and organization_id = p_org;
    return jsonb_build_object('ok', true);

  elsif p_action = 'deal.won' then
    update public.deals set stage_id = coalesce(nullif(p_config->>'stage_id','')::uuid, stage_id),
                            closed_at = now(), updated_at = now()
      where id = v_deal and organization_id = p_org;
    return jsonb_build_object('ok', true);

  elsif p_action = 'crm.create_note' then
    insert into public.customer_timeline(organization_id, customer_id, event_type, title, description, metadata)
    values (p_org, v_cust, 'note', coalesce(p_config->>'title','Nota da automação'),
            p_config->>'body', coalesce(p_config->'metadata','{}'::jsonb))
    returning id into v_id;
    return jsonb_build_object('timeline_id', v_id);

  elsif p_action in ('wait','noop') then
    return jsonb_build_object('ok', true);

  else
    -- Ação desconhecida: não falha a run; registra como não suportada.
    return jsonb_build_object('unsupported', p_action);
  end if;
end; $$;
grant execute on function public.automation_action(uuid, text, jsonb) to service_role;
