import { ValueObject } from "@/core/domain";
import { invariant } from "@/core/domain";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** E-mail válido e normalizado (lowercase, trim). */
export class Email extends ValueObject<string> {
  private constructor(value: string) {
    super(value);
  }

  static create(raw: string): Email {
    const value = raw.trim().toLowerCase();
    invariant(EMAIL_RE.test(value), "E-mail inválido");
    return new Email(value);
  }
}
