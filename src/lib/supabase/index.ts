/**
 * Supabase — entrypoint do browser.
 *
 * Helpers do cliente (browser) ficam aqui; clientes server-side ficam em
 * `src/server/supabase.ts` para que segredos/serviço nunca cheguem ao bundle.
 */
export { getSupabaseBrowserClient } from "@/lib/supabase/client";
