# core/ — Plataforma (Core plugin architecture)

O **Core** é a plataforma sobre a qual os módulos de negócio rodam. Ele concentra
as capacidades transversais e é a **única** superfície que os módulos podem
consumir.

## Domínios do Core

| Domínio | Responsabilidade | Status |
| --- | --- | --- |
| `auth` | Autenticação, sessão SSR, provisionamento, guards | ✅ F1 |
| `organizations` | Organização ativa, multi-org, membros | ✅ F1 |
| `permissions` | Catálogo de permissões + checagem (RBAC) | ✅ F1 |
| `audit` | Trilha de auditoria (append-only) | ✅ F1 (infra) |
| `events` | Event Bus tipado (comunicação entre módulos) | ✅ F1 (in-memory) |
| `integrations` | Provider Interface (WhatsApp, IA, e-mail, pagamento…) | ✅ F1 (interfaces) · 🔜 F3/F4 (adapters) |
| `billing` | Planos, assinatura, uso | 🔜 F4 |
| `notifications` | In-app, e-mail, realtime | 🔜 F3 |

## Regras da arquitetura de plugins

1. **Módulos consomem o Core, nunca o contrário.** `src/features/*` importa de
   `@/core` (barrel público). O Core não conhece nenhum módulo.
2. **Módulo não acessa módulo.** Nenhum `features/x` importa de `features/y`.
   Qualquer interação entre domínios passa por um serviço do Core.
3. **Fronteira única.** Importar sempre de `@/core` (ou `@/core/<domínio>`), não
   de arquivos internos de outro domínio.
4. **Isolamento de dados.** Todo dado é escopado por `organization_id` + RLS
   (ver `docs/DATABASE.md`). A organização ativa vem da sessão do Core.
5. **Comunicação entre módulos = eventos.** Um módulo nunca chama outro
   diretamente (nem via Core). Ele **publica** um evento e outros **reagem**.
6. **Integrações = interfaces.** Nenhum código depende de um vendor específico;
   depende da Provider Interface. O vendor ativo é configuração.

> Essa fronteira é hoje uma convenção documentada; uma regra de ESLint
> (`import/no-restricted-paths`) pode passar a forçá-la na F5.

## Comunicação entre módulos — Event Bus (`core/events`)

```ts
import { eventBus } from "@/core";

// Publicar (o produtor não sabe quem escuta):
await eventBus.publish("deal.won", { organizationId, dealId, amount });

// Reagir em outro módulo (o consumidor não conhece o produtor):
eventBus.subscribe("deal.won", async (event) => {
  // ex.: notifications reage, billing reage — desacoplados
});
```

- Catálogo tipado em `core/events/types.ts` (`customer.created`, `lead.created`,
  `deal.won`, `whatsapp.message.*`, `automation.*`, `organization.created`, …).
- Todo evento carrega `organizationId` (multi-tenant).
- F1: barramento **in-memory**. A entrega durável (outbox no Postgres / fila /
  Supabase Realtime) entra na F3 **sem mudar a interface**.

## Integrações — Provider Interface (`core/integrations/providers`)

Cada capability externa tem uma interface comum; os adapters por vendor se
registram no `registry` e os módulos resolvem pela capability:

```ts
import { getWhatsAppProvider } from "@/core";
const wa = getWhatsAppProvider();               // devolve a INTERFACE
await wa.sendMessage({ organizationId, to, body });
```

Interfaces: `WhatsAppProvider`, `AIProvider`, `EmailProvider`, `SMSProvider`,
`StorageProvider`, `PaymentProvider`. Troca de vendor sem tocar módulos
(Meta→Evolution, Claude→OpenAI, Resend→SendGrid, Stripe→Mercado Pago) —
o vendor ativo fica em `src/config/providers.ts`.
