-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 0001_core_foundation.sql                                                   ║
-- ║ Core · Fundação                                                            ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- Extensões e utilitários compartilhados por todo o Core. Idempotente.
--
-- Convenções do projeto (ver docs/DATABASE.md):
--   • Toda entidade usa UUID (gen_random_uuid()).
--   • Toda tabela tem created_at + updated_at (updated_at via trigger).
--   • deleted_at (soft delete) onde faz sentido (organizations, roles, members).
--   • Tabelas append-only (audit_logs) e catálogos (permissions) não têm delete.

-- gen_random_uuid()
create extension if not exists pgcrypto;

-- ── set_updated_at() ─────────────────────────────────────────────────────────
-- Trigger genérico: mantém updated_at sincronizado em qualquer UPDATE.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ── slugify() ────────────────────────────────────────────────────────────────
-- Normaliza um texto em slug url-safe. Usado ao gerar slug de organização e
-- key de papéis customizados. Caracteres acentuados viram '-' (aceitável pois
-- o slug da organização recebe um sufixo aleatório de unicidade).
create or replace function public.slugify(v text)
returns text
language sql
immutable
strict
as $$
  select trim(both '-' from regexp_replace(lower(v), '[^a-z0-9]+', '-', 'g'));
$$;

comment on function public.set_updated_at is 'Core: mantém updated_at em UPDATEs.';
comment on function public.slugify is 'Core: gera slug url-safe a partir de texto.';
