import type { AuthSession } from "@/core/auth/session.server";

/**
 * Core · Permissions — catálogo de chaves e checagem client-side.
 *
 * As chaves espelham o seed em `supabase/migrations/0008_core_seed.sql`.
 * A checagem real de segurança é a RLS no banco; `can()` serve para gating de
 * UI (mostrar/ocultar), nunca como única barreira.
 */
export const PERMISSIONS = {
  ORG_MANAGE: "org.manage",
  ORG_DELETE: "org.delete",
  MEMBERS_READ: "members.read",
  MEMBERS_MANAGE: "members.manage",
  ROLES_MANAGE: "roles.manage",
  BILLING_MANAGE: "billing.manage",
  AUDIT_READ: "audit.read",
  DASHBOARD_READ: "dashboard.read",
  CRM_READ: "crm.read",
  CRM_WRITE: "crm.write",
  CLIENTES_READ: "clientes.read",
  CLIENTES_WRITE: "clientes.write",
  WHATSAPP_READ: "whatsapp.read",
  WHATSAPP_SEND: "whatsapp.send",
  AUTOMACOES_READ: "automacoes.read",
  AUTOMACOES_WRITE: "automacoes.write",
  AUTOMACOES_EXECUTE: "automacoes.execute",
  IA_USE: "ia.use",
  RELATORIOS_READ: "relatorios.read",
  CONFIGURACOES_MANAGE: "configuracoes.manage",
  WEBHOOKS_MANAGE: "webhooks.manage",
  WHATSAPP_CONNECT: "whatsapp.connect",
  API_KEYS_MANAGE: "api.keys.manage",
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/** O usuário da sessão possui a permissão na organização ativa? */
export function can(session: AuthSession | null, permission: PermissionKey): boolean {
  return session?.permissions.includes(permission) ?? false;
}
