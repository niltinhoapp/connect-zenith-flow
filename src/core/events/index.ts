/**
 * Core · Events — barrel público.
 * Módulos publicam/assinam eventos via `eventBus`. Ver `src/core/README.md`.
 */
export { eventBus, type EventBus } from "@/core/events/bus";
export type {
  DomainEvent,
  DomainEventMap,
  DomainEventName,
  EventHandler,
  EventMeta,
  TenantPayload,
  Unsubscribe,
} from "@/core/events/types";
