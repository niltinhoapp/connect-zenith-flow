import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";
import type { Paginated } from "@/core/domain";
import { InfrastructureError } from "@/core/errors";
import { Lead, type LeadProps } from "../domain/entities/lead";
import type { LeadFilter, LeadRepository } from "../domain/repositories/lead-repository";

type Row = Database["public"]["Tables"]["leads"]["Row"];

export function rowToLead(row: Row): Lead {
  return Lead.fromPersistence({
    id: row.id,
    organizationId: row.organization_id,
    code: row.code,
    name: row.name,
    companyName: row.company_name,
    email: row.email,
    phone: row.phone,
    source: row.source,
    status: row.status as LeadProps["status"],
    ownerId: row.owner_id,
    notes: row.notes,
    tags: row.tags,
    customFields: (row.custom_fields ?? {}) as Record<string, unknown>,
    convertedCustomerId: row.converted_customer_id,
    convertedAt: row.converted_at,
    qualifiedAt: row.qualified_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  });
}

function sanitize(term: string): string {
  return term.replace(/[%,()]/g, "").trim();
}

/** Repositório Supabase de Lead (persist-only). Conversão via RPC. */
export class LeadSupabaseRepository implements LeadRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async findById(id: string): Promise<Lead | null> {
    const { data, error } = await this.db
      .from("leads")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw new InfrastructureError(error.message, { cause: error });
    return data ? rowToLead(data) : null;
  }

  async list(): Promise<Lead[]> {
    return (await this.findMany()).items;
  }

  async findMany(filter: LeadFilter = {}): Promise<Paginated<Lead>> {
    const limit = filter.limit ?? 50;
    const offset = filter.offset ?? 0;
    let q = this.db.from("leads").select("*", { count: "exact" }).is("deleted_at", null);
    if (filter.status) q = q.eq("status", filter.status);
    if (filter.ownerId) q = q.eq("owner_id", filter.ownerId);
    if (filter.search) {
      const s = sanitize(filter.search);
      if (s) q = q.or(`name.ilike.%${s}%,company_name.ilike.%${s}%,email.ilike.%${s}%`);
    }
    const { data, error, count } = await q
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw new InfrastructureError(error.message, { cause: error });
    return { items: (data ?? []).map(rowToLead), total: count ?? 0 };
  }

  async create(lead: Lead): Promise<Lead> {
    const p = lead.toJSON();
    const { data, error } = await this.db
      .from("leads")
      .insert({
        organization_id: p.organizationId,
        name: p.name,
        company_name: p.companyName,
        email: p.email,
        phone: p.phone,
        source: p.source,
        status: p.status,
        owner_id: p.ownerId,
        notes: p.notes,
        tags: p.tags,
        custom_fields: p.customFields as Json,
      })
      .select("*")
      .single();
    if (error) throw new InfrastructureError(error.message, { cause: error });
    return rowToLead(data);
  }

  async update(lead: Lead): Promise<Lead> {
    const p = lead.toJSON();
    const { data, error } = await this.db
      .from("leads")
      .update({
        name: p.name,
        company_name: p.companyName,
        email: p.email,
        phone: p.phone,
        source: p.source,
        status: p.status,
        owner_id: p.ownerId,
        notes: p.notes,
        tags: p.tags,
        custom_fields: p.customFields as Json,
        qualified_at: p.qualifiedAt,
      })
      .eq("id", p.id)
      .select("*")
      .single();
    if (error) throw new InfrastructureError(error.message, { cause: error });
    return rowToLead(data);
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.db
      .from("leads")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw new InfrastructureError(error.message, { cause: error });
  }

  async convert(leadId: string): Promise<string> {
    const { data, error } = await this.db.rpc("convert_lead_to_customer", { p_lead_id: leadId });
    if (error) throw new InfrastructureError(error.message, { cause: error });
    return data.id;
  }
}
