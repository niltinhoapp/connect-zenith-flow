import { z } from "zod";

/**
 * Typed access to client-visible environment variables.
 *
 * Only `VITE_`-prefixed vars are exposed to the browser bundle (Vite rule).
 * Server-only secrets (service-role key, WhatsApp / AI / Stripe tokens) are
 * read in `src/server/*` from the server runtime, never here.
 *
 * Nothing is validated at import time so the app still boots in F0 before any
 * `.env` is configured — call the assert helpers when a client is actually
 * needed (starting in Fase F1). See `.env.example`.
 */

const clientEnvSchema = z.object({
  VITE_SUPABASE_URL: z.string().url().optional(),
  VITE_SUPABASE_ANON_KEY: z.string().min(1).optional(),
});

export type ClientEnv = z.infer<typeof clientEnvSchema>;

export const clientEnv: ClientEnv = clientEnvSchema.parse({
  VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
  VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
});

/** Public Supabase config, or `isConfigured: false` when env is missing. */
export function getSupabaseEnv() {
  const url = clientEnv.VITE_SUPABASE_URL;
  const anonKey = clientEnv.VITE_SUPABASE_ANON_KEY;
  return { url, anonKey, isConfigured: Boolean(url && anonKey) };
}

/** Throws with a clear message if the public Supabase env is not set. */
export function assertSupabaseEnv() {
  const env = getSupabaseEnv();
  if (!env.isConfigured) {
    throw new Error(
      "Supabase env ausente. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY " +
        "(veja .env.example). Ativação prevista na Fase F1.",
    );
  }
  return { url: env.url!, anonKey: env.anonKey! };
}
