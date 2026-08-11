import { describe, expect, it } from "vitest";
import { normalizeCommerceAnalysis } from "./commerce-assistant";

describe("normalizeCommerceAnalysis", () => {
  it("calcula o troco somente com valores válidos e explícitos", () => {
    const result = normalizeCommerceAnalysis({
      intent: "order",
      stage: "confirmed",
      items: [{ description: "X-bacon", quantity: 2 }],
      paymentMethod: "cash",
      orderTotalCents: 8200,
      cashForCents: 10000,
      suggestedReply: "Seu pedido foi anotado.",
      confidence: "high",
    });
    expect(result.changeCents).toBe(1800);
    expect(result.items).toEqual([{ description: "X-bacon", quantity: 2 }]);
  });

  it("não aceita valores negativos nem campos fora do contrato", () => {
    const result = normalizeCommerceAnalysis({
      intent: "inventado",
      stage: "qualquer",
      orderTotalCents: -10,
      cashForCents: "abc",
    });
    expect(result.intent).toBe("other");
    expect(result.stage).toBe("discovery");
    expect(result.orderTotalCents).toBeNull();
    expect(result.changeCents).toBeNull();
  });
});
