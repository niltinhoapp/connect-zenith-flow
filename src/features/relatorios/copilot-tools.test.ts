import { describe, expect, it } from "vitest";
import { createReportsOverviewTool } from "@/features/relatorios/copilot-tools";
import type { CopilotExecutionContext } from "@/core";

const context: CopilotExecutionContext = {
  organizationId: "org-1",
  actorId: "user-1",
  enabledModules: ["relatorios"],
  permissions: ["relatorios.read"],
};

describe("Relatórios · Copilot tools", () => {
  it("calcula conversão e destaca a melhor origem sem inventar indicadores", async () => {
    const tool = createReportsOverviewTool({
      async getMetrics() {
        return {
          revenueTotal: 500000,
          wonCount: 10,
          avgTicket: 50000,
          revenueTrend: [],
          funnel: [
            { s: "Leads", v: 40 },
            { s: "Convertidos", v: 10 },
          ],
          sources: [
            { n: "Instagram", v: 8 },
            { n: "WhatsApp", v: 21 },
          ],
        };
      },
    });

    const result = await tool.execute({}, context);

    expect(result.summary).toContain("conversão é 25");
    expect(result.summary).toContain("WhatsApp");
    expect(result.data?.strongestSource).toBe("WhatsApp");
    expect(result.navigateTo).toBe("/relatorios");
  });
});

