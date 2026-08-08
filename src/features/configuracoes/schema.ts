import { z } from "zod";

export const updateProfileSchema = z.object({
  fullName: z.string().trim().min(2, "Informe seu nome completo").max(120),
});

export const updateWorkspaceSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome da empresa").max(120),
});

export const connectWhatsAppSchema = z.object({
  accessToken: z.string().trim().min(20, "Informe um token válido"),
  wabaId: z.string().trim().min(5, "Informe o ID da conta do WhatsApp"),
  phoneNumberId: z.string().trim().min(5, "Informe o ID do número"),
});

export const createWebhookSchema = z.object({
  url: z.string().trim().url("Informe uma URL HTTPS válida").refine(
    (value) => value.startsWith("https://"),
    "O webhook deve usar HTTPS",
  ),
  events: z.array(z.string()).min(1, "Selecione pelo menos um evento"),
  secret: z.string().trim().min(16, "Use um segredo com pelo menos 16 caracteres").max(200),
});

export const notificationPreferencesSchema = z.object({
  email: z.boolean(),
  push: z.boolean(),
  compact: z.boolean(),
  analytics: z.boolean(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>;
export type ConnectWhatsAppInput = z.infer<typeof connectWhatsAppSchema>;
export type CreateWebhookInput = z.infer<typeof createWebhookSchema>;
export type NotificationPreferences = z.infer<typeof notificationPreferencesSchema>;
