import { describe, it, expect, vi } from "vitest";
import { DomainError } from "@/core/domain";
import { eventBus } from "@/core/events";
import {
  Cliente,
  Email,
  ClienteService,
  type ClienteRepository,
} from "@/features/clientes/domain";

describe("Clientes · domínio (entidade + VOs)", () => {
  it("cria cliente válido e normaliza o e-mail", () => {
    const c = Cliente.create({ organizationId: "o", name: "Acme", email: "  JOAO@Acme.COM " });
    expect(c.name).toBe("Acme");
    expect(c.toJSON().email).toBe("joao@acme.com");
    expect(c.status).toBe("trial");
  });

  it("rejeita nome curto (invariante no domínio)", () => {
    expect(() => Cliente.create({ organizationId: "o", name: "A" })).toThrow(DomainError);
  });

  it("rejeita e-mail inválido", () => {
    expect(() => Email.create("nope")).toThrow(DomainError);
  });
});

function makeRepo(): ClienteRepository {
  const store = new Map<string, Cliente>();
  return {
    async findById(id) {
      return store.get(id) ?? null;
    },
    async list() {
      return [...store.values()];
    },
    async findMany() {
      return [...store.values()];
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

describe("Clientes · service (repo + Event Bus)", () => {
  it("persiste via repository e publica customer.created", async () => {
    const repo = makeRepo();
    const service = new ClienteService(repo);
    const spy = vi.fn();
    const off = eventBus.subscribe("customer.created", spy);

    const created = await service.create({ organizationId: "o", name: "Nova Corp" });

    expect(await repo.findById(created.id)).not.toBeNull();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0].payload.customerId).toBe(created.id);
    off();
  });
});
