import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";
import type { Paginated } from "@/core/domain";
import { InfrastructureError } from "@/core/errors";
import { WhatsAppTemplate } from "../domain/entities/whatsapp-template";
import type {
  TemplateFilter,
  TemplateRepository,
} from "../domain/repositories/template-repository";

type Row = Database["public"]["Tables"]["whatsapp_templates"]["Row"];

export function rowToTemplate(row: Row): WhatsAppTemplate {
  return WhatsAppTemplate.fromPersistence({
    id: row.id,
    organizationId: row.organization_id,
    accountId: row.account_id,
    externalId: row.external_id,
    name: row.name,
    language: row.language,
    category: row.category,
    status: row.status,
    components: (row.components ?? []) as unknown[],
    rejectedReason: row.rejected_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  });
}

/** Repositório Supabase de WhatsAppTemplate (RLS: whatsapp.templates.manage). */
export class TemplateSupabaseRepository implements TemplateRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async findById(id: string): Promise<WhatsAppTemplate | null> {
    const { data, error } = await this.db
      .from("whatsapp_templates")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw new InfrastructureError(error.message, { cause: error });
    return data ? rowToTemplate(data) : null;
  }

  async list(): Promise<WhatsAppTemplate[]> {
    return (await this.findMany()).items;
  }

  async findMany(filter: TemplateFilter = {}): Promise<Paginated<WhatsAppTemplate>> {
    const limit = filter.limit ?? 50;
    const offset = filter.offset ?? 0;
    let q = this.db
      .from("whatsapp_templates")
      .select("*", { count: "exact" })
      .is("deleted_at", null);
    if (filter.status) q = q.eq("status", filter.status);
    const { data, error, count } = await q
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw new InfrastructureError(error.message, { cause: error });
    return { items: (data ?? []).map(rowToTemplate), total: count ?? 0 };
  }

  async create(template: WhatsAppTemplate): Promise<WhatsAppTemplate> {
    const p = template.toJSON();
    const { data, error } = await this.db
      .from("whatsapp_templates")
      .insert({
        organization_id: p.organizationId,
        name: p.name,
        language: p.language,
        category: p.category,
        status: p.status,
        components: p.components as Json,
      })
      .select("*")
      .single();
    if (error) throw new InfrastructureError(error.message, { cause: error });
    return rowToTemplate(data);
  }

  async update(template: WhatsAppTemplate): Promise<WhatsAppTemplate> {
    const p = template.toJSON();
    const { data, error } = await this.db
      .from("whatsapp_templates")
      .update({
        language: p.language,
        category: p.category,
        components: p.components as Json,
      })
      .eq("id", p.id)
      .select("*")
      .single();
    if (error) throw new InfrastructureError(error.message, { cause: error });
    return rowToTemplate(data);
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.db
      .from("whatsapp_templates")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw new InfrastructureError(error.message, { cause: error });
  }
}
