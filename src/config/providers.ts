/**
 * Vendor ativo por capability de integração.
 *
 * Os módulos consomem a Provider Interface (src/core/integrations/providers) —
 * nunca um fornecedor específico. Este mapa apenas seleciona qual adapter será
 * registrado no runtime, permitindo trocar de vendor SEM alterar módulos.
 *
 * Roadmap de troca (exemplos): Meta→Evolution · Claude→OpenAI ·
 * Resend→SendGrid · Stripe→Mercado Pago. Segredos por vendor: ver `.env.example`.
 */
export type ProviderVendors = {
  whatsapp: "meta" | "evolution";
  ai: "claude" | "openai";
  email: "resend" | "sendgrid";
  sms: "twilio" | "zenvia";
  storage: "supabase" | "s3";
  payment: "stripe" | "mercadopago";
};

export const activeProviders: ProviderVendors = {
  whatsapp: "meta",
  ai: "claude",
  email: "resend",
  sms: "twilio",
  storage: "supabase",
  payment: "stripe",
};
