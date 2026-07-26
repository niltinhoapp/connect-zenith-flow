import { createContext, useContext, type ReactNode } from "react";
import type { AuthSession } from "@/core/auth/session.server";

/**
 * Contexto de sessão (client). Alimentado pela sessão carregada no `beforeLoad`
 * do root e disponibilizado a toda a árvore (Sidebar, Header, etc.).
 */
const SessionContext = createContext<AuthSession | null>(null);

export function SessionProvider({
  session,
  children,
}: {
  session: AuthSession | null;
  children: ReactNode;
}) {
  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}

/** Sessão atual (ou null se não autenticado). */
export function useSession() {
  return useContext(SessionContext);
}

/** Iniciais para avatar a partir do nome completo. */
export function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";
  return (first + last).toUpperCase() || "?";
}
