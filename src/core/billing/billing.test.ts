import { describe, expect, it } from "vitest";
import { aiAddons, plans } from "@/config/plans";

describe("catálogo comercial ConnectWeb", () => {
  it("mantém o plano único no valor aprovado", () => {
    const plan = plans.connectweb_complete;
    expect(plan.priceMonthly).toBe(54_979);
    expect(plan.includedModules).toEqual(["*"]);
    expect(plan.aiCredits).toBe(5_000_000);
  });

  it("mantém os três pacotes adicionais aprovados", () => {
    expect(
      Object.values(aiAddons).map(({ id, price, credits }) => ({ id, price, credits })),
    ).toEqual([
      { id: "ai_advantage", price: 5_990, credits: 1_000_000 },
      { id: "ai_turbo", price: 14_990, credits: 3_000_000 },
      { id: "ai_ultra", price: 39_990, credits: 10_000_000 },
    ]);
  });
});
