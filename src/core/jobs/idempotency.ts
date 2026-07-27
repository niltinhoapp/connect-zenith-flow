/**
 * Core · Jobs — idempotência de execução (at-least-once → exactly-once lógico).
 * `acquire(key)` retorna true na primeira vez e false depois (dedup por chave).
 */
export type AcquireKey = (key: string) => Promise<boolean>;

/**
 * Executa `fn` no máximo uma vez por `key`. Retorna false se já foi executada
 * (chave já adquirida) — o handler deve tratar como "já processado".
 */
export async function withIdempotency(acquire: AcquireKey, key: string, fn: () => Promise<void>): Promise<boolean> {
  const acquired = await acquire(key);
  if (!acquired) return false;
  await fn();
  return true;
}
