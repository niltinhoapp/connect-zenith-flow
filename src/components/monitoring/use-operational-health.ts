/**
 * Adaptador visual do Monitoramento: monta OperationalHealth a partir dos hooks
 * JÁ existentes (somente leitura). Não cria contrato novo nem dados falsos —
 * onde não há fonte real, retorna null e a UI mostra estado honesto.
 *
 * Fontes: useSettings (WhatsApp + franquia de IA), useAutomations (ativas/
 * pausadas), useConversations (últimos recebimento/envio recentes).
 */
import { useSession } from "@/core/auth";
import { useSettings } from "@/features/configuracoes";
import { useAutomations } from "@/features/automacoes/hooks/use-automacoes";
import { useConversations } from "@/features/whatsapp/hooks/use-inbox";
import type {
  MonitoringState,
  OperationalHealth,
  WhatsAppHealthStatus,
} from "./types";

function maxIso(values: Array<string | null>): string | null {
  let best: number | null = null;
  let bestIso: string | null = null;
  for (const value of values) {
    if (!value) continue;
    const time = new Date(value).getTime();
    if (Number.isNaN(time)) continue;
    if (best === null || time > best) {
      best = time;
      bestIso = value;
    }
  }
  return bestIso;
}

function mapWhatsAppStatus(
  connected: boolean,
  status: "connected" | "disconnected" | "error" | "pending" | null,
): WhatsAppHealthStatus {
  if (status === "error") return "action_required";
  if (status === "pending") return "attention";
  if (connected && status === "connected") return "connected";
  if (status === null) return "unknown";
  return "disconnected";
}

export function useOperationalHealth(): { state: MonitoringState; health: OperationalHealth | null } {
  const session = useSession();
  const modules = session?.enabledModules ?? [];
  const waEnabled = modules.includes("whatsapp");
  const iaEnabled = modules.includes("ia");
  const automacoesEnabled = modules.includes("automacoes");

  const settings = useSettings();
  const automations = useAutomations();
  const conversations = useConversations();

  if (settings.isLoading) return { state: "loading", health: null };
  if (!settings.data) return { state: "unavailable", health: null };

  const wa = settings.data.whatsapp;
  const convos = waEnabled ? (conversations.data?.items ?? []).map((c) => c.toJSON()) : [];

  const rows = automacoesEnabled ? (automations.data ?? []) : [];
  const active = rows.filter((r) => r.status === "active").length;
  const paused = rows.filter((r) => r.status === "paused").length;

  const aiUsage = settings.data.usage.find(
    (u) => u.resource === "ai_credits" && u.period === "month",
  );

  const health: OperationalHealth = {
    whatsapp: {
      status: waEnabled ? mapWhatsAppStatus(wa.connected, wa.status) : "unknown",
      name: wa.name,
      lastInboundAt: maxIso(convos.map((c) => c.lastInboundAt)),
      lastOutboundAt: maxIso(convos.map((c) => c.lastOutboundAt)),
    },
    automations: {
      active,
      paused,
      failed: null, // aguardando contrato do Codex (runs com falha)
    },
    processing: {
      pending: null, // aguardando contrato do Codex
      errored: null, // aguardando contrato do Codex
    },
    ai:
      iaEnabled && aiUsage
        ? { used: aiUsage.used, limit: aiUsage.limit, extraCredits: null }
        : null,
  };

  return { state: "ready", health };
}
