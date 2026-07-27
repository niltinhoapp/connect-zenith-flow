import { normalizeError } from "@/core/errors";
import { logError } from "@/core/logging";

/**
 * Envolve a execução de um Application Service: normaliza o erro para AppError
 * e gera log estruturado (toda exceção logada). A UI recebe sempre um AppError.
 */
export async function guard<T>(
  fn: () => Promise<T>,
  context?: Record<string, unknown>,
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    const appError = normalizeError(error);
    logError(appError, context);
    throw appError;
  }
}
