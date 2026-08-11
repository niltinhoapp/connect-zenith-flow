import type { EnqueueInput, FailOutcome, Job, QueueProvider } from "@/core/jobs/types";

/**
 * QueueProvider baseado em `fetch` sobre as RPCs (PostgREST). Usado pelo worker
 * local (Node) com a service role — evita dependência do supabase-js no runtime
 * do worker. Mesma interface do SupabaseQueueProvider.
 */
export class RestQueueProvider implements QueueProvider {
  constructor(
    private readonly url: string,
    private readonly serviceKey: string,
  ) {}

  private async rpc<T>(name: string, body: unknown): Promise<T> {
    const r = await fetch(`${this.url}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: {
        apikey: this.serviceKey,
        Authorization: `Bearer ${this.serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`RPC ${name} ${r.status}: ${(await r.text()).slice(0, 200)}`);
    return (r.status === 204 ? null : await r.json()) as T;
  }

  async enqueue(input: EnqueueInput): Promise<string> {
    return this.rpc<string>("enqueue_job", {
      p_org: input.organizationId,
      p_type: input.type,
      p_payload: input.payload ?? {},
      p_available_at: input.availableAt,
      p_priority: input.priority,
      p_max_attempts: input.maxAttempts,
      p_trace_id: input.traceId,
      p_correlation_id: input.correlationId,
      p_idempotency_key: input.idempotencyKey,
      p_payload_version: input.payloadVersion,
    });
  }

  async claim(worker: string, limit: number, leaseSeconds: number): Promise<Job[]> {
    const rows = await this.rpc<Array<Record<string, unknown>>>("claim_jobs", {
      p_worker: worker,
      p_limit: limit,
      p_lease_seconds: leaseSeconds,
    });
    return (rows ?? []).map((r) => ({
      id: r.id as string,
      organizationId: (r.organization_id as string | null) ?? null,
      type: r.type as string,
      payload: (r.payload as Record<string, unknown>) ?? {},
      status: r.status as Job["status"],
      attempts: r.attempts as number,
      maxAttempts: r.max_attempts as number,
      traceId: (r.trace_id as string | null) ?? null,
      correlationId: (r.correlation_id as string | null) ?? null,
    }));
  }

  async complete(id: string, result?: Record<string, unknown>): Promise<void> {
    await this.rpc<null>("complete_job", { p_id: id, p_result: result ?? {} });
  }

  async fail(id: string, error: string): Promise<FailOutcome> {
    return (await this.rpc<FailOutcome>("fail_job", { p_id: id, p_error: error })) ?? "not_found";
  }
}
