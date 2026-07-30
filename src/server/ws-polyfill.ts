/**
 * Polyfill de WebSocket para o servidor.
 *
 * O @supabase/supabase-js (createServerClient) exige um `WebSocket` global —
 * nativo apenas no Node 22+ (ou no bun). Em Node 20, sem ele, a criação do
 * client lança "native WebSocket not found" e a sessão SSR nunca é resolvida
 * (o login "não entra": o usuário é devolvido para /login).
 *
 * Garantimos o global a partir do pacote `ws` (dependência transitiva do
 * Supabase). Módulo server-only (importado apenas por `src/server/**`), então
 * `ws`/`node:module` nunca vão para o bundle do cliente.
 */
import { createRequire } from "node:module";

type WithWebSocket = { WebSocket?: unknown };

if (typeof (globalThis as WithWebSocket).WebSocket === "undefined") {
  try {
    const require = createRequire(import.meta.url);
    (globalThis as WithWebSocket).WebSocket = require("ws");
  } catch {
    // Runtime já tem WebSocket nativo (Node 22+/bun) — nada a fazer.
  }
}
