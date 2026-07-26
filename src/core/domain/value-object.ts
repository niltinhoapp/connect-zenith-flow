/**
 * Core · Domain — Value Object base.
 *
 * Um Value Object é imutável e comparado por valor (não por identidade).
 * Normalização e validação acontecem no construtor da subclasse — um VO só
 * existe se for válido.
 */
export abstract class ValueObject<T> {
  protected readonly value: T;

  protected constructor(value: T) {
    this.value = value;
  }

  equals(other?: ValueObject<T> | null): boolean {
    if (other == null) return false;
    return JSON.stringify(this.value) === JSON.stringify(other.value);
  }

  unwrap(): T {
    return this.value;
  }
}
