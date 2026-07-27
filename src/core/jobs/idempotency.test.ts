import { describe, it, expect } from "vitest";
import { withIdempotency } from "@/core/jobs/idempotency";

describe("Core · withIdempotency", () => {
  it("executa no máximo uma vez por chave", async () => {
    const used = new Set<string>();
    const acquire = async (k: string) => {
      if (used.has(k)) return false;
      used.add(k);
      return true;
    };
    let runs = 0;
    const first = await withIdempotency(acquire, "k1", async () => { runs++; });
    const second = await withIdempotency(acquire, "k1", async () => { runs++; });

    expect(first).toBe(true);
    expect(second).toBe(false);
    expect(runs).toBe(1);
  });
});
