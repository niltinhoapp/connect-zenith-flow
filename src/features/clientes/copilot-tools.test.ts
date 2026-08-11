import { describe, expect, it } from "vitest";
import type { CopilotExecutionContext } from "@/core";
import { Customer } from "@/features/clientes/domain";
import {
  createCustomersBatchTool,
  createCustomersOverviewTool,
} from "@/features/clientes/copilot-tools";

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

describe("Clientes · criação pelo Copiloto", () => {
  const writeContext: CopilotExecutionContext = {
    ...context,
    permissions: ["clientes.write"],
  };

  it("cadastra clientes válidos e marca a origem", async () => {
    const inputs: Array<Record<string, unknown>> = [];
    const tool = createCustomersBatchTool({
      async list() {
        return { items: [], total: 0, limit: 20, offset: 0 };
      },
      async create(input) {
        inputs.push(input);
        return Customer.create({ organizationId: "org-1", ...input }, "created-1");
      },
    });

    const result = await tool.execute(
      {
        customers: [{ firstName: "Ana", email: "ana@example.com", tags: ["Teste"] }],
      },
      writeContext,
    );

    expect(result.data?.created).toEqual([{ id: "created-1", name: "Ana" }]);
    expect(inputs[0]).toMatchObject({ source: "copilot", originChannel: "ai_copilot" });
  });

  it("não cria contato que já existe pelo telefone", async () => {
    const existing = Customer.create(
      { organizationId: "org-1", firstName: "Ana", mobile: "+55 11 99999-0000" },
      "existing-1",
    );
    let creates = 0;
    const tool = createCustomersBatchTool({
      async list() {
        return { items: [existing], total: 1, limit: 20, offset: 0 };
      },
      async create(input) {
        creates += 1;
        return Customer.create({ organizationId: "org-1", ...input });
      },
    });

    const result = await tool.execute(
      {
        customers: [{ firstName: "Ana", phone: "(11) 99999-0000" }],
      },
      writeContext,
    );

    expect(creates).toBe(0);
    expect(result.data?.skipped[0]?.reason).toBe("já existe no CRM");
  });

  it("valida todo o lote antes de gravar", async () => {
    let creates = 0;
    const tool = createCustomersBatchTool({
      async list() {
        return { items: [], total: 0, limit: 20, offset: 0 };
      },
      async create(input) {
        creates += 1;
        return Customer.create({ organizationId: "org-1", ...input });
      },
    });

    await expect(
      tool.execute(
        {
          customers: [{ firstName: "Ana" }, { firstName: "" }],
        },
        writeContext,
      ),
    ).rejects.toThrow("Nome é obrigatório");
    expect(creates).toBe(0);
  });
});
