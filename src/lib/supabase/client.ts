import { createBrowserClient } from "@supabase/ssr";
import { assertSupabaseEnv } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * Cliente Supabase do browser (auth + dados sob RLS).
 *
 * Singleton: uma única instância por aba. Só deve ser usado no cliente
 * (event handlers, hooks) — nunca no SSR (usa document.cookie). Para o servidor,
 * ver `src/server/supabase.ts`.
 */
let browserClient: ReturnType<typeof createBrowserClient<Database>> | undefined;

export function getSupabaseBrowserClient() {
  if (browserClient) return browserClient;
  const { url, anonKey } = assertSupabaseEnv();
  browserClient = createBrowserClient<Database>(url, anonKey);
  return browserClient;
}
