import { PERMISSIONS, registerCopilotTool } from "@/core";
import type { CopilotTool } from "@/core";
import type { CustomerApplicationService } from "@/features/clientes/application/customer-application-service";
import { CUSTOMER_STATUSES, type CustomerStatusValue } from "@/features/clientes/domain";

export interface CustomersCopilotSummary {
  total: number;
  byStatus: Record<CustomerStatusValue, number>;
  inactiveCustomers: Array<{ id: string; name: string }>;
}

export function createCustomersOverviewTool(
  service: Pick<CustomerApplicationService, "list">,
): CopilotTool<Record<string, never>, CustomersCopilotSummary> {
  return {
    name: "clientes.overview.read",
    title: "Analisar base de clientes",
    description: "Conta clientes por situação e destaca contatos inativos.",
    module: "clientes",
    permissions: [PERMISSIONS.CLIENTES_READ],
    risk: "read",
    async execute() {
      const results = await Promise.all(
        CUSTOMER_STATUSES.map((status) => service.list({ status, limit: status === "inactive" ? 5 : 1 })),
      );
      const byStatus = Object.fromEntries(
        CUSTOMER_STATUSES.map((status, index) => [status, results[index]?.total ?? 0]),
      ) as Record<CustomerStatusValue, number>;
      const total = Object.values(byStatus).reduce((sum, count) => sum + count, 0);
      const inactiveResult = results[CUSTOMER_STATUSES.indexOf("inactive")];
      const inactiveCustomers = (inactiveResult?.items ?? []).map((customer) => ({
        id: customer.id,
        name: customer.displayName,
      }));
      const inactiveText = byStatus.inactive
        ? `${byStatus.inactive} estão inativos e podem precisar de reativação.`
        : "Não há clientes marcados como inativos.";

      return {
        summary: `Sua base possui ${total} clientes: ${byStatus.active} ativos, ${byStatus.prospect} potenciais e ${byStatus.vip} VIP. ${inactiveText}`,
        data: { total, byStatus, inactiveCustomers },
        navigateTo: "/clientes",
      };
    },
  };
}

export function registerCustomersCopilotTools(
  service: Pick<CustomerApplicationService, "list">,
): void {
  registerCopilotTool(createCustomersOverviewTool(service));
}
