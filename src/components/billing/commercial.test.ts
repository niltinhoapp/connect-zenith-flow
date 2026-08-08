import { describe, expect, it } from "vitest";
import { aiAddons, plans } from "@/config/plans";
import { CONNECTWEB_PLAN, IA_PACKAGES } from "./commercial";

describe("apresentação comercial", () => {
  it("espelha o catálogo real de cobrança", () => {
    expect(CONNECTWEB_PLAN.priceCents).toBe(plans.connectweb_complete.priceMonthly);
    for (const pkg of IA_PACKAGES) {
      const source = aiAddons[pkg.id];
      expect({ price: pkg.priceCents, credits: pkg.credits }).toEqual({
        price: source.price,
        credits: source.credits,
      });
    }
  });
});
