import type { Repository, Paginated } from "@/core/domain";
import type { Conversation, ConversationStatus } from "../entities/conversation";

export interface ConversationFilter {
  status?: ConversationStatus;
  assignedTo?: string;
  customerId?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

/** Persistência de Conversation (persist-only). */
export interface ConversationRepository extends Repository<Conversation> {
  findMany(filter?: ConversationFilter): Promise<Paginated<Conversation>>;
}
