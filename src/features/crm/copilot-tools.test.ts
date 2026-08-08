import { describe, expect, it } from "vitest";
import type { CopilotExecutionContext } from "@/core";
import { createCrmPipelineTool } from "@/features/crm/copilot-tools";

const context: CopilotExecutionContext = {
  organizationId: "org-1",
  actorId: "user-1",
  enabledModules: ["crm"],
  permissions: ["crm.read"],
};

describe("CRM · Copilot tools", () => {
  it("destaca valor aberto e oportunidades antigas usando o read model do kanban", async () => {
    const tool = createCrmPipelineTool(
      {
        async getBoard() {
          return {
            pipelineId: "pipeline-1",
            stages: [
              { id: "open", name: "Em negociação", type: "open" as const },
              { id: "won", name: "Ganho", type: "won" as const },
            ],
            deals: [
              {
                id: "deal-1",
                title: "Pedido Maria",
                amount: 120000,
                currency: "BRL",
                stageId: "open",
                customerName: "Maria",
                ownerName: "Ana",
                tags: [],
                createdAt: "2026-07-01T00:00:00.000Z",
              },
              {
                id: "deal-2",
                title: "Pedido concluído",
                amount: 50000,
                currency: "BRL",
                stageId: "won",
                customerName: "João",
                ownerName: "Ana",
                tags: [],
                createdAt: "2026-07-02T00:00:00.000Z",
              },
            ],
          };
        },
      },
      () => new Date("2026-08-01T00:00:00.000Z"),
    );

    const result = await tool.execute({}, context);

    expect(result.summary).toContain("1 oportunidades abertas");
    expect(result.summary).toContain("R$\u00a01.200,00");
    expect(result.data?.oldestOpenDeals[0]?.daysOpen).toBe(31);
    expect(result.navigateTo).toBe("/crm");
  });
});

