import { describe, it, expect, vi } from "vitest";
import { eventBus } from "@/core/events";
import { PermissionError, NotFoundError, ValidationError } from "@/core/errors";
import type { ServiceContext } from "@/core/application/context";
import { Customer } from "../domain/entities/customer";
import type { CustomerRepository, Paginated } from "../domain/repositories/customer-repository";
import { CustomerApplicationService } from "./customer-application-service";

function makeRepo(): CustomerRepository {
  const store = new Map<string, Customer>();
  return {
    async findById(id) {
      return store.get(id) ?? null;
    },
    async list() {
      return [...store.values()];
    },
    async findMany(): Promise<Paginated<Customer>> {
      return { items: [...store.values()], total: store.size };
    },
    async create(c) {
      store.set(c.id, c);
      return c;
    },
    async update(c) {
      store.set(c.id, c);
      return c;
    },
    async delete(id) {
      store.delete(id);
    },
  };
}

const ctx: ServiceContext = { organizationId: "org-1", actorId: "u", enabledModules: ["clientes"] };

describe("CustomerApplicationService", () => {
  it("cria cliente, injeta a org da sessão e publica customer.created", async () => {
    const repo = makeRepo();
    const service = new CustomerApplicationService(repo, ctx);
    const spy = vi.fn();
    const off = eventBus.subscribe("customer.created", spy);

    const customer = await service.create({ firstName: "João" });

    expect(customer.organizationId).toBe("org-1");
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0].payload.customerId).toBe(customer.id);
    off();
  });

  it("bloqueia quando o módulo está desabilitado (PermissionError)", async () => {
    const service = new CustomerApplicationService(makeRepo(), { ...ctx, enabledModules: [] });
    await expect(service.create({ firstName: "X" })).rejects.toBeInstanceOf(PermissionError);
  });

  it("get inexistente lança NotFoundError", async () => {
    const service = new CustomerApplicationService(makeRepo(), ctx);
    await expect(service.get("nope")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("regra de domínio inválida vira ValidationError", async () => {
    const service = new CustomerApplicationService(makeRepo(), ctx);
    await expect(service.create({})).rejects.toBeInstanceOf(ValidationError);
  });
});
