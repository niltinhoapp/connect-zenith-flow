import { describe, expect, it, vi } from "vitest";
import type { CopilotExecutionContext } from "@/core";
import {
  createWhatsAppConversationSummaryTool,
  createWhatsAppReplyDraftTool,
  createWhatsAppCommerceAssistantTool,
  type WhatsAppAssistant,
} from "@/features/whatsapp/copilot-tools";

const context: CopilotExecutionContext = {
  organizationId: "org-1",
  actorId: "user-1",
  enabledModules: ["whatsapp", "ia"],
  permissions: ["whatsapp.read", "ia.use"],
};

function assistant() {
  const assist = vi.fn<WhatsAppAssistant["assist"]>(async () => ({
    text: "Cliente quer saber o prazo.",
    tokensIn: 20,
    tokensOut: 8,
  }));
  const analyzeCommerce = vi.fn<WhatsAppAssistant["analyzeCommerce"]>(async () => ({
    intent: "order", stage: "collecting_payment", items: [{ description: "X-bacon", quantity: 2 }],
    fulfillment: "delivery", address: "Rua A, 10", paymentMethod: null,
    cashForCents: null, orderTotalCents: 8200, changeCents: null, confirmed: false,
    missingFields: ["forma de pagamento"], needsHuman: false, confidence: "high",
    suggestedReply: "Qual será a forma de pagamento?", warnings: [], tokensIn: 30, tokensOut: 15,
  }));
  return { assist, analyzeCommerce };
}

describe("WhatsApp · Copilot tools", () => {
  it("envia somente o id da conversa e o modo para o adapter seguro", async () => {
    const service = assistant();
    const tool = createWhatsAppConversationSummaryTool(service);
    const result = await tool.execute({ conversationId: "conversation-1" }, context);

    expect(service.assist).toHaveBeenCalledWith({
      conversationId: "conversation-1",
      mode: "summary",
    });
    expect(result.summary).toContain("prazo");
  });

  it("prepara resposta sem possuir qualquer capacidade de envio", async () => {
    const service = assistant();
    const tool = createWhatsAppReplyDraftTool(service);
    const result = await tool.execute({ conversationId: "conversation-1" }, context);

    expect(service.assist).toHaveBeenCalledWith({
      conversationId: "conversation-1",
      mode: "draft",
    });
    expect(result.navigateTo).toContain("conversation-1");
    expect(tool.risk).toBe("external");
  });

  it("recusa execução sem uma conversa selecionada", async () => {
    const tool = createWhatsAppReplyDraftTool(assistant());
    await expect(tool.execute({ conversationId: "" }, context)).rejects.toThrow(
      "Selecione uma conversa",
    );
  });

  it("organiza o atendimento comercial sem enviar mensagem", async () => {
    const service = assistant();
    const tool = createWhatsAppCommerceAssistantTool(service);
    const result = await tool.execute({ conversationId: "conversation-1" }, context);
    expect(service.analyzeCommerce).toHaveBeenCalledWith({ conversationId: "conversation-1" });
    expect(result.summary).toContain("forma de pagamento");
    expect(result.summary).toContain("revise antes de enviar");
    expect(tool.risk).toBe("external");
  });
});
