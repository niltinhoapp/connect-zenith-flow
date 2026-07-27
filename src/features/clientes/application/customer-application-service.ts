import { eventBus } from "@/core/events";
import { guard } from "@/core/application/guard";
import { NotFoundError } from "@/core/errors";
import { assertModuleEnabled } from "@/core/feature-flags";
import type { ServiceContext } from "@/core/application/context";
import { Customer, type CreateCustomerInput } from "../domain/entities/customer";
import type {
  CustomerFilter,
  CustomerRepository,
  Paginated,
} from "../domain/repositories/customer-repository";

export interface UpdateCustomerInput {
  status?: string;
  email?: string | null;
  phone?: string | null;
  mobile?: string | null;
}

/**
 * CustomerApplicationService — API interna do módulo Clientes.
 *
 * Coordena: feature flags → validações (domínio) → repository (persistência)
 * → Event Bus (eventos) → auditoria (via triggers no banco). As telas React
 * falam SÓ com este serviço (nunca com o repository).
 */
export class CustomerApplicationService {
  constructor(
    private readonly repo: CustomerRepository,
    private readonly ctx: ServiceContext,
  ) {}

  private ensureEnabled() {
    assertModuleEnabled(this.ctx.enabledModules, "clientes");
  }

  list(filter?: CustomerFilter): Promise<Paginated<Customer>> {
    return guard(() => {
      this.ensureEnabled();
      return this.repo.findMany(filter);
    }, { service: "customer.list" });
  }

  get(id: string): Promise<Customer> {
    return guard(async () => {
      this.ensureEnabled();
      const customer = await this.repo.findById(id);
      if (!customer) throw new NotFoundError("Cliente não encontrado");
      return customer;
    }, { service: "customer.get", id });
  }

  create(input: Omit<CreateCustomerInput, "organizationId">): Promise<Customer> {
    return guard(async () => {
      this.ensureEnabled();
      const customer = Customer.create({ ...input, organizationId: this.ctx.organizationId });
      const saved = await this.repo.create(customer);
      await eventBus.publish("customer.created", {
        organizationId: saved.organizationId,
        customerId: saved.id,
      });
      return saved;
    }, { service: "customer.create" });
  }

  update(id: string, changes: UpdateCustomerInput): Promise<Customer> {
    return guard(async () => {
      this.ensureEnabled();
      const customer = await this.repo.findById(id);
      if (!customer) throw new NotFoundError("Cliente não encontrado");
      if (changes.status !== undefined) customer.changeStatus(changes.status);
      if (changes.email !== undefined || changes.phone !== undefined || changes.mobile !== undefined) {
        customer.updateContact(changes);
      }
      const saved = await this.repo.update(customer);
      await eventBus.publish("customer.updated", {
        organizationId: saved.organizationId,
        customerId: saved.id,
      });
      return saved;
    }, { service: "customer.update", id });
  }

  remove(id: string): Promise<void> {
    return guard(async () => {
      this.ensureEnabled();
      await this.repo.delete(id);
    }, { service: "customer.remove", id });
  }
}
