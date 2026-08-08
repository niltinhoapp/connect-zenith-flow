import { PERMISSIONS, registerCopilotTool } from "@/core";
import type { CopilotTool } from "@/core";
import type {
  ReportsApplicationService,
  ReportsMetrics,
} from "@/features/relatorios/application/reports-service";

export interface ReportsCopilotSummary {
  metrics: ReportsMetrics;
  conversionRate: number;
  strongestSource: string | null;
}

const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function createReportsOverviewTool(
  service: Pick<ReportsApplicationService, "getMetrics">,
): CopilotTool<Record<string, never>, ReportsCopilotSummary> {
  return {
    name: "relatorios.overview.read",
    title: "Analisar resultados",
    description: "Consulta faturamento, conversão, ticket médio e origem dos leads.",
    module: "relatorios",
    permissions: [PERMISSIONS.RELATORIOS_READ],
    risk: "read",
    async execute() {
      const metrics = await service.getMetrics();
      const leads = metrics.funnel.find((step) => step.s === "Leads")?.v ?? 0;
      const converted = metrics.funnel.find((step) => step.s === "Convertidos")?.v ?? 0;
      const conversionRate = leads > 0 ? Math.round((converted / leads) * 1000) / 10 : 0;
      const strongestSource = [...metrics.sources].sort((a, b) => b.v - a.v)[0]?.n ?? null;
      const sourceText = strongestSource
        ? `A principal origem de leads é ${strongestSource}.`
        : "Ainda não há origem de leads suficiente para comparar.";

      return {
        summary: `A receita acumulada é ${brl(metrics.revenueTotal)}, com ${metrics.wonCount} negócios ganhos e ticket médio de ${brl(metrics.avgTicket)}. A conversão é ${conversionRate.toLocaleString("pt-BR")}. ${sourceText}`,
        data: { metrics, conversionRate, strongestSource },
        navigateTo: "/relatorios",
      };
    },
  };
}

export function registerReportsCopilotTools(
  service: Pick<ReportsApplicationService, "getMetrics">,
): void {
  registerCopilotTool(createReportsOverviewTool(service));
}
