import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { InfrastructureError } from "@/core";
import type {
  ConversationAIResult,
  ConversationToolInput,
  WhatsAppAssistant,
} from "@/features/whatsapp/copilot-tools";
import { normalizeCommerceAnalysis, type CommerceAnalysis } from "@/features/whatsapp/domain";

/** O browser envia somente o id; a Edge Function lê a conversa sob RLS. */
export class SupabaseWhatsAppAssistant implements WhatsAppAssistant {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async assist(
    input: ConversationToolInput & { mode: "summary" | "draft" },
  ): Promise<ConversationAIResult> {
    const { data, error } = await this.db.functions.invoke("ai-whatsapp-assist", {
      body: input,
    });
    if (error) throw new InfrastructureError(error.message, { cause: error });
    if (!data?.text) throw new InfrastructureError("A IA não retornou uma resposta.");
    return {
      text: String(data.text),
      tokensIn: Number(data.tokensIn ?? 0),
      tokensOut: Number(data.tokensOut ?? 0),
    };
  }

  async analyzeCommerce(
    input: ConversationToolInput,
  ): Promise<CommerceAnalysis & { tokensIn: number; tokensOut: number }> {
    const { data, error } = await this.db.functions.invoke("ai-whatsapp-assist", {
      body: { ...input, mode: "commerce" },
    });
    if (error) throw new InfrastructureError(error.message, { cause: error });
    const analysis = normalizeCommerceAnalysis(data);
    return {
      ...analysis,
      tokensIn: Number(data?.tokensIn ?? 0),
      tokensOut: Number(data?.tokensOut ?? 0),
    };
  }
}
