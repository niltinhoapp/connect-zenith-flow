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

/** Credenciais resolvidas pelo caller (worker/service_role) — provider é stateless. */
export interface WhatsAppCredentials {
  accessToken: string;
  phoneNumberId: string;
}

export interface WhatsAppSendResult {
  externalId: string; // wa_message_id
}

/** Mensagem recebida, normalizada (independente de vendor). */
export interface WhatsAppInboundMessage {
  from: string; // wa_id do contato
  contactName: string | null;
  externalId: string; // wa_message_id
  type: "text" | "image" | "document" | "audio" | "video" | "sticker" | "location" | "contacts" | "interactive" | "reaction" | "system";
  body: string | null;
  mediaId: string | null;
  phoneNumberId: string; // número que recebeu (Meta phone_number_id)
  raw: unknown;
}

/** Atualização de status de entrega, normalizada. */
export interface WhatsAppStatusUpdate {
  externalId: string; // wa_message_id
  status: "sent" | "delivered" | "read" | "failed";
  occurredAt: string;
  raw: unknown;
}

/** Lote neutro extraído de um envelope de webhook. */
export interface WhatsAppWebhookBatch {
  messages: WhatsAppInboundMessage[];
  statuses: WhatsAppStatusUpdate[];
}

export interface WhatsAppProvider extends Provider {
  kind: "whatsapp";
  sendText(input: {
    credentials: WhatsAppCredentials;
    to: string;
    body: string;
  }): Promise<WhatsAppSendResult>;
  sendTemplate(input: {
    credentials: WhatsAppCredentials;
    to: string;
    templateName: string;
    language: string;
    components?: unknown[];
  }): Promise<WhatsAppSendResult>;
  markRead(input: { credentials: WhatsAppCredentials; externalId: string }): Promise<void>;
  /** Interpreta o payload de webhook do fornecedor num lote neutro. */
  parseWebhook(payload: unknown): WhatsAppWebhookBatch;
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
