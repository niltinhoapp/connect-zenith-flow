import { PERMISSIONS, registerCopilotTool } from "@/core";
import type { CopilotTool } from "@/core";
import type {
  DashboardApplicationService,
  DashboardMetrics,
} from "@/features/dashboard/application/dashboard-service";

export interface DashboardCopilotSummary {
  metrics: DashboardMetrics;
  highlights: string[];
}

const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function createDashboardMetricsTool(
  service: Pick<DashboardApplicationService, "getMetrics">,
): CopilotTool<Record<string, never>, DashboardCopilotSummary> {
  return {
    name: "dashboard.metrics.read",
    title: "Consultar resumo do negócio",
    description: "Consulta receita, clientes, oportunidades e conversão do painel.",
    module: "dashboard",
    permissions: [PERMISSIONS.DASHBOARD_READ],
    risk: "read",
    async execute() {
      const metrics = await service.getMetrics();
      const highlights = [
        `Receita do mês: ${brl(metrics.revenue)}.`,
        `${metrics.activeCustomers} clientes ativos e ${metrics.openDeals} negócios em aberto.`,
        `Conversão atual: ${metrics.conversionRate.toLocaleString("pt-BR")}% e ticket médio de ${brl(metrics.avgTicket)}.`,
      ];

      return {
        summary: highlights.join(" "),
        data: { metrics, highlights },
        navigateTo: "/",
      };
    },
  };
}

export function registerDashboardCopilotTools(
  service: Pick<DashboardApplicationService, "getMetrics">,
): void {
  registerCopilotTool(createDashboardMetricsTool(service));
}
