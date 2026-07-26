-- 0020_crm_provisioning.sql — Módulo CRM · funil padrão no provisionamento. Idempotente.
-- Toda nova organização nasce com um pipeline "Comercial" e estágios padrão.

create or replace function public.create_default_pipeline(p_org uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_pipeline uuid;
begin
  insert into public.pipelines(organization_id, name, is_default, position)
  values (p_org, 'Comercial', true, 0)
  returning id into v_pipeline;

  insert into public.pipeline_stages(organization_id, pipeline_id, name, position, type, probability) values
    (p_org, v_pipeline, 'Lead',        0, 'open', 10),
    (p_org, v_pipeline, 'Qualificado', 1, 'open', 30),
    (p_org, v_pipeline, 'Proposta',    2, 'open', 60),
    (p_org, v_pipeline, 'Negociação',  3, 'open', 80),
    (p_org, v_pipeline, 'Ganho',       4, 'won',  100),
    (p_org, v_pipeline, 'Perdido',     5, 'lost', 0);

  return v_pipeline;
end; $$;

-- Redefine provision_organization para também semear o funil padrão.
create or replace function public.provision_organization(p_name text)
returns public.organizations
language plpgsql security definer set search_path = public
as $$
declare
  v_uid        uuid := auth.uid();
  v_org        public.organizations;
  v_owner_role uuid;
  v_slug       text;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'organization name required'; end if;

  v_slug := public.slugify(p_name) || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);

  insert into public.organizations(name, slug) values (trim(p_name), v_slug) returning * into v_org;

  select id into v_owner_role
  from public.roles where organization_id is null and key = 'owner' and is_system;
  if v_owner_role is null then raise exception 'owner system role missing (run seed 0008)'; end if;

  insert into public.organization_members(organization_id, user_id, role_id)
  values (v_org.id, v_uid, v_owner_role);

  update public.profiles set active_organization_id = v_org.id
    where id = v_uid and active_organization_id is null;

  perform public.create_default_pipeline(v_org.id);           -- funil inicial

  perform public.write_audit(v_org.id, 'organization.created', 'organization', v_org.id,
    jsonb_build_object('name', v_org.name));

  return v_org;
end;
$$;
