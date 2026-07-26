import { describe, it, expect } from "vitest";
import {
  registerProvider,
  getWhatsAppProvider,
  getAIProvider,
  type WhatsAppProvider,
} from "@/core/integrations/providers";

describe("Core · Provider registry", () => {
  it("lança erro quando o provider não está configurado", () => {
    expect(() => getAIProvider()).toThrowError(/não configurado/);
  });

  it("resolve a interface após registrar um adapter (sem lock-in de vendor)", async () => {
    const fake: WhatsAppProvider = {
      kind: "whatsapp",
      vendor: "fake",
      async sendMessage() {
        return { externalId: "x1" };
      },
      parseWebhook() {
        return null;
      },
    };
    registerProvider(fake);

    const wa = getWhatsAppProvider();
    expect(wa.vendor).toBe("fake");
    expect(await wa.sendMessage({ organizationId: "o", to: "+55", body: "oi" })).toEqual({
      externalId: "x1",
    });
  });
});
