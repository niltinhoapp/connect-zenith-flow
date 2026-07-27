import type { EnqueueInput, FailOutcome, Job, QueueProvider } from "@/core/jobs/types";

type Entry = Job & { availableAt: number };

/**
 * QueueProvider in-memory — implementação inicial (worker local) e base dos
 * testes. Reproduz a semântica de retry/DLQ do banco (attempts × max_attempts).
 */
export class InMemoryQueueProvider implements QueueProvider {
  private entries = new Map<string, Entry>();
  private seq = 0;
  readonly deadLetters: Job[] = [];

  private strip(e: Entry): Job {
    const { availableAt: _omit, ...job } = e;
    void _omit;
    return { ...job };
  }

  async enqueue(input: EnqueueInput): Promise<string> {
    const id = `job-${++this.seq}`;
    this.entries.set(id, {
      id,
      organizationId: input.organizationId,
      type: input.type,
      payload: input.payload ?? {},
      status: "queued",
      attempts: 0,
      maxAttempts: input.maxAttempts ?? 5,
      traceId: input.traceId ?? null,
      correlationId: input.correlationId ?? null,
      availableAt: input.availableAt ? Date.parse(input.availableAt) : Date.now(),
    });
    return id;
  }

  async claim(_worker: string, limit: number, _leaseSeconds: number): Promise<Job[]> {
    const now = Date.now();
    const claimable = [...this.entries.values()]
      .filter((e) => e.status === "queued" && e.availableAt <= now)
      .slice(0, Math.max(1, limit));
    for (const e of claimable) {
      e.status = "running";
      e.attempts += 1;
    }
    return claimable.map((e) => this.strip(e));
  }

  async complete(id: string): Promise<void> {
    const e = this.entries.get(id);
    if (e) e.status = "succeeded";
  }

  async fail(id: string, _error: string): Promise<FailOutcome> {
    const e = this.entries.get(id);
    if (!e) return "not_found";
    if (e.attempts >= e.maxAttempts) {
      e.status = "dead";
      this.deadLetters.push(this.strip(e));
      return "dead";
    }
    e.status = "queued";
    e.availableAt = Date.now();
    return "retry";
  }

  /** Helpers de teste. */
  snapshot(id: string): Job | undefined {
    const e = this.entries.get(id);
    return e ? this.strip(e) : undefined;
  }
}
