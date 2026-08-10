import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { guard } from "@/core/application/guard";
import { assertModuleEnabled } from "@/core/feature-flags";
import { InfrastructureError } from "@/core/errors";
import type { ServiceContext } from "@/core/application/context";

export interface TrendPoint {
  m: string;
  v: number;
}
export interface FunnelStep {
  s: string;
  v: number;
}
export interface SourceSlice {
  n: string;
  v: number;
}
export interface ReportsMetrics {
  revenueTotal: number;
  wonCount: number;
  avgTicket: number;
  revenueTrend: TrendPoint[];
  funnel: FunnelStep[];
  sources: SourceSlice[];
  generatedAt: string;
}

const EMPTY: ReportsMetrics = {
  revenueTotal: 0,
  wonCount: 0,
  avgTicket: 0,
  revenueTrend: [],
  funnel: [],
  sources: [],
  generatedAt: "",
};

const finiteNonNegative = (value: unknown): number => {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
};

const text = (value: unknown): string => typeof value === "string" ? value.trim().slice(0, 80) : "";

/** Normaliza a resposta não-confiável da RPC e mantém os KPIs consistentes. */
export function normalizeReportsMetrics(value: unknown, now = new Date()): ReportsMetrics {
  const raw = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const revenueTotal = finiteNonNegative(raw.revenueTotal);
  const wonCount = Math.floor(finiteNonNegative(raw.wonCount));
  const revenueTrend = Array.isArray(raw.revenueTrend)
    ? raw.revenueTrend.slice(-12).map((point) => {
      const item = point && typeof point === "object" ? point as Record<string, unknown> : {};
      return { m: text(item.m) || "—", v: finiteNonNegative(item.v) };
    })
    : [];
  const funnel = Array.isArray(raw.funnel)
    ? raw.funnel.slice(0, 10).map((step) => {
      const item = step && typeof step === "object" ? step as Record<string, unknown> : {};
      return { s: text(item.s) || "—", v: Math.floor(finiteNonNegative(item.v)) };
    })
    : [];
  const sources = Array.isArray(raw.sources)
    ? raw.sources.slice(0, 5).map((source) => {
      const item = source && typeof source === "object" ? source as Record<string, unknown> : {};
      return { n: text(item.n) || "Outros", v: Math.floor(finiteNonNegative(item.v)) };
    })
    : [];

  return {
    ...EMPTY,
    revenueTotal,
    wonCount,
    // Fonte única: evita divergência se uma versão antiga da RPC enviar avgTicket incorreto.
    avgTicket: wonCount > 0 ? Math.floor(revenueTotal / wonCount) : 0,
    revenueTrend,
    funnel,
    sources,
    generatedAt: now.toISOString(),
  };
}

/**
 * ReportsApplicationService — read model de relatórios. Só agregações (RPC no
 * banco). Mesma fonte da verdade que a IA usará futuramente.
 */
export class ReportsApplicationService {
  constructor(
    private readonly db: SupabaseClient<Database>,
    private readonly ctx: ServiceContext,
  ) {}

  getMetrics(): Promise<ReportsMetrics> {
    return guard(async () => {
      assertModuleEnabled(this.ctx.enabledModules, "relatorios");
      const { data, error } = await this.db.rpc("reports_metrics", { p_org: this.ctx.organizationId });
      if (error) throw new InfrastructureError(error.message, { cause: error });
      return normalizeReportsMetrics(data);
    }, { service: "reports.metrics" });
  }
}
