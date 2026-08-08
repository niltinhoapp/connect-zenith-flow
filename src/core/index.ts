/**
 * Core — API pública da plataforma (plugin architecture).
 *
 * Os MÓDULOS de negócio (src/features/*) consomem serviços do Core APENAS por
 * este barrel. Nenhum módulo importa outro módulo diretamente — a comunicação
 * entre domínios passa sempre pelo Core. Ver `src/core/README.md`.
 */
export * from "@/core/auth";
export * from "@/core/organizations";
export * from "@/core/permissions";
export * from "@/core/events";
export * from "@/core/integrations";
export * from "@/core/errors";
export * from "@/core/logging";
export * from "@/core/feature-flags";
export * from "@/core/domain";
export * from "@/core/jobs";
export * from "@/core/quotas";
export * from "@/core/observability";
export * from "@/core/modules";
export * from "@/core/templates";
export * from "@/core/webhooks";
export * from "@/core/copilot";
export type { ServiceContext } from "@/core/application/context";
export { guard } from "@/core/application/guard";
export type { AuditAction, AuditLogEntry } from "@/core/audit";
