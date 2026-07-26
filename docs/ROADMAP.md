# Roadmap Técnico — ConnectWeb Automations

Princípio: **auth antes de dados, dados antes de integrações, integrações antes
de billing.** Cada fase deixa o app funcional e demonstrável.

## F0 — Fundação estrutural ✅ (concluída)

Reorganização sem alterar UI/UX/Design System.

- [x] Estrutura por features (`src/features/*`).
- [x] `lib/`, `types/`, `server/`, `config/`.
- [x] Extração de compartilhados: `BrandMark`, `Sidebar`, `Header`,
      `KpiCard`, `SectionCard`, `chart-theme`.
- [x] Remoção de duplicações (logo, tooltip de gráficos, `premium.tsx`).
- [x] Arquivos-base do Supabase (scaffolding, sem SDK ainda).
- [x] Documentação (`docs/`), `.env.example`, `supabase/` inicial.

## F1 — Auth & Multi-tenancy ✅ (código concluído; ativação requer provisionar Supabase)

- [x] Migrations Core organizadas (`0001`–`0009`): organizations, profiles,
      roles, permissions, role_permissions, organization_members, audit_logs.
- [x] RLS com helpers SECURITY DEFINER; isolamento total por `organization_id`.
- [x] Seeds: catálogo de permissões + 4 papéis de sistema + mapeamento.
- [x] RPCs: `provision_organization`, `set_active_organization`, `create_role`;
      trigger `handle_new_user`; `write_audit` (auditoria append-only).
- [x] Clientes Supabase ativados (browser + server SSR com cookies).
- [x] `types/database.ts` tipado (à mão; trocar por `supabase gen types` na ativação).
- [x] Core plugin-ready: `auth`, `organizations`, `permissions`, `audit` + scaffolds.
- [x] Sessão SSR + guard central em `__root` (`beforeLoad`) + `SessionProvider`.
- [x] Login / Cadastro / Recuperação / Logout com React Hook Form + Zod.
- [x] Provisionamento automático (org + Owner + workspace) no cadastro.
- [x] RBAC com papéis customizados por org (backend completo; UI na F2).
- [x] Seletor de empresa (multi-org) no dropdown existente.
- [x] Placeholders substituídos por dados reais da sessão.
- [ ] **Ativação (usuário):** provisionar projeto Supabase, preencher `.env`,
      `bun install`, `supabase db push`, confirmar e-mail OFF no dashboard.

## F2 — Dados reais

- [ ] Schema: clientes, deals/pipeline, metas.
- [ ] TanStack Query + loaders; CRUD de Clientes e CRM.
- [ ] Relatórios lendo dados reais.
- [ ] Estados de loading / empty / error.

## F3 — Integrações

- [ ] WhatsApp Cloud API (webhook + envio; inbox realtime).
- [ ] IA (provedor + medição de créditos; blocos de IA).
- [ ] Automações: persistência do builder + engine de execução.

## F4 — SaaS-ização

- [ ] Billing Stripe (checkout + webhooks) a partir de `config/plans.ts`.
- [ ] Limites/quotas (créditos IA, assentos).
- [ ] RBAC por papel (`MemberRole`).
- [ ] Marketplace de módulos (ligar/desligar por tenant via `config/modules.ts`).

## F5 — Produção

- [ ] Observabilidade (Sentry) além do hook do Lovable.
- [ ] Testes (Vitest + Playwright) e CI.
- [ ] Theme toggle light/dark; auditoria de acessibilidade.
- [ ] Rate limiting e hardening.
