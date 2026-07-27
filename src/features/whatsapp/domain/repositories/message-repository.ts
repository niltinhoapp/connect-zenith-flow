import type { Paginated } from "@/core/domain";
import type { Message } from "../entities/message";

export interface MessageFilter {
  conversationId: string;
  limit?: number;
  offset?: number;
}

/** Leitura de mensagens de uma conversa (o envio passa por RPC/worker). */
export interface MessageRepository {
  findByConversation(filter: MessageFilter): Promise<Paginated<Message>>;
  findById(id: string): Promise<Message | null>;
}
