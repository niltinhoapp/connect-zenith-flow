import { PERMISSIONS, registerCopilotTool } from "@/core";
import type { CopilotTool } from "@/core";
import type { CommerceCrmApplicationService, RegisterCommerceInput, RegisterCommerceResult } from "./application/commerce-crm-service";
import {
  formatCommerceAnalysis,
  normalizeCommerceAnalysis,
  type CommerceAnalysis,
} from "@/features/whatsapp/domain";

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
  analyzeCommerce(input: ConversationToolInput): Promise<CommerceAnalysis & { tokensIn: number; tokensOut: number }>;
}

function requireConversationId(input: ConversationToolInput): void {
  if (!input.conversationId?.trim()) throw new Error("Selecione uma conversa primeiro.");
}

export function createCommerceRegisterCrmTool(service: Pick<CommerceCrmApplicationService, "register">): CopilotTool<RegisterCommerceInput, RegisterCommerceResult> {
  return {
    name: "whatsapp.commerce.register_crm",
    title: "Registrar no CRM",
    description: "Vincula o cliente e cria ou atualiza o negócio deste pedido após confirmação.",
    module: "whatsapp",
    permissions: [PERMISSIONS.WHATSAPP_READ, PERMISSIONS.CLIENTES_WRITE, PERMISSIONS.CRM_WRITE],
    risk: "write",
    async execute(input) {
      if (!input?.conversationId || !input?.analysis) throw new Error("Analise a conversa antes de registrar no CRM.");
      const data = await service.register(input);
      return { summary: `${data.customer.created ? "Cliente criado" : "Cliente vinculado"}: ${data.customer.name}. Negócio ${data.deal.created ? "criado" : "atualizado"}: ${data.deal.title}.`, data, navigateTo: "/crm" };
    },
  };
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

export function createWhatsAppCommerceAssistantTool(
  assistant: WhatsAppAssistant,
): CopilotTool<ConversationToolInput, CommerceAnalysis> {
  return {
    name: "whatsapp.commerce.analyze",
    title: "Organizar atendimento comercial",
    description: "Identifica pedido, entrega, pagamento e pendências e prepara a próxima resposta.",
    module: "whatsapp",
    permissions: [PERMISSIONS.WHATSAPP_READ, PERMISSIONS.IA_USE],
    risk: "external",
    async execute(input) {
      requireConversationId(input);
      const result = normalizeCommerceAnalysis(await assistant.analyzeCommerce(input));
      return {
        summary: formatCommerceAnalysis(result),
        data: result,
        navigateTo: `/whatsapp?conversation=${encodeURIComponent(input.conversationId)}`,
      };
    },
  };
}

export function registerWhatsAppCopilotTools(assistant: WhatsAppAssistant): void {
  registerCopilotTool(createWhatsAppConversationSummaryTool(assistant));
  registerCopilotTool(createWhatsAppReplyDraftTool(assistant));
  registerCopilotTool(createWhatsAppCommerceAssistantTool(assistant));
}
