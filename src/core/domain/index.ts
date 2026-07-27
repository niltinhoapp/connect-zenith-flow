/**
 * Core · Domain — kernel de DDD compartilhado pelos módulos.
 * Ver docs/ARCHITECTURE.md · Domain Layer e src/core/README.md.
 */
export { Entity } from "@/core/domain/entity";
export { ValueObject } from "@/core/domain/value-object";
export { DomainError, invariant } from "@/core/domain/errors";
export type { Repository, Paginated } from "@/core/domain/repository";
