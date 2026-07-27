/**
 * Query Keys centralizadas (TanStack Query).
 *
 * Fonte única das chaves de cache — evita strings soltas e padroniza
 * invalidation. Toda key começa pela organização (multi-tenant): trocar de
 * empresa invalida naturalmente os caches.
 */
export const queryKeys = {
  customers: {
    all: (org: string) => ["customers", org] as const,
    list: (org: string, filter?: unknown) => ["customers", org, "list", filter ?? null] as const,
    detail: (org: string, id: string) => ["customers", org, "detail", id] as const,
  },
  leads: {
    all: (org: string) => ["leads", org] as const,
    list: (org: string, filter?: unknown) => ["leads", org, "list", filter ?? null] as const,
    detail: (org: string, id: string) => ["leads", org, "detail", id] as const,
  },
  deals: {
    all: (org: string) => ["deals", org] as const,
    list: (org: string, filter?: unknown) => ["deals", org, "list", filter ?? null] as const,
    detail: (org: string, id: string) => ["deals", org, "detail", id] as const,
  },
  pipelines: {
    all: (org: string) => ["pipelines", org] as const,
    list: (org: string) => ["pipelines", org, "list"] as const,
  },
} as const;
