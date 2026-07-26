/**
 * Core · Events — catálogo tipado de eventos de domínio.
 *
 * A comunicação ENTRE MÓDULOS acontece exclusivamente por eventos: um módulo
 * publica, outros reagem. Nenhum módulo chama outro diretamente. Todo evento é
 * multi-tenant (carrega `organizationId`).
 *
 * Arquitetura preparada desde a F1; a entrega durável (outbox no Postgres /
 * fila / Supabase Realtime) entra em fase futura sem mudar esta interface.
 */

/** Todo payload de evento é escopado por organização (multi-tenant). */
export type TenantPayload = { organizationId: string };

/** Mapa nome→payload. Fonte da verdade dos eventos do sistema. */
export interface DomainEventMap {
  "organization.created": TenantPayload & { name: string };
  "user.invited": TenantPayload & { email: string; roleKey: string };

  "customer.created": TenantPayload & { customerId: string };
  "customer.updated": TenantPayload & { customerId: string };

  "lead.created": TenantPayload & { leadId: string };
  "lead.converted": TenantPayload & { leadId: string; customerId: string };

  "deal.created": TenantPayload & { dealId: string };
  "deal.stage.changed": TenantPayload & { dealId: string; fromStageId: string | null; toStageId: string };
  "deal.won": TenantPayload & { dealId: string; amount: number };
  "deal.lost": TenantPayload & { dealId: string; reason?: string };

  "comment.created": TenantPayload & { commentId: string; relatedType: string; relatedId: string };
  "attachment.uploaded": TenantPayload & { attachmentId: string; relatedType: string; relatedId: string };
  "timeline.event.created": TenantPayload & { timelineId: string; customerId: string | null; eventType: string };

  "whatsapp.message.received": TenantPayload & { conversationId: string; messageId: string };
  "whatsapp.message.sent": TenantPayload & { conversationId: string; messageId: string };

  "automation.started": TenantPayload & { automationId: string; runId: string };
  "automation.completed": TenantPayload & { automationId: string; runId: string };
  "automation.failed": TenantPayload & { automationId: string; runId: string; error: string };
}

export type DomainEventName = keyof DomainEventMap;

/** Envelope entregue aos handlers. */
export interface DomainEvent<K extends DomainEventName = DomainEventName> {
  id: string;
  name: K;
  organizationId: string;
  payload: DomainEventMap[K];
  occurredAt: string;
  actorId?: string;
}

export type EventHandler<K extends DomainEventName = DomainEventName> = (
  event: DomainEvent<K>,
) => void | Promise<void>;

export type Unsubscribe = () => void;

export type EventMeta = { actorId?: string };
