/**
 * Traduções e frases em linguagem de lojista para os insights da conversa.
 * Evita termos técnicos (intent, score, classifier, LLM...). Só texto simples.
 */
import type {
  ConversationInsight,
  ConversationIntent,
  ConversationSentiment,
  ConversationTemperature,
  ConversationUrgency,
} from "./types";

export const INTENT_LABEL: Record<ConversationIntent, string> = {
  sale: "Venda",
  support: "Suporte",
  billing: "Cobrança",
  post_sale: "Pós-venda",
  other: "Geral",
};

export const TEMPERATURE_LABEL: Record<ConversationTemperature, string> = {
  hot: "Quente",
  warm: "Morno",
  cold: "Frio",
};

/** Explicação curta da temperatura, para o lojista. */
export const TEMPERATURE_HINT: Record<ConversationTemperature, string> = {
  hot: "Pronto para avançar",
  warm: "Demonstrando interesse",
  cold: "Ainda explorando",
};

export const URGENCY_LABEL: Record<ConversationUrgency, string> = {
  high: "Urgência alta",
  medium: "Urgência média",
  low: "Sem pressa",
};

export const SENTIMENT_LABEL: Record<ConversationSentiment, string> = {
  positive: "Clima positivo",
  neutral: "Clima neutro",
  negative: "Clima tenso",
};

/**
 * Manchete amigável combinando intenção + temperatura.
 * Ex.: "Cliente pronto para comprar", "Parece uma dúvida de suporte".
 */
export function headlineFor(insight: ConversationInsight): string {
  const { intent, temperature } = insight;
  if (intent === "sale") {
    if (temperature === "hot") return "Cliente pronto para comprar";
    if (temperature === "warm") return "Cliente demonstrando interesse";
    return "Possível interesse de compra";
  }
  if (intent === "support") return "Parece uma dúvida de suporte";
  if (intent === "billing") return "Assunto de cobrança ou pagamento";
  if (intent === "post_sale") return "Atendimento de pós-venda";
  return temperature === "hot" ? "Cliente bastante engajado" : "Conversa em andamento";
}

/** Formata o horário da análise (HH:MM) de forma tolerante a valor inválido. */
export function formatAnalysisTime(iso: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}
