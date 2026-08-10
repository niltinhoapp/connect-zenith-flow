import { describe, expect, it } from "vitest";
import { normalizeReportsMetrics } from "./reports-service";

describe("normalizeReportsMetrics", () => {
  it("recalcula o ticket médio a partir da mesma receita e negócios ganhos", () => {
    const result = normalizeReportsMetrics({
      revenueTotal: 12_300,
      wonCount: 3,
      avgTicket: 999_999,
      revenueTrend: [],
      funnel: [],
      sources: [],
    }, new Date("2026-08-09T12:00:00Z"));

    expect(result.avgTicket).toBe(4_100);
    expect(result.generatedAt).toBe("2026-08-09T12:00:00.000Z");
  });

  it("não deixa valores inválidos ou negativos chegarem aos gráficos", () => {
    const result = normalizeReportsMetrics({
      revenueTotal: -1,
      wonCount: "inválido",
      revenueTrend: [{ m: "Jan", v: -50 }, { m: "Fev", v: 500 }],
      funnel: [{ s: "Leads", v: -2 }],
      sources: [{ n: "WhatsApp", v: "4" }],
    });

    expect(result.revenueTotal).toBe(0);
    expect(result.wonCount).toBe(0);
    expect(result.revenueTrend).toEqual([{ m: "Jan", v: 0 }, { m: "Fev", v: 500 }]);
    expect(result.funnel[0]?.v).toBe(0);
    expect(result.sources[0]?.v).toBe(4);
  });
});
