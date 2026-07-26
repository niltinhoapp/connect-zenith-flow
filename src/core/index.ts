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
export type { AuditAction, AuditLogEntry } from "@/core/audit";
