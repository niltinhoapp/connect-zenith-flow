import type { FieldErrors } from "react-hook-form";
import { toast } from "sonner";

/**
 * Handler `onInvalid` compartilhado pelos formulários: mostra a primeira
 * mensagem de validação via toast (mantém o feedback sem alterar o markup das
 * telas — decisão da F1). Erros inline por campo ficam para uma fase futura.
 */
export function toastFirstError(errors: FieldErrors) {
  const first = Object.values(errors).find(Boolean) as { message?: unknown } | undefined;
  toast.error(typeof first?.message === "string" ? first.message : "Verifique os campos.");
}
