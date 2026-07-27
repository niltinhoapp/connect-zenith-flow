import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { Paginated } from "@/core/domain";
import { InfrastructureError } from "@/core/errors";
import { Message } from "../domain/entities/message";
import type { MessageFilter, MessageRepository } from "../domain/repositories/message-repository";

type Row = Database["public"]["Tables"]["messages"]["Row"];

export function rowToMessage(row: Row): Message {
  return Message.fromPersistence({
    id: row.id,
    organizationId: row.organization_id,
    conversationId: row.conversation_id,
    direction: row.direction,
    waMessageId: row.wa_message_id,
    type: row.type,
    body: row.body,
    mediaId: row.media_id,
    templateId: row.template_id,
    status: row.status,
    sender: row.sender,
    sentBy: row.sent_by,
    payload: (row.payload ?? {}) as Record<string, unknown>,
    error: (row.error ?? null) as Record<string, unknown> | null,
    payloadVersion: row.payload_version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

/** Leitura de mensagens (o envio passa por RPC wa_send_message / worker). */
export class MessageSupabaseRepository implements MessageRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async findById(id: string): Promise<Message | null> {
    const { data, error } = await this.db.from("messages").select("*").eq("id", id).maybeSingle();
    if (error) throw new InfrastructureError(error.message, { cause: error });
    return data ? rowToMessage(data) : null;
  }

  async findByConversation(filter: MessageFilter): Promise<Paginated<Message>> {
    const limit = filter.limit ?? 50;
    const offset = filter.offset ?? 0;
    const { data, error, count } = await this.db
      .from("messages")
      .select("*", { count: "exact" })
      .eq("conversation_id", filter.conversationId)
      .order("created_at", { ascending: true })
      .range(offset, offset + limit - 1);
    if (error) throw new InfrastructureError(error.message, { cause: error });
    return { items: (data ?? []).map(rowToMessage), total: count ?? 0 };
  }
}
