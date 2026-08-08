/**
 * Filtros e priorização da fila de atendimento (frente Claude — experiência).
 * Lógica pura (sem dados), consumida pela lista de conversas.
 */
import type {
  ConversationInsight,
  ConversationIntent,
  ConversationTemperature,
  ConversationUrgency,
} from "./types";

export interface InsightFilter {
  intent: ConversationIntent | null;
  temperature: ConversationTemperature | null;
  urgency: ConversationUrgency | null;
  /** Fila priorizada: só conversas quentes/urgentes ainda sem resposta. */
  priorityOnly: boolean;
}

export const EMPTY_INSIGHT_FILTER: InsightFilter = {
  intent: null,
  temperature: null,
  urgency: null,
  priorityOnly: false,
};

/** Quantos filtros de dimensão (intenção/temperatura/urgência) estão ativos. */
export function activeDimensionCount(filter: InsightFilter): number {
  return (filter.intent ? 1 : 0) + (filter.temperature ? 1 : 0) + (filter.urgency ? 1 : 0);
}

export function hasAnyFilter(filter: InsightFilter): boolean {
  return filter.priorityOnly || activeDimensionCount(filter) > 0;
}

export function insightMatchesFilter(
  insight: ConversationInsight | undefined,
  filter: InsightFilter,
): boolean {
  if (filter.intent && insight?.intent !== filter.intent) return false;
  if (filter.temperature && insight?.temperature !== filter.temperature) return false;
  if (filter.urgency && insight?.urgency !== filter.urgency) return false;
  return true;
}

/** Uma conversa é prioritária quando está sem resposta e quente OU urgente. */
export function isPriorityConversation(
  insight: ConversationInsight | undefined,
  unanswered: boolean,
): boolean {
  if (!unanswered) return false;
  return insight?.temperature === "hot" || insight?.urgency === "high";
}

/** Score para ordenar a fila: quente/urgente/sem resposta primeiro. */
export function priorityScore(
  insight: ConversationInsight | undefined,
  unanswered: boolean,
): number {
  let score = 0;
  if (insight?.temperature === "hot") score += 3;
  else if (insight?.temperature === "warm") score += 1;
  if (insight?.urgency === "high") score += 3;
  else if (insight?.urgency === "medium") score += 1;
  if (insight?.intent === "sale") score += 1;
  if (unanswered) score += 2;
  return score;
}
