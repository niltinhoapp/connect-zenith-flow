import { PERMISSIONS, registerCopilotTool } from "@/core";
import type { CopilotTool } from "@/core";
import type { CustomerApplicationService } from "@/features/clientes/application/customer-application-service";
import { Customer, CUSTOMER_STATUSES, type CustomerStatusValue } from "@/features/clientes/domain";

export interface CustomersCopilotSummary {
  total: number;
  byStatus: Record<CustomerStatusValue, number>;
  inactiveCustomers: Array<{ id: string; name: string }>;
}

export interface CopilotCustomerInput {
  firstName: string;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  status?: CustomerStatusValue;
  tags?: string[];
  notes?: string | null;
}

export interface CreateCustomersBatchInput {
  customers: CopilotCustomerInput[];
}

export interface CreateCustomersBatchResult {
  created: Array<{ id: string; name: string }>;
  skipped: Array<{ name: string; reason: string }>;
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

const normalized = (value: string | null | undefined) => value?.trim().toLocaleLowerCase("pt-BR") ?? "";
const digits = (value: string | null | undefined) => value?.replace(/\D/g, "") ?? "";
const canonicalPhone = (value: string | null | undefined) => {
  const valueDigits = digits(value);
  return valueDigits.length === 10 || valueDigits.length === 11 ? `55${valueDigits}` : valueDigits;
};

export function createCustomersBatchTool(
  service: Pick<CustomerApplicationService, "list" | "create">,
): CopilotTool<CreateCustomersBatchInput, CreateCustomersBatchResult> {
  return {
    name: "clientes.create.batch",
    title: "Cadastrar clientes",
    description: "Valida uma lista, evita duplicados e cadastra os clientes após sua confirmação.",
    module: "clientes",
    permissions: [PERMISSIONS.CLIENTES_WRITE],
    risk: "write",
    async execute(input, context) {
      const requested = Array.isArray(input?.customers) ? input.customers.slice(0, 20) : [];
      if (requested.length === 0) throw new Error("A IA não encontrou clientes válidos para cadastrar.");

      // Valida toda a lista antes da primeira gravação para evitar lote parcialmente inválido.
      for (const item of requested) {
        Customer.create({
          organizationId: context.organizationId,
          firstName: item.firstName,
          lastName: item.lastName,
          email: item.email,
          mobile: item.phone,
          status: item.status,
          tags: item.tags,
          notes: item.notes,
          source: "copilot",
          originChannel: "ai_copilot",
        });
      }

      const created: CreateCustomersBatchResult["created"] = [];
      const skipped: CreateCustomersBatchResult["skipped"] = [];
      const seen = new Set<string>();

      for (const item of requested) {
        const name = [item.firstName, item.lastName].filter(Boolean).join(" ").trim();
        const identity = normalized(item.email)
          ? `email:${normalized(item.email)}`
          : canonicalPhone(item.phone)
            ? `phone:${canonicalPhone(item.phone)}`
            : `name:${normalized(name)}`;
        if (seen.has(identity)) {
          skipped.push({ name, reason: "duplicado na lista" });
          continue;
        }
        seen.add(identity);

        const search = item.email || (item.phone ? digits(item.phone) : name);
        const candidates = await service.list({ search, limit: 20 });
        const duplicate = candidates.items.some((customer) => {
          const data = customer.toJSON();
          if (item.email && normalized(data.email) === normalized(item.email)) return true;
          if (item.phone && [data.phone, data.mobile].some((phone) => canonicalPhone(phone) === canonicalPhone(item.phone))) return true;
          return !item.email && !item.phone && normalized(customer.displayName) === normalized(name);
        });
        if (duplicate) {
          skipped.push({ name, reason: "já existe no CRM" });
          continue;
        }

        const customer = await service.create({
          firstName: item.firstName,
          lastName: item.lastName,
          email: item.email,
          mobile: item.phone,
          status: item.status,
          tags: item.tags,
          notes: item.notes,
          source: "copilot",
          originChannel: "ai_copilot",
        });
        created.push({ id: customer.id, name: customer.displayName });
      }

      return {
        summary: `${created.length} cliente(s) cadastrado(s).${skipped.length ? ` ${skipped.length} ignorado(s) por duplicidade.` : ""}`,
        data: { created, skipped },
        navigateTo: "/clientes",
      };
    },
  };
}

export function registerCustomersCopilotTools(
  service: Pick<CustomerApplicationService, "list" | "create">,
): void {
  registerCopilotTool(createCustomersOverviewTool(service));
  registerCopilotTool(createCustomersBatchTool(service));
}
