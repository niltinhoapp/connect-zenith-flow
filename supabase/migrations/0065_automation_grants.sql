-- 0065_automation_grants.sql — concede privilégio de tabela ao papel authenticated
-- para as tabelas de automação (0060). Sem isto, o frontend (papel authenticated
-- via PostgREST) recebe 403 "permission denied for table automations" — o RLS só
-- é avaliado DEPOIS do grant de tabela. O 0060 criou as tabelas mas não re-executou
-- o grant de "all tables" que o projeto usa ao fim de cada migration de schema.
-- A RLS já criada continua restringindo as linhas por organização/permissão.
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
