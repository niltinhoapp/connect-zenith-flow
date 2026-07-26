/**
 * Core · Errors — hierarquia única de erros da aplicação.
 *
 * As camadas usam estes tipos em vez de Error genérico. A UI mapeia `kind` para
 * feedback (toast/HTTP). Repositories lançam InfrastructureError; o domínio
 * lança DomainError (→ ValidationError na fronteira da aplicação).
 */
export type AppErrorKind =
  | "validation"
  | "not_found"
  | "permission"
  | "conflict"
  | "infrastructure"
  | "unknown";

export interface AppErrorOptions {
  cause?: unknown;
  context?: Record<string, unknown>;
}

export class AppError extends Error {
  readonly kind: AppErrorKind;
  readonly context?: Record<string, unknown>;

  constructor(message: string, kind: AppErrorKind = "unknown", options: AppErrorOptions = {}) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = new.target.name;
    this.kind = kind;
    this.context = options.context;
  }
}

export class ValidationError extends AppError {
  constructor(message: string, options?: AppErrorOptions) {
    super(message, "validation", options);
  }
}
export class NotFoundError extends AppError {
  constructor(message = "Recurso não encontrado", options?: AppErrorOptions) {
    super(message, "not_found", options);
  }
}
export class PermissionError extends AppError {
  constructor(message = "Você não tem permissão para esta ação", options?: AppErrorOptions) {
    super(message, "permission", options);
  }
}
export class ConflictError extends AppError {
  constructor(message = "Conflito de dados", options?: AppErrorOptions) {
    super(message, "conflict", options);
  }
}
export class InfrastructureError extends AppError {
  constructor(message = "Falha de infraestrutura", options?: AppErrorOptions) {
    super(message, "infrastructure", options);
  }
}

/** Mensagem amigável para o usuário a partir de qualquer erro. */
export function toUserMessage(error: unknown): string {
  if (error instanceof AppError) return error.message;
  if (error instanceof Error) return error.message;
  return "Ocorreu um erro inesperado.";
}
