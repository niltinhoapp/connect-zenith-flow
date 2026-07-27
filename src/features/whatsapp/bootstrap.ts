import { registerProvider } from "@/core/integrations/providers/registry";
import { activeProviders } from "@/config/providers";
import { MetaWhatsAppProvider } from "./infrastructure/meta-whatsapp-provider";
import { EvolutionWhatsAppProvider } from "./infrastructure/evolution-whatsapp-provider";

/**
 * Registra o adapter de WhatsApp conforme `activeProviders.whatsapp` (composition
 * root). Chamado na inicialização do servidor/worker. Trocar de vendor é só
 * mudar `src/config/providers.ts` — nenhum módulo muda.
 */
export function registerWhatsAppProvider(): void {
  registerProvider(
    activeProviders.whatsapp === "evolution"
      ? new EvolutionWhatsAppProvider()
      : new MetaWhatsAppProvider(),
  );
}
