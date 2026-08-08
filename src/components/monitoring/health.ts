/**
 * Lógica pura de saúde/alertas do Monitoramento (frente Claude).
 * Sem dados nem chamadas — só cálculo e texto simples para o lojista.
 */
import type { WhatsAppHealthStatus } from "./types";

export type AlertLevel = "ok" | "warn70" | "warn90" | "over100";

/** Nível de alerta da franquia de IA a partir do percentual de uso. */
export function aiAlertLevel(used: number, limit: number): { pct: number; level: AlertLevel } {
  if (limit <= 0) return { pct: 0, level: "ok" };
  const pct = Math.round((used / limit) * 100);
  if (pct >= 100) return { pct, level: "over100" };
  if (pct >= 90) return { pct, level: "warn90" };
  if (pct >= 70) return { pct, level: "warn70" };
  return { pct, level: "ok" };
}

/** Mensagem curta em PT para cada nível de uso da franquia de IA. */
export function aiAlertMessage(level: AlertLevel): string | null {
  switch (level) {
    case "warn70":
      return "Você já usou 70% dos créditos de IA do mês. Fique de olho no ritmo.";
    case "warn90":
      return "Você já usou 90% dos créditos de IA do mês. Considere um pacote adicional para não parar.";
    case "over100":
      return "A franquia de IA do mês acabou. O sistema segue funcionando sem IA; adicione um pacote para reativar os recursos de IA.";
    default:
      return null;
  }
}

/** Rótulo e orientação por situação do WhatsApp — "o que aconteceu / como resolver". */
export function whatsappGuidance(status: WhatsAppHealthStatus): {
  label: string;
  tone: "ok" | "warn" | "danger" | "muted";
  help: string | null;
} {
  switch (status) {
    case "connected":
      return { label: "Conectado", tone: "ok", help: null };
    case "attention":
      return {
        label: "Atenção",
        tone: "warn",
        help: "A conexão está instável ou pendente de confirmação. Aguarde alguns minutos; se persistir, reconecte em Integrações.",
      };
    case "action_required":
      return {
        label: "Ação necessária",
        tone: "danger",
        help: "O envio está falhando (a conta pode ter perdido a autorização). Vá em Integrações e reconecte o WhatsApp com um token válido.",
      };
    case "disconnected":
      return {
        label: "Desconectado",
        tone: "danger",
        help: "Nenhuma conta de WhatsApp está conectada. Conecte em Configurações → Integrações para enviar e receber mensagens.",
      };
    default:
      return { label: "Sem dados", tone: "muted", help: null };
  }
}
