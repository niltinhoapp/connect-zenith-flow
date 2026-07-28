/**
 * Feature: WhatsApp (F3.1)
 * Module key: "whatsapp"
 *
 * Superfície pública do módulo. Consome só o Core; comunica-se com outros
 * módulos apenas por Event Bus (whatsapp.*). Envio: Application Service →
 * RPC wa_send_message → job whatsapp.send → Worker → WhatsAppProvider.
 */
export const MODULE_KEY = "whatsapp" as const;

// Domain
export * from "./domain";

// Application
export { MessagingApplicationService } from "./application/messaging-application-service";
export { InboxApplicationService, type InboxCounters } from "./application/inbox-application-service";
export { TemplateApplicationService } from "./application/template-application-service";

// Infrastructure
export { ConversationSupabaseRepository, rowToConversation } from "./infrastructure/conversation-supabase-repository";
export { MessageSupabaseRepository, rowToMessage } from "./infrastructure/message-supabase-repository";
export { TemplateSupabaseRepository, rowToTemplate } from "./infrastructure/template-supabase-repository";
export { MetaWhatsAppProvider } from "./infrastructure/meta-whatsapp-provider";
export { EvolutionWhatsAppProvider } from "./infrastructure/evolution-whatsapp-provider";
export {
  createWhatsAppSendHandler,
  PermanentSendError,
  type WhatsAppGateway,
  type WhatsAppSendContext,
} from "./infrastructure/whatsapp-job-handlers";

// Composition root
export { registerWhatsAppProvider } from "./bootstrap";
