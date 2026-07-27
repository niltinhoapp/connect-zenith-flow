import { describe, it, expect, vi } from "vitest";
import { InMemoryQueueProvider } from "@/core/jobs/in-memory-queue-provider";
import { JobWorker } from "@/core/jobs/worker";

describe("Core · JobWorker", () => {
  it("processa job com sucesso e marca succeeded", async () => {
    const q = new InMemoryQueueProvider();
    const id = await q.enqueue({ organizationId: "o", type: "greet" });
    const handler = vi.fn(async () => ({ ok: true }));
    const worker = new JobWorker(q).register("greet", handler);

    const res = await worker.runOnce();

    expect(res).toEqual({ processed: 1, failed: 0 });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(q.snapshot(id)?.status).toBe("succeeded");
  });

  it("faz retry e vai para a DLQ ao esgotar max_attempts", async () => {
    const q = new InMemoryQueueProvider();
    await q.enqueue({ organizationId: "o", type: "boom", maxAttempts: 2 });
    const worker = new JobWorker(q).register("boom", async () => {
      throw new Error("falhou");
    });

    await worker.runOnce(); // tentativa 1 → retry
    expect(q.deadLetters.length).toBe(0);
    await worker.runOnce(); // tentativa 2 → dead (DLQ)

    expect(q.deadLetters.length).toBe(1);
    expect(q.deadLetters[0].type).toBe("boom");
  });

  it("job sem handler falha e vai para DLQ (max_attempts=1)", async () => {
    const q = new InMemoryQueueProvider();
    await q.enqueue({ organizationId: "o", type: "unknown", maxAttempts: 1 });
    const worker = new JobWorker(q);

    const res = await worker.runOnce();

    expect(res.failed).toBe(1);
    expect(q.deadLetters.length).toBe(1);
  });
});
