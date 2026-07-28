import { guard } from "@/core/application/guard";
import { assertModuleEnabled } from "@/core/feature-flags";
import { NotFoundError } from "@/core/errors";
import type { ServiceContext } from "@/core/application/context";
import type { Paginated } from "@/core/domain";
import { WhatsAppTemplate, type CreateTemplateInput } from "../domain/entities/whatsapp-template";
import type {
  TemplateFilter,
  TemplateRepository,
} from "../domain/repositories/template-repository";

/**
 * TemplateApplicationService — gestão de templates do módulo WhatsApp.
 * Cria rascunhos (status pending) dentro do tenant; a submissão/sincronização
 * com a Meta acontece no bloco live (job whatsapp.template.sync).
 */
export class TemplateApplicationService {
  constructor(
    private readonly repo: TemplateRepository,
    private readonly ctx: ServiceContext,
  ) {}

  private ensureEnabled() {
    assertModuleEnabled(this.ctx.enabledModules, "whatsapp");
  }

  list(filter?: TemplateFilter): Promise<Paginated<WhatsAppTemplate>> {
    return guard(
      () => {
        this.ensureEnabled();
        return this.repo.findMany(filter);
      },
      { service: "whatsapp.templates.list" },
    );
  }

  get(id: string): Promise<WhatsAppTemplate> {
    return guard(
      async () => {
        this.ensureEnabled();
        const tpl = await this.repo.findById(id);
        if (!tpl) throw new NotFoundError("Template não encontrado");
        return tpl;
      },
      { service: "whatsapp.templates.get", id },
    );
  }

  create(input: Omit<CreateTemplateInput, "organizationId">): Promise<WhatsAppTemplate> {
    return guard(
      () => {
        this.ensureEnabled();
        const tpl = WhatsAppTemplate.create({ ...input, organizationId: this.ctx.organizationId });
        return this.repo.create(tpl);
      },
      { service: "whatsapp.templates.create" },
    );
  }

  remove(id: string): Promise<void> {
    return guard(
      () => {
        this.ensureEnabled();
        return this.repo.delete(id);
      },
      { service: "whatsapp.templates.remove", id },
    );
  }
}
