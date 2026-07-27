-- 0031_core_grants.sql — Grants ao papel service_role. Idempotente.
-- Descoberto na validação da F2.1: as migrations concediam privilégios a
-- `authenticated`, mas não a `service_role`. Os fluxos da app usam o papel
-- `authenticated` (JWT do usuário) e não eram afetados, porém o client admin
-- (src/server/supabase.ts · createSupabaseAdminClient) e jobs/webhooks (F3)
-- precisam disso. service_role ignora RLS, mas ainda exige GRANT.

grant usage on schema public to service_role;
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant execute on functions to service_role;
