import type { Repository, Paginated } from "@/core/domain";
import type { WhatsAppTemplate, TemplateStatus } from "../entities/whatsapp-template";

export interface TemplateFilter {
  status?: TemplateStatus;
  limit?: number;
  offset?: number;
}

/** Persistência de WhatsAppTemplate (persist-only). */
export interface TemplateRepository extends Repository<WhatsAppTemplate> {
  findMany(filter?: TemplateFilter): Promise<Paginated<WhatsAppTemplate>>;
}
