/**
 * Adaptador visual do Monitoramento: monta OperationalHealth a partir dos hooks
 * JÁ existentes (somente leitura). Não cria contrato novo nem dados falsos —
 * onde não há fonte real, retorna null e a UI mostra estado honesto.
 *
 * Fontes: useSettings (WhatsApp + franquia de IA), useAutomations (ativas/
 * pausadas), useConversations (últimos recebimento/envio recentes).
 */
import { useSession } from "@/core/auth";
import { useBillingOverview } from "@/core/billing";
import { isModuleEnabled } from "@/core/feature-flags";
import { useQuery } from "@tanstack/react-query";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
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
  const waEnabled = isModuleEnabled(modules, "whatsapp");
  const iaEnabled = isModuleEnabled(modules, "ia");
  const automacoesEnabled = isModuleEnabled(modules, "automacoes");
  const organizationId = session?.activeOrganization?.organizationId ?? null;

  const settings = useSettings();
  const automations = useAutomations();
  const conversations = useConversations();
  const billing = useBillingOverview();
  const operations = useQuery({
    queryKey: ["monitoring", organizationId, "operations"],
    enabled: Boolean(organizationId),
    refetchInterval: 30_000,
    queryFn: async () => {
      const db = getSupabaseBrowserClient();
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const [pendingJobs, erroredJobs, failedRuns] = await Promise.all([
        db.from("jobs").select("id", { count: "exact", head: true })
          .eq("organization_id", organizationId!).in("status", ["queued", "running"]),
        db.from("jobs").select("id", { count: "exact", head: true })
          .eq("organization_id", organizationId!).in("status", ["failed", "dead"]),
        db.from("automation_runs").select("id", { count: "exact", head: true })
          .eq("organization_id", organizationId!).eq("status", "failed").gte("updated_at", since),
      ]);
      const error = pendingJobs.error ?? erroredJobs.error ?? failedRuns.error;
      if (error) throw error;
      return {
        pending: pendingJobs.count ?? 0,
        errored: erroredJobs.count ?? 0,
        failedAutomations: failedRuns.count ?? 0,
      };
    },
  });

  if (settings.isLoading || billing.isLoading || operations.isLoading) return { state: "loading", health: null };
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
      failed: operations.data?.failedAutomations ?? null,
    },
    processing: {
      pending: operations.data?.pending ?? null,
      errored: operations.data?.errored ?? null,
    },
    ai:
      iaEnabled && aiUsage
        ? {
            used: billing.data?.ai.monthlyUsed ?? aiUsage.used,
            limit: billing.data?.ai.monthlyLimit ?? aiUsage.limit,
            extraCredits: billing.data?.ai.additionalBalance ?? null,
          }
        : null,
  };

  return { state: "ready", health };
}
