import { describe, it, expect, beforeEach } from "vitest";
import { setTracingProvider, traced, type TraceRecord } from "@/core/observability";

const records: TraceRecord[] = [];
beforeEach(() => {
  records.length = 0;
  setTracingProvider({
    record: (t) => {
      records.push(t);
    },
  });
});

describe("Core · Observability · traced", () => {
  it("registra sucesso com duração e trace_id", async () => {
    const result = await traced({ organizationId: "o", operation: "op.ok" }, async () => 42);
    expect(result).toBe(42);
    expect(records).toHaveLength(1);
    expect(records[0].status).toBe("success");
    expect(records[0].operation).toBe("op.ok");
    expect(typeof records[0].traceId).toBe("string");
    expect(records[0].durationMs).toBeGreaterThanOrEqual(0);
  });

  it("registra erro e re-propaga", async () => {
    await expect(
      traced({ organizationId: "o", operation: "op.fail" }, async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(records).toHaveLength(1);
    expect(records[0].status).toBe("error");
  });
});
