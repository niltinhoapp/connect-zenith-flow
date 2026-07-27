import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";
import { guard } from "@/core/application/guard";
import { assertModuleEnabled } from "@/core/feature-flags";
import { InfrastructureError, NotFoundError } from "@/core/errors";
import type { ServiceContext } from "@/core/application/context";
import { Message } from "../domain/entities/message";
import type { MessageRepository } from "../domain/repositories/message-repository";

/**
 * MessagingApplicationService — envio e curadoria de mensagens.
 * O envio NÃO chama o Provider diretamente: cria a mensagem (pending) + enfileira
 * o job `whatsapp.send` via RPC `wa_send_message` (cota atômica + idempotência).
 * O worker consome o job e chama o WhatsAppProvider. Assim a UI responde na hora
 * e o efeito externo é retryável/idempotente.
 */
export class MessagingApplicationService {
  constructor(
    private readonly db: SupabaseClient<Database>,
    private readonly messages: MessageRepository,
    private readonly ctx: ServiceContext,
  ) {}

  private ensureEnabled() {
    assertModuleEnabled(this.ctx.enabledModules, "whatsapp");
  }

  private async fetchMessage(id: string): Promise<Message> {
    const msg = await this.messages.findById(id);
    if (!msg) throw new NotFoundError("Mensagem não encontrada");
    return msg;
  }

  sendText(conversationId: string, body: string): Promise<Message> {
    return guard(async () => {
      this.ensureEnabled();
      const { data, error } = await this.db.rpc("wa_send_message", {
        p_org: this.ctx.organizationId,
        p_conversation: conversationId,
        p_type: "text",
        p_body: body,
      });
      if (error) throw new InfrastructureError(error.message, { cause: error });
      return this.fetchMessage(data as string);
    }, { service: "whatsapp.sendText", conversationId });
  }

  sendTemplate(conversationId: string, templateId: string, variables: unknown[] = []): Promise<Message> {
    return guard(async () => {
      this.ensureEnabled();
      const { data, error } = await this.db.rpc("wa_send_message", {
        p_org: this.ctx.organizationId,
        p_conversation: conversationId,
        p_type: "template",
        p_template_id: templateId,
        p_payload: { variables } as unknown as Json,
      });
      if (error) throw new InfrastructureError(error.message, { cause: error });
      return this.fetchMessage(data as string);
    }, { service: "whatsapp.sendTemplate", conversationId });
  }

  assign(conversationId: string, assigneeId: string | null): Promise<void> {
    return guard(async () => {
      this.ensureEnabled();
      const { error } = await this.db.rpc("assign_conversation", {
        p_org: this.ctx.organizationId,
        p_conversation: conversationId,
        p_assignee: assigneeId,
      });
      if (error) throw new InfrastructureError(error.message, { cause: error });
    }, { service: "whatsapp.assign", conversationId });
  }

  markRead(conversationId: string): Promise<void> {
    return guard(async () => {
      this.ensureEnabled();
      const { error } = await this.db.rpc("mark_conversation_read", {
        p_org: this.ctx.organizationId,
        p_conversation: conversationId,
      });
      if (error) throw new InfrastructureError(error.message, { cause: error });
    }, { service: "whatsapp.markRead", conversationId });
  }
}
