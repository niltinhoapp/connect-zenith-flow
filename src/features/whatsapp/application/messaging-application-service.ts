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
    return guard(
      async () => {
        this.ensureEnabled();
        const { data, error } = await this.db.rpc("wa_send_message", {
          p_org: this.ctx.organizationId,
          p_conversation: conversationId,
          p_type: "text",
          p_body: body,
        });
        if (error) throw new InfrastructureError(error.message, { cause: error });
        return this.fetchMessage(data as string);
      },
      { service: "whatsapp.sendText", conversationId },
    );
  }

  sendTemplate(
    conversationId: string,
    templateId: string,
    variables: unknown[] = [],
  ): Promise<Message> {
    return guard(
      async () => {
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
      },
      { service: "whatsapp.sendTemplate", conversationId },
    );
  }

  assign(conversationId: string, assigneeId: string | null): Promise<void> {
    return guard(
      async () => {
        this.ensureEnabled();
        const { error } = await this.db.rpc("assign_conversation", {
          p_org: this.ctx.organizationId,
          p_conversation: conversationId,
          p_assignee: assigneeId,
        });
        if (error) throw new InfrastructureError(error.message, { cause: error });
      },
      { service: "whatsapp.assign", conversationId },
    );
  }

  markRead(conversationId: string): Promise<void> {
    return guard(
      async () => {
        this.ensureEnabled();
        const { error } = await this.db.rpc("mark_conversation_read", {
          p_org: this.ctx.organizationId,
          p_conversation: conversationId,
        });
        if (error) throw new InfrastructureError(error.message, { cause: error });
      },
      { service: "whatsapp.markRead", conversationId },
    );
  }

  /** Status de atendimento: open|pending|closed (UI: Aberta|Pendente|Resolvida). */
  setStatus(conversationId: string, status: "open" | "pending" | "closed"): Promise<void> {
    return guard(
      async () => {
        this.ensureEnabled();
        const { error } = await this.db.rpc("wa_set_conversation_status", {
          p_org: this.ctx.organizationId,
          p_conversation: conversationId,
          p_status: status,
        });
        if (error) throw new InfrastructureError(error.message, { cause: error });
      },
      { service: "whatsapp.setStatus", conversationId },
    );
  }

  setTags(conversationId: string, tags: string[]): Promise<void> {
    return guard(
      async () => {
        this.ensureEnabled();
        const { error } = await this.db.rpc("wa_set_conversation_tags", {
          p_org: this.ctx.organizationId,
          p_conversation: conversationId,
          p_tags: tags,
        });
        if (error) throw new InfrastructureError(error.message, { cause: error });
      },
      { service: "whatsapp.setTags", conversationId },
    );
  }

  addNote(conversationId: string, body: string): Promise<void> {
    return guard(
      async () => {
        this.ensureEnabled();
        const { error } = await this.db.from("conversation_notes").insert({
          organization_id: this.ctx.organizationId,
          conversation_id: conversationId,
          author_id: this.ctx.actorId,
          body,
        });
        if (error) throw new InfrastructureError(error.message, { cause: error });
      },
      { service: "whatsapp.addNote", conversationId },
    );
  }

  listNotes(conversationId: string): Promise<ConversationNote[]> {
    return guard(
      async () => {
        this.ensureEnabled();
        const { data, error } = await this.db
          .from("conversation_notes")
          .select("id, body, author_id, created_at")
          .eq("conversation_id", conversationId)
          .order("created_at", { ascending: false });
        if (error) throw new InfrastructureError(error.message, { cause: error });
        return (data ?? []) as ConversationNote[];
      },
      { service: "whatsapp.listNotes", conversationId },
    );
  }

  listQuickReplies(): Promise<QuickReply[]> {
    return guard(
      async () => {
        this.ensureEnabled();
        const { data, error } = await this.db
          .from("quick_replies")
          .select("id, shortcut, title, body")
          .is("deleted_at", null)
          .order("shortcut");
        if (error) throw new InfrastructureError(error.message, { cause: error });
        return (data ?? []) as QuickReply[];
      },
      { service: "whatsapp.listQuickReplies" },
    );
  }

  createQuickReply(input: { shortcut: string; title: string; body: string }): Promise<void> {
    return guard(
      async () => {
        this.ensureEnabled();
        const { error } = await this.db.from("quick_replies").insert({
          organization_id: this.ctx.organizationId,
          created_by: this.ctx.actorId,
          ...input,
        });
        if (error) throw new InfrastructureError(error.message, { cause: error });
      },
      { service: "whatsapp.createQuickReply" },
    );
  }

  deleteQuickReply(id: string): Promise<void> {
    return guard(
      async () => {
        this.ensureEnabled();
        const { error } = await this.db
          .from("quick_replies")
          .update({ deleted_at: new Date().toISOString() })
          .eq("id", id);
        if (error) throw new InfrastructureError(error.message, { cause: error });
      },
      { service: "whatsapp.deleteQuickReply", id },
    );
  }

  /**
   * Envio de mídia: valida, sobe o arquivo para o Storage privado (RLS por org)
   * e chama a RPC wa_send_media (cria mensagem+mídia + enfileira whatsapp.send).
   * O worker baixa do Storage, faz upload p/ a Meta e envia — o token nunca sai
   * do backend. Retorna a mensagem (pending).
   */
  sendMedia(conversationId: string, file: File, caption?: string): Promise<Message> {
    return guard(
      async () => {
        this.ensureEnabled();
        const type = mimeToMediaType(file.type);
        if (!type) throw new InfrastructureError("Formato de mídia não suportado.");
        const org = this.ctx.organizationId;
        const path = `${org}/${conversationId}/${crypto.randomUUID()}-${sanitizeName(file.name)}`;
        const up = await this.db.storage
          .from("whatsapp-media")
          .upload(path, file, { contentType: file.type, upsert: false });
        if (up.error) throw new InfrastructureError(up.error.message, { cause: up.error });
        const { data, error } = await this.db.rpc("wa_send_media", {
          p_org: org,
          p_conversation: conversationId,
          p_type: type,
          p_storage_path: path,
          p_mime: file.type,
          p_size: file.size,
          p_filename: file.name,
          p_caption: caption ?? null,
        });
        if (error) throw new InfrastructureError(error.message, { cause: error });
        return this.fetchMessage(data as string);
      },
      { service: "whatsapp.sendMedia", conversationId },
    );
  }

  /**
   * Resolve as mídias de um conjunto de ids (para render na thread): tipo, nome,
   * tamanho, MIME e **signed URL temporária** apenas para as já armazenadas. Nunca
   * expõe token nem URL permanente. Estado: ready | loading | error.
   */
  getMedia(mediaIds: string[]): Promise<Record<string, MediaView>> {
    return guard(
      async () => {
        this.ensureEnabled();
        const ids = [...new Set(mediaIds)].filter(Boolean);
        if (ids.length === 0) return {};
        const { data, error } = await this.db
          .from("whatsapp_media")
          .select("id, mime_type, filename, size_bytes, storage_path, status")
          .in("id", ids);
        if (error) throw new InfrastructureError(error.message, { cause: error });
        const out: Record<string, MediaView> = {};
        for (const row of data ?? []) {
          const kind = mimeToMediaType(row.mime_type ?? "") ?? "document";
          let url = "";
          let state: MediaView["state"] = "loading";
          if (row.status === "stored" && row.storage_path) {
            const signed = await this.db.storage
              .from("whatsapp-media")
              .createSignedUrl(row.storage_path, 3600);
            if (signed.data?.signedUrl) {
              url = signed.data.signedUrl;
              state = "ready";
            } else {
              state = "error";
            }
          } else if (row.status === "failed") {
            state = "error";
          }
          out[row.id] = {
            kind,
            url,
            name: row.filename ?? "arquivo",
            size: row.size_bytes ?? undefined,
            mime: row.mime_type ?? undefined,
            state,
          };
        }
        return out;
      },
      { service: "whatsapp.getMedia" },
    );
  }

  /** URL assinada (temporária) para exibir/baixar uma mídia armazenada. */
  mediaSignedUrl(storagePath: string, expiresSeconds = 3600): Promise<string> {
    return guard(
      async () => {
        this.ensureEnabled();
        const { data, error } = await this.db.storage
          .from("whatsapp-media")
          .createSignedUrl(storagePath, expiresSeconds);
        if (error || !data?.signedUrl) {
          throw new InfrastructureError(error?.message ?? "URL de mídia indisponível");
        }
        return data.signedUrl;
      },
      { service: "whatsapp.mediaSignedUrl" },
    );
  }
}

/** Mapeia MIME → tipo de mídia da Cloud API. */
export function mimeToMediaType(mime: string): "image" | "audio" | "document" | null {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("audio/")) return "audio";
  if (mime === "application/pdf") return "document";
  return null;
}
function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 80);
}

export interface ConversationNote {
  id: string;
  body: string;
  author_id: string | null;
  created_at: string;
}
export interface QuickReply {
  id: string;
  shortcut: string;
  title: string;
  body: string;
}
/** Mídia resolvida para render (estrutura compatível com MessageMedia da UI). */
export interface MediaView {
  kind: "image" | "audio" | "document";
  url: string;
  name: string;
  size?: number;
  mime?: string;
  state: "ready" | "loading" | "error";
}
