import { describe, it, expect, vi } from "vitest";
import { eventBus } from "@/core/events";
import type { ServiceContext } from "@/core/application/context";
import type { Paginated } from "@/core/domain";
import { Lead } from "../domain/entities/lead";
import type { LeadRepository } from "../domain/repositories/lead-repository";
import { LeadApplicationService } from "./lead-application-service";

function makeRepo(): LeadRepository {
  const store = new Map<string, Lead>();
  return {
    async findById(id) {
      return store.get(id) ?? null;
    },
    async list() {
      return [...store.values()];
    },
    async findMany(): Promise<Paginated<Lead>> {
      return { items: [...store.values()], total: store.size };
    },
    async create(l) {
      store.set(l.id, l);
      return l;
    },
    async update(l) {
      store.set(l.id, l);
      return l;
    },
    async delete(id) {
      store.delete(id);
    },
    async convert() {
      return "customer-123";
    },
  };
}

const ctx: ServiceContext = { organizationId: "org-1", actorId: "u", enabledModules: ["clientes"] };

describe("LeadApplicationService", () => {
  it("cria lead e publica lead.created", async () => {
    const service = new LeadApplicationService(makeRepo(), ctx);
    const spy = vi.fn();
    const off = eventBus.subscribe("lead.created", spy);
    const lead = await service.create({ name: "Contato Frio" });
    expect(lead.organizationId).toBe("org-1");
    expect(spy).toHaveBeenCalledTimes(1);
    off();
  });

  it("converte lead → customer e publica lead.converted", async () => {
    const service = new LeadApplicationService(makeRepo(), ctx);
    const created = await service.create({ name: "Lead Quente" });
    const spy = vi.fn();
    const off = eventBus.subscribe("lead.converted", spy);
    const customerId = await service.convert(created.id);
    expect(customerId).toBe("customer-123");
    expect(spy.mock.calls[0][0].payload.customerId).toBe("customer-123");
    off();
  });
});
