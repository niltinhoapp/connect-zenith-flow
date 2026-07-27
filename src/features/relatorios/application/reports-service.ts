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
}

const EMPTY: ReportsMetrics = {
  revenueTotal: 0,
  wonCount: 0,
  avgTicket: 0,
  revenueTrend: [],
  funnel: [],
  sources: [],
};

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
      return { ...EMPTY, ...((data as Partial<ReportsMetrics>) ?? {}) };
    }, { service: "reports.metrics" });
  }
}
