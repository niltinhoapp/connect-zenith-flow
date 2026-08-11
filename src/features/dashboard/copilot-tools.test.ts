import { describe, expect, it } from "vitest";
import { createDashboardMetricsTool } from "@/features/dashboard/copilot-tools";
import type { CopilotExecutionContext } from "@/core";

const context: CopilotExecutionContext = {
  organizationId: "org-1",
  actorId: "user-1",
  enabledModules: ["dashboard"],
  permissions: ["dashboard.read"],
};

describe("Dashboard · Copilot tools", () => {
  it("transforma métricas reais em uma resposta simples para o lojista", async () => {
    const tool = createDashboardMetricsTool({
      async getMetrics() {
        return {
          activeCustomers: 32,
          leadsPeriod: 18,
          openDeals: 7,
          revenue: 125050,
          wonCount: 4,
          avgTicket: 31262,
          conversionRate: 22.2,
          pipeline: [],
          recentActivities: [],
          revenueSeries: [],
        };
      },
    });

    const result = await tool.execute({}, context);

    expect(result.summary).toContain("R$\u00a01.250,50");
    expect(result.summary).toContain("32 clientes ativos");
    expect(result.navigateTo).toBe("/");
    expect(result.data?.metrics.openDeals).toBe(7);
  });
});
