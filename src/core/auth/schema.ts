import { z } from "zod";

/**
 * Schemas de validação de autenticação (fonte da verdade dos formulários).
 * Consumidos por React Hook Form via @hookform/resolvers/zod.
 */
export const loginSchema = z.object({
  email: z.string().min(1, "Informe o e-mail").email("E-mail inválido"),
  password: z.string().min(1, "Informe a senha"),
});

export const signupSchema = z.object({
  firstName: z.string().min(1, "Informe o nome"),
  lastName: z.string().min(1, "Informe o sobrenome"),
  companyName: z.string().min(2, "Informe o nome da empresa"),
  email: z.string().min(1, "Informe o e-mail").email("E-mail inválido"),
  password: z.string().min(8, "A senha deve ter no mínimo 8 caracteres"),
});

export const recoverSchema = z.object({
  email: z.string().min(1, "Informe o e-mail").email("E-mail inválido"),
});

export const resetPasswordSchema = z
  .object({
    password: z.string().min(8, "A senha deve ter no mínimo 8 caracteres"),
    confirmPassword: z.string().min(1, "Confirme a nova senha"),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "As senhas não coincidem",
    path: ["confirmPassword"],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type RecoverInput = z.infer<typeof recoverSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
