import { describe, it, expect, vi } from "vitest";
import { DomainError } from "@/core/domain";
import { eventBus } from "@/core/events";
import { Deal, DealService, type DealRepository } from "@/features/crm/domain";

describe("CRM · domínio (entidade Deal)", () => {
  it("cria negócio e impede mudar estágio após ganho", () => {
    const d = Deal.create({ organizationId: "o", title: "Contrato X", amount: 1000 });
    d.markWon();
    expect(d.isWon).toBe(true);
    expect(() => d.moveTo("lead")).toThrow(DomainError);
  });

  it("rejeita valor negativo", () => {
    expect(() => Deal.create({ organizationId: "o", title: "X", amount: -5 })).toThrow(DomainError);
  });
});

function makeDealRepo(): DealRepository {
  const store = new Map<string, Deal>();
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
    async create(d) {
      store.set(d.id, d);
      return d;
    },
    async update(d) {
      store.set(d.id, d);
      return d;
    },
    async delete(id) {
      store.delete(id);
    },
  };
}

describe("CRM · service (deal.won via Event Bus)", () => {
  it("markWon publica deal.won com o valor", async () => {
    const repo = makeDealRepo();
    const service = new DealService(repo);
    const created = await service.create({ organizationId: "o", title: "Grande Conta", amount: 5000 });

    const spy = vi.fn();
    const off = eventBus.subscribe("deal.won", spy);
    await service.markWon(created.id);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0].payload.amount).toBe(5000);
    off();
  });
});
