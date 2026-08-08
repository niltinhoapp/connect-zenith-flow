/**
 * WhatsApp · Domain — barrel público do domínio do módulo.
 */
export { Conversation, type ConversationProps, type ConversationStatus, type CreateConversationInput } from "./entities/conversation";
export {
  Message,
  type MessageProps,
  type MessageDirection,
  type MessageType,
  type MessageStatus,
  type CreateOutboundInput,
} from "./entities/message";
export {
  WhatsAppTemplate,
  type TemplateProps,
  type TemplateCategory,
  type TemplateStatus,
  type CreateTemplateInput,
} from "./entities/whatsapp-template";
export { WaContact } from "./value-objects/wa-contact";
export type { ConversationRepository, ConversationFilter } from "./repositories/conversation-repository";
export type { MessageRepository, MessageFilter } from "./repositories/message-repository";
export type { TemplateRepository, TemplateFilter } from "./repositories/template-repository";
export * from "./conversation-insight";
