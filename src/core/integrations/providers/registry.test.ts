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
    const creds = { accessToken: "t", phoneNumberId: "p" };
    const fake: WhatsAppProvider = {
      kind: "whatsapp",
      vendor: "fake",
      async sendText() {
        return { externalId: "x1" };
      },
      async sendTemplate() {
        return { externalId: "x2" };
      },
      async markRead() {},
      async uploadMedia() {
        return { mediaId: "m1" };
      },
      async sendMedia() {
        return { externalId: "x3" };
      },
      async downloadMedia() {
        return { bytes: new Uint8Array(), mime: "image/png" };
      },
      parseWebhook() {
        return { messages: [], statuses: [] };
      },
    };
    registerProvider(fake);

    const wa = getWhatsAppProvider();
    expect(wa.vendor).toBe("fake");
    expect(await wa.sendText({ credentials: creds, to: "+55", body: "oi" })).toEqual({
      externalId: "x1",
    });
  });
});
