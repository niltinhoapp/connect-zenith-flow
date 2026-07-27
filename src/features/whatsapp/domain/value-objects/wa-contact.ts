import { ValueObject, invariant } from "@/core/domain";

/**
 * WaContact — identidade WhatsApp de um contato (wa_id). Normaliza para apenas
 * dígitos (padrão da Cloud API: E.164 sem '+'). Ex.: "+55 (11) 98888-7777" →
 * "5511988887777".
 */
export class WaContact extends ValueObject<{ waId: string }> {
  private constructor(value: { waId: string }) {
    super(value);
  }

  static create(raw: string): WaContact {
    const digits = (raw ?? "").replace(/\D+/g, "");
    invariant(digits.length >= 8 && digits.length <= 15, "Número de WhatsApp inválido");
    return new WaContact({ waId: digits });
  }

  get waId(): string {
    return this.value.waId;
  }

  toString(): string {
    return this.value.waId;
  }
}
