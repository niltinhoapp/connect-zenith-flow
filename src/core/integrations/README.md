# core/integrations — Integrations (Provider Interface)

Conectores externos atrás de uma **camada de abstração de fornecedor**. Nenhuma
integração depende de um vendor específico — depende de uma interface comum.

- **Camada:** Core (consumido pelos módulos via `@/core`).
- **Interfaces (`providers/types.ts`):** `WhatsAppProvider`, `AIProvider`,
  `EmailProvider`, `SMSProvider`, `StorageProvider`, `PaymentProvider`.
- **Registro (`providers/registry.ts`):** adapters por vendor se registram e os
  módulos resolvem pela capability (`getWhatsAppProvider()`, …).
- **Vendor ativo:** `src/config/providers.ts` (trocável sem alterar módulos).

## Troca de vendor sem tocar módulos

| Capability | Padrão | Alternativa |
| --- | --- | --- |
| WhatsApp | Meta Cloud API | Evolution API |
| IA | Claude | OpenAI |
| E-mail | Resend | SendGrid |
| Pagamento | Stripe | Mercado Pago |

## Status

- **F1:** interfaces + registry (esta camada). Nenhum adapter concreto ainda.
- **F3:** adapters de WhatsApp / IA / e-mail + webhooks.
- **F4:** adapter de pagamento (billing).
