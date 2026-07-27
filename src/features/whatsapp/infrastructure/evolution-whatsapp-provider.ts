import type {
  WhatsAppProvider,
  WhatsAppCredentials,
  WhatsAppSendResult,
  WhatsAppWebhookBatch,
} from "@/core/integrations/providers/types";

/**
 * EvolutionWhatsAppProvider — adapter alternativo (Evolution API), atrás da MESMA
 * interface WhatsAppProvider. Placeholder: a implementação concreta entra quando
 * a Evolution for habilitada; a existência aqui prova que o módulo não depende da
 * Meta (sem lock-in de vendor).
 */
export class EvolutionWhatsAppProvider implements WhatsAppProvider {
  readonly kind = "whatsapp" as const;
  readonly vendor = "evolution";

  sendText(_input: { credentials: WhatsAppCredentials; to: string; body: string }): Promise<WhatsAppSendResult> {
    throw new Error("EvolutionWhatsAppProvider.sendText: não implementado (habilitar em fase futura).");
  }

  sendTemplate(_input: {
    credentials: WhatsAppCredentials;
    to: string;
    templateName: string;
    language: string;
    components?: unknown[];
  }): Promise<WhatsAppSendResult> {
    throw new Error("EvolutionWhatsAppProvider.sendTemplate: não implementado.");
  }

  markRead(_input: { credentials: WhatsAppCredentials; externalId: string }): Promise<void> {
    throw new Error("EvolutionWhatsAppProvider.markRead: não implementado.");
  }

  parseWebhook(_payload: unknown): WhatsAppWebhookBatch {
    return { messages: [], statuses: [] };
  }
}
