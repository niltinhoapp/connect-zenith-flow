export type CommerceStage =
  | "discovery"
  | "collecting_items"
  | "collecting_fulfillment"
  | "collecting_address"
  | "collecting_payment"
  | "awaiting_confirmation"
  | "confirmed"
  | "handoff";

export interface CommerceItem {
  description: string;
  quantity: number | null;
}

export interface CommerceAnalysis {
  intent: "order" | "catalog" | "question" | "support" | "other";
  stage: CommerceStage;
  items: CommerceItem[];
  fulfillment: "delivery" | "pickup" | null;
  address: string | null;
  paymentMethod: "pix" | "card" | "cash" | null;
  cashForCents: number | null;
  orderTotalCents: number | null;
  changeCents: number | null;
  confirmed: boolean;
  missingFields: string[];
  needsHuman: boolean;
  confidence: "high" | "medium" | "low";
  suggestedReply: string;
  warnings: string[];
}

const intents = new Set(["order", "catalog", "question", "support", "other"]);
const stages = new Set<CommerceStage>([
  "discovery",
  "collecting_items",
  "collecting_fulfillment",
  "collecting_address",
  "collecting_payment",
  "awaiting_confirmation",
  "confirmed",
  "handoff",
]);
const fulfillment = new Set(["delivery", "pickup"]);
const payments = new Set(["pix", "card", "cash"]);
const confidence = new Set(["high", "medium", "low"]);
const text = (value: unknown, limit: number): string =>
  String(value ?? "")
    .trim()
    .slice(0, limit);
const cents = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
};

/** Valida a saída não confiável do provedor antes de expô-la ao lojista. */
export function normalizeCommerceAnalysis(value: unknown): CommerceAnalysis {
  const input = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const total = cents(input.orderTotalCents);
  const cashFor = cents(input.cashForCents);
  const calculatedChange =
    total !== null && cashFor !== null && cashFor >= total ? cashFor - total : null;
  const rawItems = Array.isArray(input.items) ? input.items : [];
  return {
    intent: intents.has(String(input.intent))
      ? (input.intent as CommerceAnalysis["intent"])
      : "other",
    stage: stages.has(input.stage as CommerceStage) ? (input.stage as CommerceStage) : "discovery",
    items: rawItems
      .slice(0, 30)
      .map((item) => {
        const record = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
        const quantity = Number(record.quantity);
        return {
          description: text(record.description, 200),
          quantity: Number.isInteger(quantity) && quantity > 0 ? quantity : null,
        };
      })
      .filter((item) => item.description),
    fulfillment: fulfillment.has(String(input.fulfillment))
      ? (input.fulfillment as "delivery" | "pickup")
      : null,
    address: text(input.address, 500) || null,
    paymentMethod: payments.has(String(input.paymentMethod))
      ? (input.paymentMethod as "pix" | "card" | "cash")
      : null,
    cashForCents: cashFor,
    orderTotalCents: total,
    changeCents: calculatedChange,
    confirmed: input.confirmed === true,
    missingFields: (Array.isArray(input.missingFields) ? input.missingFields : [])
      .slice(0, 10)
      .map((item) => text(item, 120))
      .filter(Boolean),
    needsHuman: input.needsHuman === true,
    confidence: confidence.has(String(input.confidence))
      ? (input.confidence as CommerceAnalysis["confidence"])
      : "low",
    suggestedReply: text(input.suggestedReply, 1200),
    warnings: (Array.isArray(input.warnings) ? input.warnings : [])
      .slice(0, 8)
      .map((item) => text(item, 200))
      .filter(Boolean),
  };
}

export function formatCommerceAnalysis(result: CommerceAnalysis): string {
  const money = (value: number | null) =>
    value === null
      ? "não informado"
      : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value / 100);
  const items = result.items.length
    ? result.items.map((item) => `${item.quantity ?? "?"}× ${item.description}`).join(", ")
    : "nenhum item confirmado";
  return [
    `Etapa: ${result.stage}`,
    `Pedido: ${items}`,
    `Atendimento: ${result.fulfillment === "delivery" ? "entrega" : result.fulfillment === "pickup" ? "retirada" : "não definido"}`,
    result.address ? `Endereço: ${result.address}` : null,
    `Pagamento: ${result.paymentMethod ?? "não informado"}`,
    result.orderTotalCents !== null ? `Total informado: ${money(result.orderTotalCents)}` : null,
    result.cashForCents !== null ? `Troco para: ${money(result.cashForCents)}` : null,
    result.changeCents !== null ? `Troco calculado: ${money(result.changeCents)}` : null,
    result.missingFields.length
      ? `Ainda falta: ${result.missingFields.join(", ")}`
      : "Dados essenciais completos.",
    result.needsHuman ? "Atenção: este atendimento precisa de revisão humana." : null,
    "",
    "Resposta sugerida (revise antes de enviar):",
    result.suggestedReply || "Não foi possível preparar uma resposta segura.",
  ]
    .filter((line) => line !== null)
    .join("\n");
}
