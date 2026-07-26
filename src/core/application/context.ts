/**
 * Core · Application — contexto de execução dos Application Services.
 *
 * Carrega o que todo serviço precisa: organização ativa (multi-tenant), ator
 * (auditoria) e módulos habilitados (feature flags). Construído a partir da
 * sessão (nunca de input do cliente).
 */
export interface ServiceContext {
  organizationId: string;
  actorId: string;
  enabledModules: readonly string[];
}
