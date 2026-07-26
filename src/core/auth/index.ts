/**
 * Core · Auth — barrel público.
 * Módulos de negócio consomem auth exclusivamente por aqui (ou por @/core).
 */
export * from "@/core/auth/schema";
export * from "@/core/auth/api";
export { SessionProvider, useSession, initialsFromName } from "@/core/auth/session";
export { fetchSession } from "@/core/auth/session.server";
export type { AuthSession, SessionMembership } from "@/core/auth/session.server";
