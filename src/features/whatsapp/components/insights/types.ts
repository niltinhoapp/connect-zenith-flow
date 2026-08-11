/**
 * Contrato visual dos "Insights da conversa" (frente Claude — experiência).
 *
 * O tipo `ConversationInsight` agora vem da fonte única do Codex (domínio).
 * Aqui ficam apenas os tipos da CAMADA VISUAL (estado do painel + props dos
 * componentes), que são responsabilidade da frente Claude.
 */
export type {
  ConversationInsight,
  ConversationIntent,
  ConversationTemperature,
  ConversationUrgency,
  ConversationSentiment,
} from "@/features/whatsapp/domain";

import type { ConversationInsight } from "@/features/whatsapp/domain";

/**
 * Estados possíveis do painel de insight. `ready` implica `insight != null`.
 * "Desatualizado" não é um estado próprio: é derivado de `insight.stale`.
 * `forbidden`/`unavailable` cobrem falta de permissão e limite/ módulo de IA.
 */
export type ConversationInsightsState =
  "loading" | "ready" | "empty" | "error" | "forbidden" | "unavailable";

export interface ConversationInsightsProps {
  insight: ConversationInsight | null;
  state: ConversationInsightsState;
  /** Dispara/atualiza a análise. Se ausente, o botão não é mostrado. */
  onRefresh?: () => void;
  /** Preenche o campo de resposta com a sugestão — NUNCA envia automaticamente. */
  onUseSuggestion?: (text: string) => void;
  /** Mensagem específica para o estado de erro (ex.: limite de IA atingido). */
  errorMessage?: string;
  /** Abre o card por padrão (default: apenas quando `state === "ready"`). */
  defaultOpen?: boolean;
  className?: string;
}
