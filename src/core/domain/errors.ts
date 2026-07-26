/**
 * Core · Domain — erros de domínio.
 *
 * Sinalizam violação de regra de negócio (input inválido, invariante quebrada).
 * A camada de aplicação/UI traduz para feedback (toast, HTTP status).
 */
export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DomainError";
  }
}

/** Garante uma invariante; lança DomainError com a mensagem se falhar. */
export function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new DomainError(message);
  }
}
