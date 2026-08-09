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

export const subscriptionBillingCustomerSchema = billingCustomerSchema.extend({
  postalCode: z
    .string()
    .transform((value) => value.replace(/\D/g, ""))
    .refine((value) => value.length === 8, "Informe um CEP válido."),
  address: z.string().trim().min(2, "Informe o endereço."),
  addressNumber: z.string().trim().min(1, "Informe o número."),
  province: z.string().trim().min(2, "Informe o bairro."),
});

export type BillingCustomerForm = z.input<typeof billingCustomerSchema>;
export type SubscriptionBillingCustomerForm = z.input<typeof subscriptionBillingCustomerSchema>;
