import { createServerClient } from "@supabase/ssr";
import { getRequest, setCookie } from "@tanstack/react-start/server";
import { assertSupabaseEnv } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * Cliente Supabase server-side (request-scoped).
 *
 * Executa apenas em server functions / SSR do TanStack Start. Lê a sessão dos
 * cookies da requisição e escreve cookies de refresh na resposta, respeitando
 * a RLS como o usuário autenticado. Usa a anon key (pública) — o segredo de
 * serviço fica no client admin (ver `createSupabaseAdminClient`).
 *
 * Deve ser chamado dentro do contexto de uma requisição (server fn / loader).
 */
function parseCookieHeader(header: string | null): { name: string; value: string }[] {
  if (!header) return [];
  return header
    .split(";")
    .map((pair) => {
      const index = pair.indexOf("=");
      if (index === -1) return null;
      const name = pair.slice(0, index).trim();
      const value = decodeURIComponent(pair.slice(index + 1).trim());
      return name ? { name, value } : null;
    })
    .filter((c): c is { name: string; value: string } => c !== null);
}

export function getSupabaseServerClient() {
  const { url, anonKey } = assertSupabaseEnv();
  const request = getRequest();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return parseCookieHeader(request.headers.get("cookie"));
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          setCookie(name, value, options as Parameters<typeof setCookie>[2]);
        }
      },
    },
  });
}

/**
 * Cliente admin (service role) — IGNORA a RLS. Somente para tarefas confiáveis
 * (webhooks, jobs). Lê o segredo do runtime do servidor (nunca do bundle).
 * Ativado sob demanda nas fases que precisarem (F3/F4).
 */
export function createSupabaseAdminClient() {
  const { url } = assertSupabaseEnv();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY ausente (server). Veja .env.example.");
  }
  return createServerClient<Database>(url, serviceKey, {
    cookies: { getAll: () => [], setAll: () => {} },
  });
}
