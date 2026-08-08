import { z } from "zod";

export const updateProfileSchema = z.object({
  fullName: z.string().trim().min(2, "Informe seu nome completo").max(120),
});

export const updateWorkspaceSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome da empresa").max(120),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>;

