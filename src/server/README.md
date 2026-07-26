# server/

Trusted server-side code — executed inside TanStack Start **server functions**
and SSR only, never shipped to the browser bundle. This is where secrets and
privileged operations live.

## Contents

| File | Purpose | Phase |
| --- | --- | --- |
| `supabase.ts` | Request-scoped and service-role Supabase clients | scaffolded (F0) → F1 |

## Planned (F1+)

- `auth.ts` — session helpers, `requireUser()` / `requireOrg()` guards used by route `beforeLoad`.
- `integrations/whatsapp.ts` — WhatsApp Cloud API webhook + send (F3).
- `integrations/ai.ts` — AI provider calls, credit metering (F3).
- `integrations/billing.ts` — Stripe checkout + webhook (F4).

## Rules

- Never import anything from `src/server/**` into client components.
- Read secrets from `process.env` (see `.env.example`), not from `src/lib/env.ts`.
- The admin client bypasses RLS — always scope queries by `organization_id`.
