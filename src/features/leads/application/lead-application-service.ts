import { eventBus } from "@/core/events";
import { guard } from "@/core/application/guard";
import { NotFoundError } from "@/core/errors";
import { assertModuleEnabled } from "@/core/feature-flags";
import type { ServiceContext } from "@/core/application/context";
import type { Paginated } from "@/core/domain";
import { Lead, type CreateLeadInput } from "../domain/entities/lead";
import type { LeadFilter, LeadRepository } from "../domain/repositories/lead-repository";

/**
 * LeadApplicationService — API interna do módulo Leads.
 * Fluxo: create → qualify → convert (Lead → Customer). A conversão nunca cria
 * um Deal; ela cria um Customer (a partir do qual Deals podem nascer).
 */
export class LeadApplicationService {
  constructor(
    private readonly repo: LeadRepository,
    private readonly ctx: ServiceContext,
  ) {}

  private ensureEnabled() {
    assertModuleEnabled(this.ctx.enabledModules, "clientes");
  }

  list(filter?: LeadFilter): Promise<Paginated<Lead>> {
    return guard(
      () => {
        this.ensureEnabled();
        return this.repo.findMany(filter);
      },
      { service: "lead.list" },
    );
  }

  get(id: string): Promise<Lead> {
    return guard(
      async () => {
        this.ensureEnabled();
        const lead = await this.repo.findById(id);
        if (!lead) throw new NotFoundError("Lead não encontrado");
        return lead;
      },
      { service: "lead.get", id },
    );
  }

  create(input: Omit<CreateLeadInput, "organizationId">): Promise<Lead> {
    return guard(
      async () => {
        this.ensureEnabled();
        const lead = Lead.create({ ...input, organizationId: this.ctx.organizationId });
        const saved = await this.repo.create(lead);
        await eventBus.publish("lead.created", {
          organizationId: saved.organizationId,
          leadId: saved.id,
        });
        return saved;
      },
      { service: "lead.create" },
    );
  }

  qualify(id: string): Promise<Lead> {
    return guard(
      async () => {
        this.ensureEnabled();
        const lead = await this.repo.findById(id);
        if (!lead) throw new NotFoundError("Lead não encontrado");
        lead.qualify();
        return this.repo.update(lead);
      },
      { service: "lead.qualify", id },
    );
  }

  /** Converte o lead em customer (RPC transacional) e publica lead.converted. */
  convert(id: string): Promise<string> {
    return guard(
      async () => {
        this.ensureEnabled();
        const lead = await this.repo.findById(id);
        if (!lead) throw new NotFoundError("Lead não encontrado");
        const customerId = await this.repo.convert(id);
        await eventBus.publish("lead.converted", {
          organizationId: this.ctx.organizationId,
          leadId: id,
          customerId,
        });
        return customerId;
      },
      { service: "lead.convert", id },
    );
  }

  remove(id: string): Promise<void> {
    return guard(
      async () => {
        this.ensureEnabled();
        await this.repo.delete(id);
      },
      { service: "lead.remove", id },
    );
  }
}
