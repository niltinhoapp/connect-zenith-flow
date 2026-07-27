import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { Paginated } from "@/core/domain";
import { InfrastructureError } from "@/core/errors";
import { Conversation } from "../domain/entities/conversation";
import type {
  ConversationFilter,
  ConversationRepository,
} from "../domain/repositories/conversation-repository";

type Row = Database["public"]["Tables"]["conversations"]["Row"];

export function rowToConversation(row: Row): Conversation {
  return Conversation.fromPersistence({
    id: row.id,
    organizationId: row.organization_id,
    accountId: row.account_id,
    phoneNumberId: row.phone_number_id,
    contactWaId: row.contact_wa_id,
    contactName: row.contact_name,
    customerId: row.customer_id,
    status: row.status,
    assignedTo: row.assigned_to,
    unreadCount: row.unread_count,
    lastMessageAt: row.last_message_at,
    lastMessagePreview: row.last_message_preview,
    lastInboundAt: row.last_inbound_at,
    windowExpiresAt: row.window_expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  });
}

/** Repositório Supabase de Conversation (persist-only), com filtros no banco. */
export class ConversationSupabaseRepository implements ConversationRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async findById(id: string): Promise<Conversation | null> {
    const { data, error } = await this.db
      .from("conversations")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw new InfrastructureError(error.message, { cause: error });
    return data ? rowToConversation(data) : null;
  }

  async list(): Promise<Conversation[]> {
    return (await this.findMany()).items;
  }

  async findMany(filter: ConversationFilter = {}): Promise<Paginated<Conversation>> {
    const limit = filter.limit ?? 50;
    const offset = filter.offset ?? 0;
    let q = this.db.from("conversations").select("*", { count: "exact" }).is("deleted_at", null);
    if (filter.status) q = q.eq("status", filter.status);
    if (filter.assignedTo) q = q.eq("assigned_to", filter.assignedTo);
    if (filter.customerId) q = q.eq("customer_id", filter.customerId);
    if (filter.search) q = q.ilike("contact_name", `%${filter.search}%`);
    const { data, error, count } = await q
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .range(offset, offset + limit - 1);
    if (error) throw new InfrastructureError(error.message, { cause: error });
    return { items: (data ?? []).map(rowToConversation), total: count ?? 0 };
  }

  async create(_conv: Conversation): Promise<Conversation> {
    // Conversas nascem da ingestão de webhook (RPC wa_ingest_inbound), não do cliente.
    throw new InfrastructureError("Conversas são criadas pela ingestão de webhook (wa_ingest_inbound).");
  }

  async update(conv: Conversation): Promise<Conversation> {
    const p = conv.toJSON();
    const { data, error } = await this.db
      .from("conversations")
      .update({
        contact_name: p.contactName,
        customer_id: p.customerId,
        status: p.status,
        assigned_to: p.assignedTo,
        unread_count: p.unreadCount,
      })
      .eq("id", p.id)
      .select("*")
      .single();
    if (error) throw new InfrastructureError(error.message, { cause: error });
    return rowToConversation(data);
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.db
      .from("conversations")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw new InfrastructureError(error.message, { cause: error });
  }
}
