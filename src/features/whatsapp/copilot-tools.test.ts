import { describe, expect, it, vi } from "vitest";
import type { CopilotExecutionContext } from "@/core";
import {
  createWhatsAppConversationSummaryTool,
  createWhatsAppReplyDraftTool,
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
  return { assist };
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
});
