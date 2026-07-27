import type { QueryClient } from "@tanstack/react-query";

/**
 * Cache factory / helpers de invalidation e optimistic updates.
 *
 * Padroniza as operações de cache usadas pelos hooks de mutation:
 *  - invalidação por prefixo de key,
 *  - patch otimista de listas e detalhes com rollback.
 */

/** Invalida todas as queries sob um prefixo de key. */
export function invalidateByPrefix(client: QueryClient, prefix: readonly unknown[]) {
  return client.invalidateQueries({ queryKey: prefix });
}

/**
 * Aplica um patch otimista e devolve um rollback. Uso típico em
 * `onMutate`/`onError` de uma mutation.
 */
export async function optimisticUpdate<T>(
  client: QueryClient,
  key: readonly unknown[],
  updater: (previous: T | undefined) => T,
): Promise<() => void> {
  await client.cancelQueries({ queryKey: key });
  const previous = client.getQueryData<T>(key);
  client.setQueryData<T>(key, updater(previous));
  return () => client.setQueryData<T>(key, previous);
}

/** Defaults padronizados de mutation (retry curto para escrita). */
export const mutationDefaults = {
  retry: 1,
} as const;
