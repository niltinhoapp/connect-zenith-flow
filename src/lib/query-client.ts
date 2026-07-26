import { QueryClient } from "@tanstack/react-query";

/**
 * Factory for the app's TanStack Query client.
 *
 * Extracted from `router.tsx` so the same configuration can be reused by
 * server-side prefetching and tests. Data fetching is wired up starting in
 * Fase F2; these defaults are inert until then.
 */
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });
}
