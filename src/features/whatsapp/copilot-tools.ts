import { PERMISSIONS, registerCopilotTool } from "@/core";
import type { CopilotTool } from "@/core";

export interface ConversationToolInput {
  conversationId: string;
}

export interface ConversationAIResult {
  text: string;
  tokensIn: number;
  tokensOut: number;
}

export interface WhatsAppAssistant {
  assist(input: ConversationToolInput & { mode: "summary" | "draft" }): Promise<ConversationAIResult>;
}

function requireConversationId(input: ConversationToolInput): void {
  if (!input.conversationId?.trim()) throw new Error("Selecione uma conversa primeiro.");
}

export function createWhatsAppConversationSummaryTool(
  assistant: WhatsAppAssistant,
): CopilotTool<ConversationToolInput, ConversationAIResult> {
  return {
    name: "whatsapp.conversation.summarize",
    title: "Resumir conversa",
    description: "Resume o atendimento, a intenção do cliente e os próximos passos.",
    module: "whatsapp",
    permissions: [PERMISSIONS.WHATSAPP_READ, PERMISSIONS.IA_USE],
    risk: "external",
    async execute(input) {
      requireConversationId(input);
      const result = await assistant.assist({ conversationId: input.conversationId, mode: "summary" });
      return {
        summary: result.text,
        data: result,
        navigateTo: `/whatsapp?conversation=${encodeURIComponent(input.conversationId)}`,
      };
    },
  };
}

export function createWhatsAppReplyDraftTool(
  assistant: WhatsAppAssistant,
): CopilotTool<ConversationToolInput, ConversationAIResult> {
  return {
    name: "whatsapp.reply.draft",
    title: "Preparar resposta",
    description: "Prepara uma resposta clara para revisão, sem enviar ao cliente.",
    module: "whatsapp",
    permissions: [PERMISSIONS.WHATSAPP_READ, PERMISSIONS.IA_USE],
    risk: "external",
    async execute(input) {
      requireConversationId(input);
      const result = await assistant.assist({ conversationId: input.conversationId, mode: "draft" });
      return {
        summary: result.text,
        data: result,
        navigateTo: `/whatsapp?conversation=${encodeURIComponent(input.conversationId)}`,
      };
    },
  };
}

export function registerWhatsAppCopilotTools(assistant: WhatsAppAssistant): void {
  registerCopilotTool(createWhatsAppConversationSummaryTool(assistant));
  registerCopilotTool(createWhatsAppReplyDraftTool(assistant));
}

