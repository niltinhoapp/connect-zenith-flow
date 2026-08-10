import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { eventBus, publishDurable } from "@/core/events";
import { guard } from "@/core/application/guard";
import { NotFoundError } from "@/core/errors";
import { assertModuleEnabled } from "@/core/feature-flags";
import type { ServiceContext } from "@/core/application/context";
import type { Paginated } from "@/core/domain";
import { Deal, type CreateDealInput, type StageType } from "../domain/entities/deal";
import type { DealFilter, DealRepository } from "../domain/repositories/deal-repository";

/**
 * DealApplicationService — API interna do módulo CRM.
 * Coordena regras (Deal), persistência (repository) e eventos. Ao mover para um
 * estágio "won"/"lost", publica os eventos correspondentes (billing,
 * notifications e relatórios reagem via Event Bus).
 */
export class DealApplicationService {
  constructor(
    private readonly repo: DealRepository,
    private readonly ctx: ServiceContext,
    private readonly db?: SupabaseClient<Database>,
  ) {}

  private async publishDurable(name: "deal.created" | "deal.updated" | "deal.stage.changed", payload: Record<string, unknown>) {
    if (!this.db) return;
    try {
      await publishDurable(this.db, name, { organizationId: this.ctx.organizationId, ...payload } as never);
    } catch { /* o outbox não deve transformar uma gravação concluída em falha para o atendente */ }
  }

  private ensureEnabled() {
    assertModuleEnabled(this.ctx.enabledModules, "crm");
  }

  list(filter?: DealFilter): Promise<Paginated<Deal>> {
    return guard(() => {
      this.ensureEnabled();
      return this.repo.findMany(filter);
    }, { service: "deal.list" });
  }

  get(id: string): Promise<Deal> {
    return guard(async () => {
      this.ensureEnabled();
      const deal = await this.repo.findById(id);
      if (!deal) throw new NotFoundError("Negócio não encontrado");
      return deal;
    }, { service: "deal.get", id });
  }

  create(input: Omit<CreateDealInput, "organizationId">): Promise<Deal> {
    return guard(async () => {
      this.ensureEnabled();
      const deal = Deal.create({ ...input, organizationId: this.ctx.organizationId });
      const saved = await this.repo.create(deal);
      await eventBus.publish("deal.created", {
        organizationId: saved.organizationId,
        dealId: saved.id,
      });
      await this.publishDurable("deal.created", { dealId: saved.id });
      return saved;
    }, { service: "deal.create" });
  }

  update(id: string, changes: Parameters<Deal["updateDetails"]>[0]): Promise<Deal> {
    return guard(async () => {
      this.ensureEnabled();
      const deal = await this.repo.findById(id);
      if (!deal) throw new NotFoundError("Negócio não encontrado");
      deal.updateDetails(changes);
      const saved = await this.repo.update(deal);
      await eventBus.publish("deal.updated", { organizationId: saved.organizationId, dealId: saved.id });
      await this.publishDurable("deal.updated", { dealId: saved.id });
      return saved;
    }, { service: "deal.update", id });
  }

  moveStage(id: string, stageId: string, stageType: StageType, reason?: string): Promise<Deal> {
    return guard(async () => {
      this.ensureEnabled();
      const deal = await this.repo.findById(id);
      if (!deal) throw new NotFoundError("Negócio não encontrado");
      const fromStageId = deal.stageId;
      deal.moveToStage(stageId, stageType, reason);
      const saved = await this.repo.update(deal);

      await eventBus.publish("deal.stage.changed", {
        organizationId: saved.organizationId,
        dealId: saved.id,
        fromStageId,
        toStageId: stageId,
      });
      await this.publishDurable("deal.stage.changed", { dealId: saved.id, fromStageId, toStageId: stageId });
      if (stageType === "won") {
        await eventBus.publish("deal.won", {
          organizationId: saved.organizationId,
          dealId: saved.id,
          amount: saved.amount,
        });
      } else if (stageType === "lost") {
        await eventBus.publish("deal.lost", {
          organizationId: saved.organizationId,
          dealId: saved.id,
          reason,
        });
      }
      return saved;
    }, { service: "deal.moveStage", id });
  }

  remove(id: string): Promise<void> {
    return guard(async () => {
      this.ensureEnabled();
      await this.repo.delete(id);
    }, { service: "deal.remove", id });
  }
}
