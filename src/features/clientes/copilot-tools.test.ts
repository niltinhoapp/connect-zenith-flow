import { describe, expect, it } from "vitest";
import type { CopilotExecutionContext } from "@/core";
import { Customer } from "@/features/clientes/domain";
import { createCustomersOverviewTool } from "@/features/clientes/copilot-tools";

const context: CopilotExecutionContext = {
  organizationId: "org-1",
  actorId: "user-1",
  enabledModules: ["clientes"],
  permissions: ["clientes.read"],
};

describe("Clientes · Copilot tools", () => {
  it("resume a base por status e oferece uma amostra de clientes inativos", async () => {
    const inactive = Customer.create(
      { organizationId: "org-1", firstName: "Marina", status: "inactive" },
      "customer-1",
    );
    const totals = { active: 20, inactive: 3, prospect: 7, vip: 2 };
    const tool = createCustomersOverviewTool({
      async list(filter) {
        const status = filter?.status as keyof typeof totals;
        return {
          total: totals[status],
          items: status === "inactive" ? [inactive] : [],
          limit: filter?.limit ?? 1,
          offset: 0,
        };
      },
    });

    const result = await tool.execute({}, context);

    expect(result.summary).toContain("32 clientes");
    expect(result.summary).toContain("3 estão inativos");
    expect(result.data?.inactiveCustomers).toEqual([{ id: "customer-1", name: "Marina" }]);
    expect(result.navigateTo).toBe("/clientes");
  });
});

