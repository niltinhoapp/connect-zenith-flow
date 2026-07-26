import { eventBus, type DomainEvent } from "@/core/events";

/**
 * Eventos do módulo Clientes. O módulo PRODUZ estes eventos (via ClienteService)
 * e outros módulos podem reagir sem conhecer Clientes. Nenhuma chamada direta
 * entre módulos.
 */
export const CLIENTES_EMITS = ["customer.created", "customer.updated"] as const;

export function onCustomerCreated(
  handler: (event: DomainEvent<"customer.created">) => void | Promise<void>,
) {
  return eventBus.subscribe("customer.created", handler);
}

export function onCustomerUpdated(
  handler: (event: DomainEvent<"customer.updated">) => void | Promise<void>,
) {
  return eventBus.subscribe("customer.updated", handler);
}
