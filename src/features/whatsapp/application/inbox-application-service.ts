import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { guard } from "@/core/application/guard";
import { assertModuleEnabled } from "@/core/feature-flags";
import { InfrastructureError, NotFoundError } from "@/core/errors";
import type { ServiceContext } from "@/core/application/context";
import type { Paginated } from "@/core/domain";
import type { Conversation } from "../domain/entities/conversation";
import type { Message } from "../domain/entities/message";
import type {
  ConversationFilter,
  ConversationRepository,
} from "../domain/repositories/conversation-repository";
import type { MessageRepository } from "../domain/repositories/message-repository";

export interface InboxCounters {
  open: number;
  unread: number;
  mine: number;
}

/**
 * InboxApplicationService — leitura da caixa de entrada: lista de conversas,
 * thread de mensagens e contadores. Escrita/atribuição ficam no
 * MessagingApplicationService.
 */
export class InboxApplicationService {
  constructor(
    private readonly db: SupabaseClient<Database>,
    private readonly conversations: ConversationRepository,
    private readonly messages: MessageRepository,
    private readonly ctx: ServiceContext,
  ) {}

  private ensureEnabled() {
    assertModuleEnabled(this.ctx.enabledModules, "whatsapp");
  }

  listConversations(filter?: ConversationFilter): Promise<Paginated<Conversation>> {
    return guard(
      () => {
        this.ensureEnabled();
        return this.conversations.findMany(filter);
      },
      { service: "whatsapp.listConversations" },
    );
  }

  getConversation(id: string): Promise<Conversation> {
    return guard(
      async () => {
        this.ensureEnabled();
        const conv = await this.conversations.findById(id);
        if (!conv) throw new NotFoundError("Conversa não encontrada");
        return conv;
      },
      { service: "whatsapp.getConversation", id },
    );
  }

  listMessages(
    conversationId: string,
    limit?: number,
    offset?: number,
  ): Promise<Paginated<Message>> {
    return guard(
      () => {
        this.ensureEnabled();
        return this.messages.findByConversation({ conversationId, limit, offset });
      },
      { service: "whatsapp.listMessages", conversationId },
    );
  }

  counters(): Promise<InboxCounters> {
    return guard(
      async () => {
        this.ensureEnabled();
        const { data, error } = await this.db.rpc("inbox_counters", {
          p_org: this.ctx.organizationId,
        });
        if (error) throw new InfrastructureError(error.message, { cause: error });
        const c = (data ?? {}) as Partial<InboxCounters>;
        return { open: c.open ?? 0, unread: c.unread ?? 0, mine: c.mine ?? 0 };
      },
      { service: "whatsapp.counters" },
    );
  }
}
