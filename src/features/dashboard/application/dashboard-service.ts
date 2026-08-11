import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { guard } from "@/core/application/guard";
import { assertModuleEnabled } from "@/core/feature-flags";
import { InfrastructureError } from "@/core/errors";
import type { ServiceContext } from "@/core/application/context";

export interface PipelineStageCount {
  stage: string;
  count: number;
}
export interface DashboardActivity {
  id: string;
  title: string;
  eventType: string;
  module: string | null;
  createdAt: string;
}
export interface RevenuePoint {
  date: string;
  v: number; // receita ganha no dia (centavos)
  l: number; // novos leads no dia
}
export interface DashboardMetrics {
  activeCustomers: number;
  leadsPeriod: number;
  openDeals: number;
  revenue: number; // centavos (mês)
  wonCount: number;
  avgTicket: number; // centavos
  conversionRate: number; // %
  pipeline: PipelineStageCount[];
  recentActivities: DashboardActivity[];
  revenueSeries: RevenuePoint[];
}

const EMPTY: DashboardMetrics = {
  activeCustomers: 0,
  leadsPeriod: 0,
  openDeals: 0,
  revenue: 0,
  wonCount: 0,
  avgTicket: 0,
  conversionRate: 0,
  pipeline: [],
  recentActivities: [],
  revenueSeries: [],
};

/**
 * DashboardApplicationService — read model de indicadores. APENAS agregações
 * (nada de escrita/CRUD). Delega a agregação ao banco (RPC `dashboard_metrics`),
 * um único round-trip. Preparado para a IA consumir os mesmos indicadores.
 */
export class DashboardApplicationService {
  constructor(
    private readonly db: SupabaseClient<Database>,
    private readonly ctx: ServiceContext,
  ) {}

  getMetrics(): Promise<DashboardMetrics> {
    return guard(
      async () => {
        assertModuleEnabled(this.ctx.enabledModules, "dashboard");
        const { data, error } = await this.db.rpc("dashboard_metrics", {
          p_org: this.ctx.organizationId,
        });
        if (error) throw new InfrastructureError(error.message, { cause: error });
        return { ...EMPTY, ...((data as Partial<DashboardMetrics>) ?? {}) };
      },
      { service: "dashboard.metrics" },
    );
  }
}
