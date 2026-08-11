export type ConversationIntent = "sale" | "support" | "billing" | "post_sale" | "other";
export type ConversationTemperature = "hot" | "warm" | "cold";
export type ConversationUrgency = "high" | "medium" | "low";
export type ConversationSentiment = "positive" | "neutral" | "negative";

export interface ConversationInsight {
  intent: ConversationIntent;
  temperature: ConversationTemperature;
  urgency: ConversationUrgency;
  sentiment: ConversationSentiment;
  summary: string;
  nextBestAction: string;
  suggestedReply: string | null;
  reasons: string[];
  generatedAt: string;
  stale: boolean;
}

export function isInsightStale(
  sourceLastMessageAt: string | null,
  currentLastMessageAt: string | null,
): boolean {
  if (!sourceLastMessageAt) return Boolean(currentLastMessageAt);
  if (!currentLastMessageAt) return false;
  return new Date(currentLastMessageAt).getTime() > new Date(sourceLastMessageAt).getTime();
}
