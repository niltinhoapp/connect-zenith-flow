/**
 * Contrato visual dos "Insights da conversa" (frente Claude — experiência).
 *
 * Este tipo espelha o contrato que o Codex entregará pela infraestrutura de IA.
 * Enquanto o backend real não está conectado, os componentes consomem estas
 * props com estados seguros (nada de dados falsos). Quando o Codex publicar o
 * tipo canônico, reaponte os imports para o tipo dele.
 */
export type ConversationIntent = "sale" | "support" | "billing" | "post_sale" | "other";
export type ConversationTemperature = "hot" | "warm" | "cold";
export type ConversationUrgency = "high" | "medium" | "low";
export type ConversationSentiment = "positive" | "neutral" | "negative";

export type ConversationInsight = {
  intent: ConversationIntent;
  temperature: ConversationTemperature;
  urgency: ConversationUrgency;
  sentiment: ConversationSentiment;
  /** Resumo curto da conversa, em linguagem simples. */
  summary: string;
  /** Próxima melhor ação recomendada ao atendente. */
  nextBestAction: string;
  /** Sinais que motivaram a recomendação (frases curtas). */
  reasons: string[];
  /** ISO 8601 do momento da análise. */
  generatedAt: string;
  /** true quando a conversa mudou depois da última análise. */
  stale: boolean;
};

/**
 * Estados possíveis do painel de insight. `ready` implica `insight != null`.
 * "Desatualizado" não é um estado próprio: é derivado de `insight.stale`.
 */
export type ConversationInsightsState =
  | "loading"
  | "ready"
  | "empty"
  | "error"
  | "forbidden"
  | "unavailable";

export interface ConversationInsightsProps {
  insight: ConversationInsight | null;
  state: ConversationInsightsState;
  /** Dispara uma nova análise. Se ausente, o botão "Atualizar" não é mostrado. */
  onRefresh?: () => void;
  /** Preenche o campo de resposta com a sugestão — NUNCA envia automaticamente. */
  onUseSuggestion?: (text: string) => void;
  /** Abre o card por padrão (default: apenas quando `state === "ready"`). */
  defaultOpen?: boolean;
  className?: string;
}
