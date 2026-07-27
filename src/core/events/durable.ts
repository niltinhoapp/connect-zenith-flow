import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";
import { InfrastructureError } from "@/core/errors";
import type { Job } from "@/core/jobs/types";
import type { DomainEventName, DomainEventMap, TenantPayload } from "@/core/events/types";

/**
 * Event Bus DURÁVEL (outbox). `publishDurable` grava o evento em `domain_events`
 * e enfileira o relay (via Queue) — server-side, sobrevive a reload. O bus
 * in-memory (`eventBus`) continua para reações efêmeras de UI no cliente.
 */
export async function publishDurable<K extends DomainEventName>(
  db: SupabaseClient<Database>,
  name: K,
  payload: DomainEventMap[K],
  opts?: { payloadVersion?: number; traceId?: string },
): Promise<string> {
  const org = (payload as TenantPayload).organizationId;
  const { data, error } = await db.rpc("publish_event", {
    p_org: org,
    p_name: name,
    p_payload: payload as unknown as Json,
    p_payload_version: opts?.payloadVersion ?? 1,
    p_trace_id: opts?.traceId,
  });
  if (error) throw new InfrastructureError(error.message, { cause: error });
  return data as string;
}

/**
 * Handler do job `outbox.relay`: extrai o event_id do payload e delega ao
 * `relay` (que chama `relay_domain_event` → dispatch de webhooks + reações).
 */
export function outboxRelayHandler(relay: (eventId: string) => Promise<void>) {
  return async (job: Job): Promise<void> => {
    const eventId = (job.payload as { event_id?: string }).event_id;
    if (eventId) await relay(eventId);
  };
}
