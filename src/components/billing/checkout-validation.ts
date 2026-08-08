import { z } from "zod";

export const billingCustomerSchema = z.object({
  legalName: z.string().trim().min(2, "Informe o nome ou razão social."),
  email: z.string().trim().email("Informe um e-mail válido."),
  taxId: z
    .string()
    .transform((value) => value.replace(/\D/g, ""))
    .refine(
      (value) => value.length === 11 || value.length === 14,
      "Informe um CPF ou CNPJ válido.",
    ),
  phone: z
    .string()
    .transform((value) => value.replace(/\D/g, ""))
    .refine(
      (value) => value.length === 0 || (value.length >= 10 && value.length <= 13),
      "Informe um telefone válido.",
    ),
});

export type BillingCustomerForm = z.input<typeof billingCustomerSchema>;
