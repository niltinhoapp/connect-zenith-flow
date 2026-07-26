import { ValueObject, invariant } from "@/core/domain";

/** Valor monetário (armazenado em centavos, não-negativo). */
export class Money extends ValueObject<{ amount: number; currency: string }> {
  private constructor(value: { amount: number; currency: string }) {
    super(value);
  }

  static create(amount: number, currency = "BRL"): Money {
    invariant(Number.isFinite(amount) && amount >= 0, "Valor monetário inválido");
    return new Money({ amount: Math.round(amount), currency });
  }

  get amount(): number {
    return this.value.amount;
  }
  get currency(): string {
    return this.value.currency;
  }
}
