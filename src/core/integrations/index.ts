/**
 * Core · Integrations — barrel público.
 *
 * Expõe as interfaces de fornecedor (Provider Interface). Integrações concretas
 * (WhatsApp Cloud API, IA, e-mail, pagamento…) são adapters por vendor,
 * registrados no `registry` em F3/F4. Ver `src/core/integrations/README.md`.
 */
export * from "@/core/integrations/providers";
