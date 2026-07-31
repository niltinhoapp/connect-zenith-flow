import { describe, it, expect } from "vitest";
import { WaContact } from "./value-objects/wa-contact";
import { Conversation } from "./entities/conversation";
import { Message } from "./entities/message";
import { WhatsAppTemplate } from "./entities/whatsapp-template";

describe("WhatsApp · WaContact", () => {
  it("normaliza para apenas dígitos (E.164 sem '+')", () => {
    expect(WaContact.create("+55 (11) 98888-7777").waId).toBe("5511988887777");
  });
  it("rejeita número inválido", () => {
    expect(() => WaContact.create("123")).toThrow();
  });
});

describe("WhatsApp · Conversation", () => {
  it("começa aberta e sem janela de 24h até receber mensagem", () => {
    const c = Conversation.create({ organizationId: "o", contactWaId: "5511988887777" });
    expect(c.status).toBe("open");
    expect(c.isWithinWindow()).toBe(false);
    expect(c.canSendFreeform()).toBe(false);
  });

  it("respeita a janela de 24h", () => {
    const c = Conversation.fromPersistence({
      id: "c",
      organizationId: "o",
      accountId: null,
      phoneNumberId: null,
      contactWaId: "5511988887777",
      contactName: null,
      customerId: null,
      status: "open",
      assignedTo: null,
      unreadCount: 1,
      lastMessageAt: null,
      lastMessagePreview: null,
      lastInboundAt: new Date().toISOString(),
      windowExpiresAt: new Date(Date.now() + 3600_000).toISOString(),
      tags: [],
      createdAt: "",
      updatedAt: "",
      deletedAt: null,
    });
    expect(c.isWithinWindow()).toBe(true);
    expect(c.canSendFreeform()).toBe(true);
  });

  it("atribui e encerra", () => {
    const c = Conversation.create({ organizationId: "o", contactWaId: "5511988887777" });
    c.assignTo("user-1");
    expect(c.assignedTo).toBe("user-1");
    c.close();
    expect(c.status).toBe("closed");
    expect(() => c.close()).toThrow();
  });
});

describe("WhatsApp · Message", () => {
  it("exige corpo em texto e template em template", () => {
    expect(() =>
      Message.createOutbound({ organizationId: "o", conversationId: "c", body: "" }),
    ).toThrow();
    expect(() =>
      Message.createOutbound({ organizationId: "o", conversationId: "c", type: "template" }),
    ).toThrow();
  });

  it("marca enviada com wa_message_id", () => {
    const m = Message.createOutbound({ organizationId: "o", conversationId: "c", body: "oi" });
    expect(m.status).toBe("pending");
    m.markSent("wamid.1");
    expect(m.status).toBe("sent");
  });

  it("avança status monotonicamente (sent→delivered→read)", () => {
    const m = Message.createOutbound({ organizationId: "o", conversationId: "c", body: "oi" });
    m.markSent("wamid.1");
    m.advanceStatus("read");
    m.advanceStatus("delivered"); // não regride
    expect(m.status).toBe("read");
  });

  it("failed é registrado", () => {
    const m = Message.createOutbound({ organizationId: "o", conversationId: "c", body: "oi" });
    m.markFailed({ code: 131 });
    expect(m.status).toBe("failed");
  });
});

describe("WhatsApp · WhatsAppTemplate", () => {
  it("normaliza o nome e monta components (header/body/footer)", () => {
    const t = WhatsAppTemplate.create({
      organizationId: "o",
      name: "Boas Vindas",
      bodyText: "Olá!",
      headerText: "Oi",
      footerText: "Equipe",
    });
    expect(t.name).toBe("boas_vindas");
    expect(t.status).toBe("pending");
    expect(t.bodyText).toBe("Olá!");
    const types = (t.toJSON().components as Array<{ type: string }>).map((c) => c.type);
    expect(types).toEqual(["HEADER", "BODY", "FOOTER"]);
  });

  it("rejeita nome inválido e corpo vazio", () => {
    expect(() =>
      WhatsAppTemplate.create({ organizationId: "o", name: "a b!", bodyText: "x" }),
    ).toThrow();
    expect(() =>
      WhatsAppTemplate.create({ organizationId: "o", name: "ok", bodyText: "" }),
    ).toThrow();
  });
});
