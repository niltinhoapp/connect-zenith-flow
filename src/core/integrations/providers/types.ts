/**
 * Core · Integrations · Providers — interfaces de fornecedor.
 *
 * Toda integração externa é acessada por uma INTERFACE comum, nunca por um
 * fornecedor específico. Isso permite trocar o vendor sem alterar módulos:
 *   WhatsApp: Meta → Evolution API
 *   IA:       Claude → OpenAI
 *   E-mail:   Resend → SendGrid
 *   Pagamento: Stripe → Mercado Pago
 *
 * As implementações concretas (adapters por vendor) chegam nas fases das
 * integrações (F3/F4) e se registram no `registry`. Todo método é multi-tenant.
 */

export interface Provider {
  /** Capability implementada (ex: "whatsapp"). */
  readonly kind: string;
  /** Fornecedor concreto (ex: "meta", "evolution"). */
  readonly vendor: string;
}

export interface WhatsAppProvider extends Provider {
  kind: "whatsapp";
  sendMessage(input: {
    organizationId: string;
    to: string;
    body: string;
  }): Promise<{ externalId: string }>;
  /** Interpreta o payload de webhook do fornecedor num formato neutro. */
  parseWebhook(payload: unknown): {
    from: string;
    body: string;
    externalId: string;
  } | null;
}

export interface AIProvider extends Provider {
  kind: "ai";
  complete(input: {
    organizationId: string;
    prompt: string;
    system?: string;
    maxTokens?: number;
  }): Promise<{ text: string; tokensIn: number; tokensOut: number }>;
}

export interface EmailProvider extends Provider {
  kind: "email";
  send(input: {
    organizationId: string;
    to: string;
    subject: string;
    html: string;
  }): Promise<{ id: string }>;
}

export interface SMSProvider extends Provider {
  kind: "sms";
  send(input: { organizationId: string; to: string; body: string }): Promise<{ id: string }>;
}

export interface StorageProvider extends Provider {
  kind: "storage";
  createSignedUploadUrl(input: {
    organizationId: string;
    path: string;
  }): Promise<{ url: string }>;
  getPublicUrl(input: { organizationId: string; path: string }): string;
}

export interface PaymentProvider extends Provider {
  kind: "payment";
  createCheckout(input: {
    organizationId: string;
    planId: string;
  }): Promise<{ url: string }>;
}

export type AnyProvider =
  | WhatsAppProvider
  | AIProvider
  | EmailProvider
  | SMSProvider
  | StorageProvider
  | PaymentProvider;

export type ProviderKind = AnyProvider["kind"];
