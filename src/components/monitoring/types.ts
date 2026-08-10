/**
 * Contrato visual do Monitoramento operacional (frente Claude — experiência).
 *
 * Consome os hooks/contratos existentes via adaptador. Onde ainda não há
 * contrato do Codex (falhas de automação, processamentos pendentes, saldo
 * adicional de créditos), os campos são `null` e a UI mostra um estado honesto
 * ("sem dados / aguardando integração") — nunca um número inventado.
 */

/** Situação simples e sem jargão para o lojista. */
export type WhatsAppHealthStatus =
  | "connected" // Conectado
  | "attention" // Atenção (pendente/instável)
  | "disconnected" // Desconectado
  | "action_required" // Ação necessária (erro)
  | "unknown"; // Sem dados / indisponível

export interface WhatsAppHealth {
  status: WhatsAppHealthStatus;
  name: string | null;
  /** Últimos eventos (com base nas conversas recentes). null = sem registro. */
  lastInboundAt: string | null;
  lastOutboundAt: string | null;
}

export interface AutomationsHealth {
  active: number;
  paused: number;
  /** Automações com falha. null = ainda sem contrato do Codex. */
  failed: number | null;
}

export interface ProcessingHealth {
  /** Processamentos na fila. null = ainda sem contrato do Codex. */
  pending: number | null;
  /** Processamentos com erro. null = ainda sem contrato do Codex. */
  errored: number | null;
}

export interface AiUsageHealth {
  /** Créditos de IA usados na franquia do mês. */
  used: number;
  /** Franquia mensal de créditos de IA. */
  limit: number;
  /** Saldo de créditos adicionais (pacotes). null = ainda sem contrato do Codex. */
  extraCredits: number | null;
}

export interface OperationalHealth {
  whatsapp: WhatsAppHealth;
  automations: AutomationsHealth;
  processing: ProcessingHealth;
  /** null quando o módulo de IA não está ativo. */
  ai: AiUsageHealth | null;
}

export type MonitoringState =
  | "loading"
  | "ready"
  | "unavailable" // sem módulos/dados para monitorar
  | "forbidden"; // sem permissão
