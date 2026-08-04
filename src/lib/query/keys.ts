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
  whatsapp: {
    all: (org: string) => ["whatsapp", org] as const,
    conversations: (org: string, filter?: unknown) =>
      ["whatsapp", org, "conversations", filter ?? null] as const,
    conversation: (org: string, id: string) => ["whatsapp", org, "conversation", id] as const,
    messages: (org: string, conversationId: string) =>
      ["whatsapp", org, "messages", conversationId] as const,
    counters: (org: string) => ["whatsapp", org, "counters"] as const,
    templates: (org: string, filter?: unknown) =>
      ["whatsapp", org, "templates", filter ?? null] as const,
  },
  automacoes: {
    all: (org: string) => ["automacoes", org] as const,
    list: (org: string) => ["automacoes", org, "list"] as const,
    detail: (org: string, id: string) => ["automacoes", org, "detail", id] as const,
    runs: (org: string, id: string) => ["automacoes", org, "runs", id] as const,
    runSteps: (org: string, runId: string) => ["automacoes", org, "runSteps", runId] as const,
  },
} as const;
