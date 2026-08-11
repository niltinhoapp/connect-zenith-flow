import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";
import { InfrastructureError } from "@/core/errors";
import type { EnqueueInput, FailOutcome, Job, QueueProvider } from "@/core/jobs/types";

type Row = Database["public"]["Tables"]["jobs"]["Row"];

function rowToJob(r: Row): Job {
  return {
    id: r.id,
    organizationId: r.organization_id,
    type: r.type,
    payload: (r.payload ?? {}) as Record<string, unknown>,
    status: r.status,
    attempts: r.attempts,
    maxAttempts: r.max_attempts,
    traceId: r.trace_id,
    correlationId: r.correlation_id,
  };
}

/**
 * QueueProvider sobre Postgres (via RPCs). Requer client com service role
 * (worker) para claim/complete/fail. Enqueue pode vir de Application Services.
 */
export class SupabaseQueueProvider implements QueueProvider {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async enqueue(input: EnqueueInput): Promise<string> {
    const { data, error } = await this.db.rpc("enqueue_job", {
      p_org: input.organizationId,
      p_type: input.type,
      p_payload: (input.payload ?? {}) as Json,
      p_available_at: input.availableAt,
      p_priority: input.priority,
      p_max_attempts: input.maxAttempts,
      p_trace_id: input.traceId,
      p_correlation_id: input.correlationId,
      p_idempotency_key: input.idempotencyKey,
      p_payload_version: input.payloadVersion,
    });
    if (error) throw new InfrastructureError(error.message, { cause: error });
    return data as string;
  }

  async claim(worker: string, limit: number, leaseSeconds: number): Promise<Job[]> {
    const { data, error } = await this.db.rpc("claim_jobs", {
      p_worker: worker,
      p_limit: limit,
      p_lease_seconds: leaseSeconds,
    });
    if (error) throw new InfrastructureError(error.message, { cause: error });
    return (data ?? []).map(rowToJob);
  }

  async complete(id: string, result?: Record<string, unknown>): Promise<void> {
    const { error } = await this.db.rpc("complete_job", {
      p_id: id,
      p_result: (result ?? {}) as Json,
    });
    if (error) throw new InfrastructureError(error.message, { cause: error });
  }

  async fail(id: string, err: string): Promise<FailOutcome> {
    const { data, error } = await this.db.rpc("fail_job", { p_id: id, p_error: err });
    if (error) throw new InfrastructureError(error.message, { cause: error });
    return (data as FailOutcome) ?? "not_found";
  }
}
