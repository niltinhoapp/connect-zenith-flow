import { Entity, invariant } from "@/core/domain";

export type MessageDirection = "inbound" | "outbound";
export type MessageType =
  | "text"
  | "image"
  | "document"
  | "audio"
  | "video"
  | "sticker"
  | "template"
  | "location"
  | "contacts"
  | "interactive"
  | "reaction"
  | "system";
export type MessageStatus = "pending" | "sent" | "delivered" | "read" | "failed" | "received";

export interface MessageProps {
  id: string;
  organizationId: string;
  conversationId: string;
  direction: MessageDirection;
  waMessageId: string | null;
  type: MessageType;
  body: string | null;
  mediaId: string | null;
  templateId: string | null;
  status: MessageStatus;
  sender: string | null;
  sentBy: string | null;
  payload: Record<string, unknown>;
  error: Record<string, unknown> | null;
  payloadVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateOutboundInput {
  organizationId: string;
  conversationId: string;
  type?: MessageType;
  body?: string | null;
  templateId?: string | null;
  sentBy?: string | null;
  payload?: Record<string, unknown>;
}

const RANK: Record<string, number> = { sent: 1, delivered: 2, read: 3 };

/**
 * Message — mensagem de WhatsApp (inbound ou outbound). Invariante: mensagem de
 * texto exige corpo; template exige templateId. Transições de status são
 * monotônicas (sent < delivered < read); `failed` é terminal.
 */
export class Message extends Entity<MessageProps> {
  private constructor(props: MessageProps) {
    super(props);
  }

  static createOutbound(
    input: CreateOutboundInput,
    id: string = crypto.randomUUID(),
    now: string = new Date().toISOString(),
  ): Message {
    const type = input.type ?? "text";
    if (type === "text") invariant(Boolean(input.body?.trim()), "Corpo da mensagem é obrigatório");
    if (type === "template") invariant(Boolean(input.templateId), "Template é obrigatório");
    return new Message({
      id,
      organizationId: input.organizationId,
      conversationId: input.conversationId,
      direction: "outbound",
      waMessageId: null,
      type,
      body: input.body ?? null,
      mediaId: null,
      templateId: input.templateId ?? null,
      status: "pending",
      sender: null,
      sentBy: input.sentBy ?? null,
      payload: input.payload ?? {},
      error: null,
      payloadVersion: 1,
      createdAt: now,
      updatedAt: now,
    });
  }

  static fromPersistence(props: MessageProps): Message {
    return new Message(props);
  }

  /** Marca como enviada, guardando o id externo (wa_message_id). */
  markSent(waMessageId: string): void {
    this.props.waMessageId = waMessageId;
    this.props.status = "sent";
    this.touch();
  }

  markFailed(error: Record<string, unknown>): void {
    this.props.status = "failed";
    this.props.error = error;
    this.touch();
  }

  /** Avança o status apenas se for progressão (sent→delivered→read). */
  advanceStatus(next: MessageStatus): void {
    const cur = RANK[this.props.status] ?? 0;
    const nxt = RANK[next] ?? 0;
    if (nxt > cur) {
      this.props.status = next;
      this.touch();
    }
  }

  private touch(): void {
    this.props.updatedAt = new Date().toISOString();
  }

  get organizationId(): string {
    return this.props.organizationId;
  }
  get conversationId(): string {
    return this.props.conversationId;
  }
  get direction(): MessageDirection {
    return this.props.direction;
  }
  get status(): MessageStatus {
    return this.props.status;
  }
}
