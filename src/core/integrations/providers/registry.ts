import type {
  Provider,
  ProviderKind,
  WhatsAppProvider,
  AIProvider,
  EmailProvider,
  SMSProvider,
  StorageProvider,
  PaymentProvider,
} from "@/core/integrations/providers/types";

/**
 * Registro de providers. As implementações concretas (por vendor) se registram
 * aqui na inicialização do servidor (F3/F4); os módulos resolvem pela capability
 * e recebem sempre a interface — nunca o fornecedor.
 */
const registry = new Map<ProviderKind, Provider>();

export function registerProvider(provider: Provider): void {
  registry.set(provider.kind as ProviderKind, provider);
}

function resolve<T extends Provider>(kind: ProviderKind): T {
  const provider = registry.get(kind);
  if (!provider) {
    throw new Error(
      `Provider '${kind}' não configurado. Registre um adapter de vendor ` +
        `(ver src/config/providers.ts e src/core/integrations/providers). Ativação em F3/F4.`,
    );
  }
  return provider as T;
}

export const getWhatsAppProvider = () => resolve<WhatsAppProvider>("whatsapp");
export const getAIProvider = () => resolve<AIProvider>("ai");
export const getEmailProvider = () => resolve<EmailProvider>("email");
export const getSMSProvider = () => resolve<SMSProvider>("sms");
export const getStorageProvider = () => resolve<StorageProvider>("storage");
export const getPaymentProvider = () => resolve<PaymentProvider>("payment");
