import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { guard } from "@/core/application/guard";
import type { ServiceContext } from "@/core/application/context";
import { assertModuleEnabled } from "@/core/feature-flags";
import { InfrastructureError } from "@/core/errors";
import { isInsightStale, type ConversationInsight } from "@/features/whatsapp/domain";

type InsightResponse = Omit<ConversationInsight, "generatedAt" | "stale"> & {
  tokensIn?: number;
  tokensOut?: number;
};

export class ConversationInsightService {
  constructor(
    private readonly db: SupabaseClient<Database>,
    private readonly ctx: ServiceContext,
  ) {}

  private ensureEnabled() {
    assertModuleEnabled(this.ctx.enabledModules, "whatsapp");
  }

  get(conversationId: string): Promise<ConversationInsight | null> {
    return guard(
      async () => {
        this.ensureEnabled();
        const [insightResult, conversationResult] = await Promise.all([
          this.db
            .from("conversation_insights")
            .select(
              "intent, temperature, urgency, sentiment, summary, next_best_action, suggested_reply, reasons, source_last_message_at, generated_at",
            )
            .eq("organization_id", this.ctx.organizationId)
            .eq("conversation_id", conversationId)
            .maybeSingle(),
          this.db
            .from("conversations")
            .select("last_message_at")
            .eq("organization_id", this.ctx.organizationId)
            .eq("id", conversationId)
            .maybeSingle(),
        ]);
        if (insightResult.error)
          throw new InfrastructureError(insightResult.error.message, {
            cause: insightResult.error,
          });
        if (conversationResult.error)
          throw new InfrastructureError(conversationResult.error.message, {
            cause: conversationResult.error,
          });
        const row = insightResult.data;
        if (!row) return null;
        return {
          intent: row.intent,
          temperature: row.temperature,
          urgency: row.urgency,
          sentiment: row.sentiment,
          summary: row.summary,
          nextBestAction: row.next_best_action,
          suggestedReply: row.suggested_reply,
          reasons: row.reasons,
          generatedAt: row.generated_at,
          stale: isInsightStale(
            row.source_last_message_at,
            conversationResult.data?.last_message_at ?? null,
          ),
        };
      },
      { service: "whatsapp.insight.get", conversationId },
    );
  }

  list(conversationIds: string[]): Promise<Record<string, ConversationInsight>> {
    return guard(
      async () => {
        this.ensureEnabled();
        const ids = [...new Set(conversationIds)].slice(0, 100);
        if (!ids.length) return {};
        const [insightsResult, conversationsResult] = await Promise.all([
          this.db
            .from("conversation_insights")
            .select(
              "conversation_id, intent, temperature, urgency, sentiment, summary, next_best_action, suggested_reply, reasons, source_last_message_at, generated_at",
            )
            .eq("organization_id", this.ctx.organizationId)
            .in("conversation_id", ids),
          this.db
            .from("conversations")
            .select("id, last_message_at")
            .eq("organization_id", this.ctx.organizationId)
            .in("id", ids),
        ]);
        if (insightsResult.error)
          throw new InfrastructureError(insightsResult.error.message, {
            cause: insightsResult.error,
          });
        if (conversationsResult.error)
          throw new InfrastructureError(conversationsResult.error.message, {
            cause: conversationsResult.error,
          });
        const lastMessageById = new Map(
          (conversationsResult.data ?? []).map((item) => [item.id, item.last_message_at]),
        );
        return Object.fromEntries(
          (insightsResult.data ?? []).map((row) => [
            row.conversation_id,
            {
              intent: row.intent,
              temperature: row.temperature,
              urgency: row.urgency,
              sentiment: row.sentiment,
              summary: row.summary,
              nextBestAction: row.next_best_action,
              suggestedReply: row.suggested_reply,
              reasons: row.reasons,
              generatedAt: row.generated_at,
              stale: isInsightStale(
                row.source_last_message_at,
                lastMessageById.get(row.conversation_id) ?? null,
              ),
            },
          ]),
        );
      },
      { service: "whatsapp.insight.list" },
    );
  }

  analyze(conversationId: string): Promise<InsightResponse> {
    return guard(
      async () => {
        this.ensureEnabled();
        const { data, error } = await this.db.functions.invoke("ai-whatsapp-assist", {
          body: { conversationId, mode: "insight" },
        });
        if (error) throw new InfrastructureError(error.message, { cause: error });
        if (!data?.summary || !data?.nextBestAction)
          throw new InfrastructureError("A IA não retornou uma análise válida.");
        return data as InsightResponse;
      },
      { service: "whatsapp.insight.analyze", conversationId },
    );
  }
}
