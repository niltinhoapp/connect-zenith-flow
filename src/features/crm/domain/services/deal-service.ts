import { eventBus } from "@/core/events";
import { invariant } from "@/core/domain";
import { Deal, type CreateDealInput } from "../entities/deal";
import type { DealFilter, DealRepository } from "../repositories/deal-repository";

/**
 * Serviço de domínio do CRM. Regras via entidade, persistência via repository,
 * eventos via bus. Ao ganhar um negócio, publica `deal.won` (outros módulos —
 * billing, notifications — reagem sem acoplamento).
 */
export class DealService {
  constructor(private readonly repo: DealRepository) {}

  list(filter?: DealFilter): Promise<Deal[]> {
    return this.repo.findMany(filter);
  }

  async create(input: CreateDealInput): Promise<Deal> {
    const deal = Deal.create(input);
    const saved = await this.repo.create(deal);
    await eventBus.publish("deal.created", {
      organizationId: saved.organizationId,
      dealId: saved.id,
    });
    return saved;
  }

  async moveStage(id: string, stage: string): Promise<Deal> {
    const deal = await this.repo.findById(id);
    invariant(deal, "Negócio não encontrado");
    deal.moveTo(stage);
    const saved = await this.repo.update(deal);
    if (saved.isWon) {
      await eventBus.publish("deal.won", {
        organizationId: saved.organizationId,
        dealId: saved.id,
        amount: saved.amount,
      });
    }
    return saved;
  }

  async markWon(id: string): Promise<Deal> {
    const deal = await this.repo.findById(id);
    invariant(deal, "Negócio não encontrado");
    deal.markWon();
    const saved = await this.repo.update(deal);
    await eventBus.publish("deal.won", {
      organizationId: saved.organizationId,
      dealId: saved.id,
      amount: saved.amount,
    });
    return saved;
  }

  async remove(id: string): Promise<void> {
    await this.repo.delete(id);
  }
}
