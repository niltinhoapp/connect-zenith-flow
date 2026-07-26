import { eventBus, type DomainEvent } from "@/core/events";

/** Eventos do módulo CRM. Produzidos pelo DealService; consumidos por outros. */
export const CRM_EMITS = ["deal.created", "deal.won"] as const;

export function onDealCreated(
  handler: (event: DomainEvent<"deal.created">) => void | Promise<void>,
) {
  return eventBus.subscribe("deal.created", handler);
}

export function onDealWon(
  handler: (event: DomainEvent<"deal.won">) => void | Promise<void>,
) {
  return eventBus.subscribe("deal.won", handler);
}
