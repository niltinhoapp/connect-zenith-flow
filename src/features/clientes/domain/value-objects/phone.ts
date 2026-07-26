import { ValueObject, invariant } from "@/core/domain";

/** Telefone normalizado para E.164 (padrão Brasil quando sem DDI). */
export class Phone extends ValueObject<string> {
  private constructor(value: string) {
    super(value);
  }

  static create(raw: string): Phone {
    const digits = raw.replace(/\D/g, "");
    invariant(digits.length >= 10 && digits.length <= 13, "Telefone inválido");
    const e164 = digits.startsWith("55") ? `+${digits}` : `+55${digits}`;
    return new Phone(e164);
  }
}
