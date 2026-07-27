import { logError } from "@/core/logging";
import type { JobHandler, QueueProvider } from "@/core/jobs/types";

/**
 * JobWorker — worker local (implementação inicial). Registra handlers por
 * `type`, reivindica jobs (lease), executa e conclui/falha (retry/DLQ ficam no
 * provider). Depois pode rodar em Edge Function/fila externa sem mudar a API.
 */
export class JobWorker {
  private handlers = new Map<string, JobHandler>();
  private running = false;

  constructor(
    private readonly provider: QueueProvider,
    private readonly opts: { workerId?: string; leaseSeconds?: number; batch?: number } = {},
  ) {}

  register(type: string, handler: JobHandler): this {
    this.handlers.set(type, handler);
    return this;
  }

  async runOnce(): Promise<{ processed: number; failed: number }> {
    const worker = this.opts.workerId ?? "worker-local";
    const jobs = await this.provider.claim(worker, this.opts.batch ?? 10, this.opts.leaseSeconds ?? 60);
    let processed = 0;
    let failed = 0;
    for (const job of jobs) {
      const handler = this.handlers.get(job.type);
      try {
        if (!handler) throw new Error(`Sem handler para o job type "${job.type}"`);
        const result = await handler(job);
        await this.provider.complete(job.id, result ?? undefined);
        processed++;
      } catch (error) {
        logError(error, { worker, jobId: job.id, type: job.type });
        await this.provider.fail(job.id, error instanceof Error ? error.message : String(error));
        failed++;
      }
    }
    return { processed, failed };
  }

  async start(intervalMs = 2000): Promise<void> {
    this.running = true;
    while (this.running) {
      await this.runOnce();
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }

  stop(): void {
    this.running = false;
  }
}
