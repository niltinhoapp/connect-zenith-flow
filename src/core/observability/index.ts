import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";

/**
 * Core · Observability — tracing com abstração plugável (pronto p/ OpenTelemetry).
 * Toda operação importante registra: trace_id, organization_id, correlation_id,
 * actor_id (no sink), operation, duration_ms, status.
 */
export interface TraceRecord {
  organizationId: string | null;
  traceId: string;
  spanId?: string;
  correlationId?: string;
  operation: string;
  status: "success" | "error";
  durationMs: number;
  metadata?: Record<string, unknown>;
}

export interface TracingProvider {
  record(trace: TraceRecord): void | Promise<void>;
}

/** Provider default (console) — trocável por OTel/Sentry via setTracingProvider. */
export class ConsoleTracingProvider implements TracingProvider {
  record(t: TraceRecord): void {
    console.debug(
      `[trace] ${t.operation} ${t.status} ${t.durationMs}ms trace=${t.traceId} org=${t.organizationId ?? "-"}`,
    );
  }
}

/** Provider durável (Postgres via write_trace) — store leve consultável in-app. */
export class SupabaseTracingProvider implements TracingProvider {
  constructor(private readonly db: SupabaseClient<Database>) {}
  async record(t: TraceRecord): Promise<void> {
    await this.db.rpc("write_trace", {
      p_org: t.organizationId,
      p_trace_id: t.traceId,
      p_operation: t.operation,
      p_status: t.status,
      p_duration_ms: t.durationMs,
      p_correlation_id: t.correlationId,
      p_span_id: t.spanId,
      p_metadata: (t.metadata ?? {}) as Json,
    });
  }
}

let activeProvider: TracingProvider = new ConsoleTracingProvider();
export function setTracingProvider(provider: TracingProvider): void {
  activeProvider = provider;
}
export function newTraceId(): string {
  return crypto.randomUUID();
}

/**
 * Envolve uma operação medindo duração e registrando trace (success/error).
 * Rethrow preserva o erro; a UI/serviço trata normalmente.
 */
export async function traced<T>(
  ctx: {
    organizationId: string | null;
    operation: string;
    traceId?: string;
    correlationId?: string;
  },
  fn: () => Promise<T>,
): Promise<T> {
  const traceId = ctx.traceId ?? newTraceId();
  const start = Date.now();
  try {
    const result = await fn();
    await activeProvider.record({
      organizationId: ctx.organizationId,
      traceId,
      correlationId: ctx.correlationId,
      operation: ctx.operation,
      status: "success",
      durationMs: Date.now() - start,
    });
    return result;
  } catch (error) {
    await activeProvider.record({
      organizationId: ctx.organizationId,
      traceId,
      correlationId: ctx.correlationId,
      operation: ctx.operation,
      status: "error",
      durationMs: Date.now() - start,
      metadata: { error: error instanceof Error ? error.message : String(error) },
    });
    throw error;
  }
}
