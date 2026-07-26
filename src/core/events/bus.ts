import type {
  DomainEvent,
  DomainEventMap,
  DomainEventName,
  EventHandler,
  EventMeta,
  TenantPayload,
  Unsubscribe,
} from "@/core/events/types";

/**
 * Contrato do barramento de eventos. Módulos publicam/assinam por aqui — nunca
 * se conhecem diretamente. Trocável por uma implementação durável no futuro.
 */
export interface EventBus {
  publish<K extends DomainEventName>(
    name: K,
    payload: DomainEventMap[K],
    meta?: EventMeta,
  ): Promise<void>;
  subscribe<K extends DomainEventName>(name: K, handler: EventHandler<K>): Unsubscribe;
  /** Assina todos os eventos (útil para auditoria/telemetria). */
  subscribeAll(handler: EventHandler): Unsubscribe;
}

/**
 * Implementação in-memory (F1). Entrega síncrona/assíncrona no mesmo runtime.
 * Suficiente para preparar os módulos; a durabilidade cross-instância chega
 * junto das integrações (F3).
 */
class InMemoryEventBus implements EventBus {
  private handlers = new Map<DomainEventName, Set<EventHandler>>();
  private wildcard = new Set<EventHandler>();

  async publish<K extends DomainEventName>(
    name: K,
    payload: DomainEventMap[K],
    meta: EventMeta = {},
  ): Promise<void> {
    const event: DomainEvent<K> = {
      id: crypto.randomUUID(),
      name,
      organizationId: (payload as TenantPayload).organizationId,
      payload,
      occurredAt: new Date().toISOString(),
      actorId: meta.actorId,
    };

    const targets = [...(this.handlers.get(name) ?? []), ...this.wildcard];
    await Promise.all(targets.map((handler) => Promise.resolve(handler(event as DomainEvent))));
  }

  subscribe<K extends DomainEventName>(name: K, handler: EventHandler<K>): Unsubscribe {
    const set = this.handlers.get(name) ?? new Set<EventHandler>();
    set.add(handler as EventHandler);
    this.handlers.set(name, set);
    return () => set.delete(handler as EventHandler);
  }

  subscribeAll(handler: EventHandler): Unsubscribe {
    this.wildcard.add(handler);
    return () => this.wildcard.delete(handler);
  }
}

/** Instância única do barramento (app-layer). */
export const eventBus: EventBus = new InMemoryEventBus();
