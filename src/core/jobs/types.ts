/**
 * Core · Jobs — tipos da fila de execução assíncrona (genérica).
 * `type` (string) roteia para um handler; o Core não conhece nenhum módulo.
 */
export type JobStatus = "queued" | "running" | "succeeded" | "failed" | "dead";

export interface Job {
  id: string;
  organizationId: string | null;
  type: string;
  payload: Record<string, unknown>;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  traceId?: string | null;
  correlationId?: string | null;
}

export interface EnqueueInput {
  organizationId: string | null;
  type: string;
  payload?: Record<string, unknown>;
  payloadVersion?: number;
  availableAt?: string;
  priority?: number;
  maxAttempts?: number;
  traceId?: string;
  correlationId?: string;
  idempotencyKey?: string;
}

export type JobHandler = (job: Job) => Promise<Record<string, unknown> | void>;
export type FailOutcome = "retry" | "dead" | "not_found";

/**
 * Abstração de fila — trocável (Postgres/pg-boss/Redis/SQS/RabbitMQ) sem alterar
 * services nem worker.
 */
export interface QueueProvider {
  enqueue(input: EnqueueInput): Promise<string>;
  claim(worker: string, limit: number, leaseSeconds: number): Promise<Job[]>;
  complete(id: string, result?: Record<string, unknown>): Promise<void>;
  fail(id: string, error: string): Promise<FailOutcome>;
}
