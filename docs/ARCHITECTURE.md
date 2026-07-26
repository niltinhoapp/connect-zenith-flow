# Arquitetura — ConnectWeb Automations

> SaaS comercial de automação empresarial (CRM, WhatsApp, IA, Billing) —
> multiempresa desde o dia 1.

## Stack

| Camada | Tecnologia |
| --- | --- |
| Framework | TanStack Start (SSR, file-based routing, target Nitro/Cloudflare) |
| UI | React 19 + TypeScript (strict) |
| Estilo | Tailwind CSS v4 (CSS-first `@theme`) + tokens OKLCH |
| Componentes | shadcn/ui sobre Radix UI |
| Dados | TanStack Query (client) + TanStack Start server functions |
| Backend | **Supabase** — PostgreSQL + Auth + Storage + RLS + Realtime |
| Gráficos | Recharts (tematizado por `components/shared/chart-theme.ts`) |
| Forms | react-hook-form + zod |
| Build / PM | Vite + **Bun** |

## Estrutura de pastas

```
src/
├── routes/              # File-based routing (telas). NÃO mover arquivos daqui.
├── features/            # Um módulo por domínio de negócio
│   ├── auth/            # Autenticação, sessão, membership, guards
│   ├── dashboard/       # Visão geral
│   ├── crm/             # Pipeline de vendas (kanban)
│   ├── clientes/        # Base de clientes
│   ├── whatsapp/        # Inbox + WhatsApp Cloud API
│   ├── automacoes/      # Builder visual + engine
│   ├── ia/              # Copilot / créditos de IA
│   ├── relatorios/      # Análises e exportações
│   ├── configuracoes/   # Workspace, time, integrações
│   └── billing/         # Planos, assinatura, uso
│       └── (cada um: api.ts · schema.ts · hooks/ · components/ · index.ts)
├── components/
│   ├── ui/              # shadcn/ui (Design System — não editar tokens)
│   ├── layout/          # BrandMark · Sidebar · Header (primitivos de layout)
│   ├── shared/          # KpiCard · SectionCard · chart-theme
│   ├── app-layout.tsx   # Shell autenticado (compõe layout/*)
│   └── auth-shell.tsx   # Shell de autenticação
├── lib/                 # cn, env, query-client, supabase (browser)
├── server/              # Server functions + clientes Supabase server-side (secrets)
├── types/               # domain.ts (modelo) + database.ts (gerado F1)
├── config/              # navigation · plans · modules · app
└── styles.css           # Design System (fonte única da verdade)
```

## Camadas e fluxo de dados

```
Route (src/routes) ─ thin: só layout + <feature UI>
        │
        ▼
Feature (src/features/<x>)
   components/ ──uses──► hooks/ (TanStack Query) ──calls──► api.ts
                                                              │
                              ┌───────────────────────────────┤
                              ▼ (browser, RLS)                 ▼ (privileged)
                  lib/supabase (anon key)          server/ (service role / server fn)
                              │                                 │
                              └──────────► Supabase Postgres ◄──┘
                                          (RLS por organization_id)
```

- **Client → dados públicos/por-usuário:** `lib/supabase` (anon key), sempre sob RLS.
- **Servidor → operações privilegiadas** (webhooks, jobs, integrações com
  secrets): `server/` com service role, escopando `organization_id` manualmente.

## Multiempresa (multi-tenant)

- Toda entidade de negócio carrega `organizationId` (ver `types/domain.ts`).
- Isolamento garantido por **Row Level Security** no Postgres — ver
  `docs/DATABASE.md`.
- A organização ativa vem **sempre da sessão** no servidor; nunca de input do
  cliente.

## Marketplace de módulos

- `config/modules.ts` é o registro de módulos instaláveis.
- `Organization.enabledModules` define o que cada tenant ativou; `config/plans.ts`
  define o que cada plano libera.
- Sidebar, guards de rota e o marketplace leem desse registro, permitindo
  ligar/desligar módulos por empresa sem alterar código.

## Domain Layer (DDD por módulo)

Cada módulo de negócio tem uma **camada de domínio** com estrutura fixa:

```
features/<módulo>/domain/
├── entities/        Entidades com identidade + invariantes de negócio
├── value-objects/   Valores imutáveis, validados no construtor (Email, Money…)
├── services/        Regras/orquestração (usam repository + eventos + providers)
├── repositories/    Interfaces de persistência (implementação = infra)
└── events/          Eventos que o módulo produz/consome (via Event Bus)
```

Kernel compartilhado em `core/domain` (`Entity`, `ValueObject`, `Repository`,
`DomainError`, `invariant`).

**Regras invioláveis:**

1. **Nenhuma regra de negócio em componentes React** — vive em entities / value
   objects / services.
2. **Nenhuma regra nas rotas** — rotas só orquestram UI e chamam services.
3. **Todo acesso ao banco passa por um Repository** (nada de query solta).
4. **Toda comunicação externa passa por um Provider** (nunca um vendor direto).
5. **Toda comunicação entre módulos usa o Event Bus** (nunca chamada direta).

Fluxo típico:

```
Rota/Componente (UI)  →  Service (regras)  →  Repository (DB)   → Supabase (RLS)
                                          ↘  eventBus.publish → outros módulos
                                          ↘  Provider (WhatsApp/IA/…) → vendor
```

Exemplo real: `ClienteService.create()` valida via `Cliente.create()` (invariantes),
persiste via `ClienteRepository` e publica `customer.created` no Event Bus.

**Testes:** o Core e o domínio são testados em unidade com Vitest
(`bun run test` / `npm run test`) — Event Bus, Provider registry, RBAC e regras
de domínio (entidades/serviços com repositórios fake).

## Event Bus (comunicação entre módulos)

Módulos **não se chamam diretamente**. Toda interação entre domínios acontece
por eventos, via `core/events` (`eventBus.publish` / `eventBus.subscribe`).

- Catálogo tipado (`core/events/types.ts`): `customer.created/updated`,
  `lead.created`, `deal.created/won`, `whatsapp.message.received/sent`,
  `automation.started/completed/failed`, `user.invited`, `organization.created`.
- Todo evento carrega `organizationId` (multi-tenant).
- F1: barramento **in-memory**; entrega durável (outbox/fila/Realtime) em F3 sem
  mudar a interface.

## Integrações — Provider Interface (isoladas atrás de `server/`)

Nenhuma integração depende de um vendor específico; depende de uma **interface
comum** (`core/integrations/providers`). Adapters por vendor se registram no
`registry`; módulos resolvem pela capability.

- Interfaces: `WhatsAppProvider`, `AIProvider`, `EmailProvider`, `SMSProvider`,
  `StorageProvider`, `PaymentProvider`.
- Vendor ativo em `config/providers.ts` — trocável sem alterar módulos
  (Meta→Evolution, Claude→OpenAI, Resend→SendGrid, Stripe→Mercado Pago).
- **WhatsApp Cloud API** — webhook + envio (F3). **IA** — completions + créditos
  (F3). **Billing (Stripe)** — checkout + webhooks (F4).

## Convenções

- Alias `@/*` → `src/*`.
- Imports de UI compartilhada: `@/components/shared/*` e `@/components/layout/*`.
- Nada de `src/server/**` importado em componentes de cliente.
- Rotas permanecem finas; a lógica vive nas features.
- O Design System (`styles.css` + tokens) é imutável fora de decisão explícita.
