import type { WhatsAppProvider } from "@/core/integrations/providers/types";

/** Envelope de contexto retornado por wa_send_context (service_role). */
export interface WhatsAppSendContext {
  organization_id: string;
  message_id: string;
  status: string;
  type: string;
  body: string | null;
  to: string;
  provider: "meta" | "evolution" | null;
  phone_number_id: string | null;
  access_token: string | null;
  template: { name: string; language: string; components: unknown[] } | null;
}

/**
 * Porta de acesso a dados usada pelo handler (implementada via RPC/fetch no
 * worker). Mantém o handler testável e desacoplado do transporte.
 */
export interface WhatsAppGateway {
  sendContext(messageId: string): Promise<WhatsAppSendContext | null>;
  markSent(org: string, messageId: string, externalId: string): Promise<void>;
  markFailed(org: string, messageId: string, error: Record<string, unknown>): Promise<void>;
  /** Idempotência de despacho (claim_idempotency): true na 1ª vez. */
  claim(org: string, key: string): Promise<boolean>;
}

/** Erro permanente (não deve ser re-tentado) vs. transitório (retry). */
export class PermanentSendError extends Error {}

/**
 * createWhatsAppSendHandler — handler do job `whatsapp.send`.
 * Fluxo: resolve contexto → (idempotência de despacho) → Provider.send →
 * registra `wa_message_id`+status. Erros permanentes marcam a mensagem como
 * failed; transitórios são relançados para retry/backoff da fila.
 */
export function createWhatsAppSendHandler(provider: WhatsAppProvider, gateway: WhatsAppGateway) {
  return async function handle(job: { payload?: { message_id?: string } }): Promise<void> {
    const messageId = job.payload?.message_id;
    if (!messageId) throw new PermanentSendError("whatsapp.send: payload sem message_id");

    const ctx = await gateway.sendContext(messageId);
    if (!ctx) throw new PermanentSendError("whatsapp.send: mensagem inexistente");
    if (ctx.status !== "pending") return; // já processada (idempotente)

    if (!ctx.phone_number_id || !ctx.access_token) {
      await gateway.markFailed(ctx.organization_id, messageId, {
        reason: "conta sem credencial/numero",
      });
      return;
    }

    // Idempotência de despacho: evita reenvio se o lease for reivindicado.
    const first = await gateway.claim(ctx.organization_id, `whatsapp.send:dispatch:${messageId}`);
    if (!first) return;

    const credentials = { accessToken: ctx.access_token, phoneNumberId: ctx.phone_number_id };
    try {
      let result;
      if (ctx.type === "template") {
        if (!ctx.template) throw new PermanentSendError("whatsapp.send: template ausente");
        result = await provider.sendTemplate({
          credentials,
          to: ctx.to,
          templateName: ctx.template.name,
          language: ctx.template.language,
          components: ctx.template.components,
        });
      } else {
        result = await provider.sendText({ credentials, to: ctx.to, body: ctx.body ?? "" });
      }
      await gateway.markSent(ctx.organization_id, messageId, result.externalId);
    } catch (err) {
      if (err instanceof PermanentSendError) {
        await gateway.markFailed(ctx.organization_id, messageId, { message: err.message });
        return;
      }
      throw err; // transitório → retry/backoff
    }
  };
}
