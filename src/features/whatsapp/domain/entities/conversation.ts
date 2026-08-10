import { Entity, invariant } from "@/core/domain";
import { WaContact } from "../value-objects/wa-contact";

export type ConversationStatus = "open" | "pending" | "closed";

export interface ConversationProps {
  id: string;
  organizationId: string;
  accountId: string | null;
  phoneNumberId: string | null;
  contactWaId: string;
  contactName: string | null;
  customerId: string | null;
  status: ConversationStatus;
  assignedTo: string | null;
  unreadCount: number;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  lastInboundAt: string | null;
  lastOutboundAt: string | null;
  windowExpiresAt: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CreateConversationInput {
  organizationId: string;
  accountId?: string | null;
  phoneNumberId?: string | null;
  contactWaId: string;
  contactName?: string | null;
  customerId?: string | null;
}

/**
 * Conversation — thread de conversa com um contato. Encapsula a janela de
 * atendimento de 24h (Cloud API): fora da janela, só é permitido iniciar com
 * template — regra verificada por `canSendFreeform`.
 */
export class Conversation extends Entity<ConversationProps> {
  private constructor(props: ConversationProps) {
    super(props);
  }

  static create(
    input: CreateConversationInput,
    id: string = crypto.randomUUID(),
    now: string = new Date().toISOString(),
  ): Conversation {
    const contact = WaContact.create(input.contactWaId);
    return new Conversation({
      id,
      organizationId: input.organizationId,
      accountId: input.accountId ?? null,
      phoneNumberId: input.phoneNumberId ?? null,
      contactWaId: contact.waId,
      contactName: input.contactName ?? null,
      customerId: input.customerId ?? null,
      status: "open",
      assignedTo: null,
      unreadCount: 0,
      lastMessageAt: null,
      lastMessagePreview: null,
      lastInboundAt: null,
      lastOutboundAt: null,
      windowExpiresAt: null,
      tags: [],
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
  }

  static fromPersistence(props: ConversationProps): Conversation {
    return new Conversation(props);
  }

  /** True se a janela de 24h (desde a última mensagem do contato) está aberta. */
  isWithinWindow(now: Date = new Date()): boolean {
    if (!this.props.windowExpiresAt) return false;
    return new Date(this.props.windowExpiresAt).getTime() > now.getTime();
  }

  /** Fora da janela, mensagem livre (não-template) é proibida pela Cloud API. */
  canSendFreeform(now: Date = new Date()): boolean {
    return this.isWithinWindow(now);
  }

  assignTo(userId: string | null): void {
    this.props.assignedTo = userId;
    this.touch();
  }

  close(): void {
    invariant(this.props.status !== "closed", "Conversa já está encerrada");
    this.props.status = "closed";
    this.touch();
  }

  markRead(): void {
    this.props.unreadCount = 0;
    this.touch();
  }

  private touch(): void {
    this.props.updatedAt = new Date().toISOString();
  }

  get organizationId(): string {
    return this.props.organizationId;
  }
  get status(): ConversationStatus {
    return this.props.status;
  }
  get contactWaId(): string {
    return this.props.contactWaId;
  }
  get assignedTo(): string | null {
    return this.props.assignedTo;
  }
}
