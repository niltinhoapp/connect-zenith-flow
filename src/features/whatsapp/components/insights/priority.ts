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

/**
 * "Sem resposta" com sinal real: existe uma mensagem recebida do cliente que
 * ainda não teve resposta nossa depois dela. Substitui o proxy antigo de
 * não-lidas (`unreadCount > 0`). Usa os timestamps da conversa:
 *  - sem entrada do cliente → não está aguardando;
 *  - entrou e nunca saiu nada → aguardando;
 *  - a última entrada é mais recente que a última saída → aguardando.
 */
export function isAwaitingReply(
  lastInboundAt: string | null,
  lastOutboundAt: string | null,
): boolean {
  if (!lastInboundAt) return false;
  if (!lastOutboundAt) return true;
  return new Date(lastInboundAt).getTime() > new Date(lastOutboundAt).getTime();
}

/** Uma conversa é prioritária quando está sem resposta e quente OU urgente. */
export function isPriorityConversation(
  insight: ConversationInsight | undefined,
  unanswered: boolean,
): boolean {
  if (!unanswered) return false;
  return insight?.temperature === "hot" || insight?.urgency === "high";
}

/**
 * O cliente aguarda resposta quando a última mensagem recebida veio depois da
 * última mensagem enviada. Abrir/ler a conversa não altera este sinal.
 */
export function isAwaitingReply(
  lastInboundAt: string | null,
  lastOutboundAt: string | null,
): boolean {
  if (!lastInboundAt) return false;
  if (!lastOutboundAt) return true;
  return new Date(lastInboundAt).getTime() > new Date(lastOutboundAt).getTime();
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
