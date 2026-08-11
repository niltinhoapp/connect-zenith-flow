import { describe, it, expect, vi } from "vitest";
import { eventBus } from "@/core/events";
import type { ServiceContext } from "@/core/application/context";
import type { Paginated } from "@/core/domain";
import { Deal } from "../domain/entities/deal";
import type { DealRepository } from "../domain/repositories/deal-repository";
import { DealApplicationService } from "./deal-application-service";

function makeRepo(): DealRepository {
  const store = new Map<string, Deal>();
  return {
    async findById(id) {
      return store.get(id) ?? null;
    },
    async list() {
      return [...store.values()];
    },
    async findMany(): Promise<Paginated<Deal>> {
      return { items: [...store.values()], total: store.size };
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

const ctx: ServiceContext = { organizationId: "org-1", actorId: "u", enabledModules: ["crm"] };

describe("DealApplicationService", () => {
  it("cria negócio e publica deal.created", async () => {
    const service = new DealApplicationService(makeRepo(), ctx);
    const spy = vi.fn();
    const off = eventBus.subscribe("deal.created", spy);
    const deal = await service.create({
      pipelineId: "p",
      stageId: "s1",
      title: "Contrato",
      amount: 5000,
    });
    expect(deal.organizationId).toBe("org-1");
    expect(spy).toHaveBeenCalledTimes(1);
    off();
  });

  it("mover para estágio 'won' publica deal.stage.changed e deal.won", async () => {
    const service = new DealApplicationService(makeRepo(), ctx);
    const deal = await service.create({
      pipelineId: "p",
      stageId: "s1",
      title: "Grande",
      amount: 9000,
    });
    const changed = vi.fn();
    const won = vi.fn();
    const offA = eventBus.subscribe("deal.stage.changed", changed);
    const offB = eventBus.subscribe("deal.won", won);

    const moved = await service.moveStage(deal.id, "s-won", "won");

    expect(moved.isWon).toBe(true);
    expect(changed.mock.calls[0][0].payload).toMatchObject({
      fromStageId: "s1",
      toStageId: "s-won",
    });
    expect(won.mock.calls[0][0].payload.amount).toBe(9000);
    offA();
    offB();
  });

  it("mover para 'lost' publica deal.lost", async () => {
    const service = new DealApplicationService(makeRepo(), ctx);
    const deal = await service.create({
      pipelineId: "p",
      stageId: "s1",
      title: "Perdido",
      amount: 100,
    });
    const lost = vi.fn();
    const off = eventBus.subscribe("deal.lost", lost);
    await service.moveStage(deal.id, "s-lost", "lost", "Sem orçamento");
    expect(lost.mock.calls[0][0].payload.reason).toBe("Sem orçamento");
    off();
  });
});
