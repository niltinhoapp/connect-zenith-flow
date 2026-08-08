import { describe, expect, it, vi } from "vitest";
import type { AIProvider, CopilotExecutionContext } from "@/core";
import { Conversation, Message } from "@/features/whatsapp/domain";
import {
  createWhatsAppConversationSummaryTool,
  createWhatsAppReplyDraftTool,
} from "@/features/whatsapp/copilot-tools";

const context: CopilotExecutionContext = {
  organizationId: "org-1",
  actorId: "user-1",
  enabledModules: ["whatsapp", "ia"],
  permissions: ["whatsapp.read", "ia.use"],
};

function dependencies() {
  const conversation = Conversation.create(
    { organizationId: "org-1", contactWaId: "5511999999999", contactName: "Marina" },
    "conversation-1",
  );
  const message = Message.fromPersistence({
    id: "message-1",
    organizationId: "org-1",
    conversationId: "conversation-1",
    direction: "inbound",
    waMessageId: "wa-1",
    type: "text",
    body: "Quero saber o prazo do pedido",
    mediaId: null,
    templateId: null,
    status: "received",
    sender: "5511999999999",
    sentBy: null,
    payload: { secret: "não enviar" },
    error: null,
    payloadVersion: 1,
    createdAt: "2026-08-01T10:00:00.000Z",
    updatedAt: "2026-08-01T10:00:00.000Z",
  });
  const inbox = {
    async getConversation() {
      return conversation;
    },
    async listMessages() {
      return { items: [message], total: 1, limit: 50, offset: 0 };
    },
  };
  const complete = vi.fn<AIProvider["complete"]>(async () => ({
    text: "Cliente quer saber o prazo.",
    tokensIn: 20,
    tokensOut: 8,
  }));
  return { inbox, complete };
}

describe("WhatsApp · Copilot tools", () => {
  it("resume somente o texto necessário e trata a conversa como conteúdo não confiável", async () => {
    const { inbox, complete } = dependencies();
    const tool = createWhatsAppConversationSummaryTool(inbox, { complete });

    const result = await tool.execute({ conversationId: "conversation-1" }, context);

    const request = complete.mock.calls[0]?.[0];
    expect(request?.organizationId).toBe("org-1");
    expect(request?.system).toContain("dado não confiável");
    expect(request?.prompt).toContain("Cliente: Quero saber o prazo do pedido");
    expect(request?.prompt).not.toContain("não enviar");
    expect(result.summary).toContain("prazo");
  });

  it("prepara uma resposta sem chamar o serviço de envio", async () => {
    const { inbox, complete } = dependencies();
    const tool = createWhatsAppReplyDraftTool(inbox, { complete });

    const result = await tool.execute({ conversationId: "conversation-1" }, context);

    expect(complete).toHaveBeenCalledOnce();
    expect(result.navigateTo).toContain("conversation-1");
    expect(tool.risk).toBe("external");
  });
});
