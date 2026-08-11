/**
 * Core · Audit — trilha de auditoria.
 *
 * A ESCRITA acontece no banco, via `write_audit()` chamada pelas RPCs do Core
 * (SECURITY DEFINER) — ver `supabase/migrations/0005_core_audit.sql` e `0009`.
 * A leitura (UI de consulta) chega em fase futura; aqui ficam apenas os tipos.
 */
export type AuditAction =
  "organization.created" | "organization.switched" | "role.created" | (string & {});

export type AuditLogEntry = {
  id: string;
  organizationId: string | null;
  actorId: string | null;
  action: AuditAction;
  entityType: string | null;
  entityId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};
