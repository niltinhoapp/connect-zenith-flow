import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";
import { InfrastructureError } from "@/core/errors";
import { Customer, type CustomerProps } from "../domain/entities/customer";
import type {
  CustomerFilter,
  CustomerRepository,
  Paginated,
} from "../domain/repositories/customer-repository";

type Row = Database["public"]["Tables"]["customers"]["Row"];

/** Mapper puro row → entidade (testável sem Supabase). */
export function rowToCustomer(row: Row): Customer {
  return Customer.fromPersistence({
    id: row.id,
    organizationId: row.organization_id,
    code: row.code,
    type: row.type,
    firstName: row.first_name,
    lastName: row.last_name,
    companyName: row.company_name,
    document: row.document,
    email: row.email,
    phone: row.phone,
    mobile: row.mobile,
    website: row.website,
    status: row.status as CustomerProps["status"],
    ownerId: row.owner_id,
    source: row.source,
    notes: row.notes,
    tags: row.tags,
    customFields: (row.custom_fields ?? {}) as Record<string, unknown>,
    lastContactAt: row.last_contact_at,
    nextFollowupAt: row.next_followup_at,
    score: row.score,
    lifetimeValue: row.lifetime_value,
    originChannel: row.origin_channel,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  });
}

function sanitize(term: string): string {
  return term.replace(/[%,()]/g, "").trim();
}

/**
 * Repositório Supabase de Customer. APENAS persiste (sem eventos/regras/
 * providers). Paginação + filtros no banco e soft delete. `organization_id`
 * é garantido pela RLS.
 */
export class CustomerSupabaseRepository implements CustomerRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async findById(id: string): Promise<Customer | null> {
    const { data, error } = await this.db
      .from("customers")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw new InfrastructureError(error.message, { cause: error });
    return data ? rowToCustomer(data) : null;
  }

  async list(): Promise<Customer[]> {
    return (await this.findMany()).items;
  }

  async findMany(filter: CustomerFilter = {}): Promise<Paginated<Customer>> {
    const limit = filter.limit ?? 50;
    const offset = filter.offset ?? 0;

    let q = this.db
      .from("customers")
      .select("*", { count: "exact" })
      .is("deleted_at", null);

    if (filter.status) q = q.eq("status", filter.status);
    if (filter.ownerId) q = q.eq("owner_id", filter.ownerId);
    if (filter.search) {
      const s = sanitize(filter.search);
      if (s) {
        q = q.or(
          `first_name.ilike.%${s}%,last_name.ilike.%${s}%,company_name.ilike.%${s}%,email.ilike.%${s}%`,
        );
      }
    }

    const { data, error, count } = await q
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw new InfrastructureError(error.message, { cause: error });
    return { items: (data ?? []).map(rowToCustomer), total: count ?? 0 };
  }

  async create(customer: Customer): Promise<Customer> {
    const p = customer.toJSON();
    const { data, error } = await this.db
      .from("customers")
      .insert({
        organization_id: p.organizationId,
        type: p.type,
        first_name: p.firstName,
        last_name: p.lastName,
        company_name: p.companyName,
        document: p.document,
        email: p.email,
        phone: p.phone,
        mobile: p.mobile,
        website: p.website,
        status: p.status,
        owner_id: p.ownerId,
        source: p.source,
        notes: p.notes,
        tags: p.tags,
        custom_fields: p.customFields as Json,
        origin_channel: p.originChannel,
      })
      .select("*")
      .single();
    if (error) throw new InfrastructureError(error.message, { cause: error });
    return rowToCustomer(data);
  }

  async update(customer: Customer): Promise<Customer> {
    const p = customer.toJSON();
    const { data, error } = await this.db
      .from("customers")
      .update({
        type: p.type,
        first_name: p.firstName,
        last_name: p.lastName,
        company_name: p.companyName,
        document: p.document,
        email: p.email,
        phone: p.phone,
        mobile: p.mobile,
        website: p.website,
        status: p.status,
        owner_id: p.ownerId,
        notes: p.notes,
        tags: p.tags,
        custom_fields: p.customFields as Json,
      })
      .eq("id", p.id)
      .select("*")
      .single();
    if (error) throw new InfrastructureError(error.message, { cause: error });
    return rowToCustomer(data);
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.db
      .from("customers")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw new InfrastructureError(error.message, { cause: error });
  }
}
