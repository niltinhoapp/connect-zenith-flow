import { describe, it, expect } from "vitest";
import { isWithinLimit } from "@/core/quotas";

describe("Core · Quotas · isWithinLimit", () => {
  it("permite dentro do limite", () => {
    expect(isWithinLimit(5, 10, 3)).toBe(true);
    expect(isWithinLimit(7, 10, 3)).toBe(true);
  });
  it("bloqueia ao exceder", () => {
    expect(isWithinLimit(9, 10, 3)).toBe(false);
  });
  it("-1 = ilimitado", () => {
    expect(isWithinLimit(1_000_000, -1, 999)).toBe(true);
  });
});
