import { describe, it, expect, vi } from "vitest";
import type { WhatsAppProvider } from "@/core/integrations/providers/types";
import {
  createWhatsAppSendHandler,
  type WhatsAppGateway,
  type WhatsAppSendContext,
} from "./whatsapp-job-handlers";
import { MetaWhatsAppProvider } from "./meta-whatsapp-provider";

function fakeProvider(overrides: Partial<WhatsAppProvider> = {}): WhatsAppProvider {
  return {
    kind: "whatsapp",
    vendor: "fake",
    sendText: vi.fn(async () => ({ externalId: "wamid.sent" })),
    sendTemplate: vi.fn(async () => ({ externalId: "wamid.tpl" })),
    markRead: vi.fn(async () => {}),
    parseWebhook: () => ({ messages: [], statuses: [] }),
    ...overrides,
  };
}

function fakeGateway(ctx: WhatsAppSendContext | null): WhatsAppGateway & {
  sent: [string, string, string][];
  failed: [string, string, Record<string, unknown>][];
} {
  const sent: [string, string, string][] = [];
  const failed: [string, string, Record<string, unknown>][] = [];
  const claimed = new Set<string>();
  return {
    sent,
    failed,
    async sendContext() { return ctx; },
    async markSent(o, m, e) { sent.push([o, m, e]); },
    async markFailed(o, m, e) { failed.push([o, m, e]); },
    async claim(o, k) { if (claimed.has(k)) return false; claimed.add(k); return true; },
  };
}

const baseCtx: WhatsAppSendContext = {
  organization_id: "o", message_id: "m1", status: "pending", type: "text", body: "oi",
  to: "5511988887777", provider: "meta", phone_number_id: "PNID", access_token: "TOKEN", template: null,
};

describe("WhatsApp · send handler", () => {
  it("envia texto e marca sent", async () => {
    const provider = fakeProvider();
    const gw = fakeGateway(baseCtx);
    await createWhatsAppSendHandler(provider, gw)({ payload: { message_id: "m1" } });
    expect(provider.sendText).toHaveBeenCalledOnce();
    expect(gw.sent).toEqual([["o", "m1", "wamid.sent"]]);
  });

  it("é idempotente: não reenvia se status != pending", async () => {
    const provider = fakeProvider();
    const gw = fakeGateway({ ...baseCtx, status: "sent" });
    await createWhatsAppSendHandler(provider, gw)({ payload: { message_id: "m1" } });
    expect(provider.sendText).not.toHaveBeenCalled();
    expect(gw.sent).toEqual([]);
  });

  it("marca failed (sem token) sem chamar o provider", async () => {
    const provider = fakeProvider();
    const gw = fakeGateway({ ...baseCtx, access_token: null });
    await createWhatsAppSendHandler(provider, gw)({ payload: { message_id: "m1" } });
    expect(provider.sendText).not.toHaveBeenCalled();
    expect(gw.failed[0][1]).toBe("m1");
  });

  it("relança erro transitório para retry", async () => {
    const provider = fakeProvider({ sendText: vi.fn(async () => { throw new Error("network"); }) });
    const gw = fakeGateway(baseCtx);
    await expect(
      createWhatsAppSendHandler(provider, gw)({ payload: { message_id: "m1" } }),
    ).rejects.toThrow("network");
    expect(gw.sent).toEqual([]);
  });
});

describe("WhatsApp · MetaWhatsAppProvider.parseWebhook", () => {
  it("extrai mensagens e status de um envelope da Meta", () => {
    const provider = new MetaWhatsAppProvider();
    const batch = provider.parseWebhook({
      entry: [{ changes: [{ value: {
        metadata: { phone_number_id: "PNID" },
        contacts: [{ profile: { name: "Ana" }, wa_id: "5511988887777" }],
        messages: [{ from: "5511988887777", id: "wamid.in", type: "text", text: { body: "olá" }, timestamp: "1700000000" }],
        statuses: [{ id: "wamid.out", status: "delivered", timestamp: "1700000100", recipient_id: "5511988887777" }],
      } }] }],
    });
    expect(batch.messages).toHaveLength(1);
    expect(batch.messages[0]).toMatchObject({ from: "5511988887777", body: "olá", contactName: "Ana", phoneNumberId: "PNID" });
    expect(batch.statuses).toEqual([
      expect.objectContaining({ externalId: "wamid.out", status: "delivered" }),
    ]);
  });
});
