// Edge Function: whatsapp-connect
// Conecta uma WABA à organização. Dois modos, ambos REAIS (sem mock):
//   • embedded: troca o `code` do Embedded Signup por um token de sistema.
//   • manual:   recebe um token de sistema + waba_id + phone_number_id.
// Em ambos: busca dados do número no Graph, inscreve o app no webhook da WABA e
// persiste conta+número+credencial via RPC wa_store_connection (service_role).
//
// Requer Authorization: Bearer <JWT do usuário> (valida org + whatsapp.connect).
// Deploy padrão (com verificação de JWT): `supabase functions deploy whatsapp-connect`.
//
// Secrets: META_APP_ID, META_APP_SECRET, WHATSAPP_GRAPH_VERSION (opcional),
//          WHATSAPP_WEBHOOK_VERIFY_TOKEN (repassado à conta para verificação).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const APP_ID = Deno.env.get("META_APP_ID") ?? "";
const APP_SECRET = Deno.env.get("META_APP_SECRET") ?? "";
const GRAPH = Deno.env.get("WHATSAPP_GRAPH_VERSION") ?? "v21.0";
const VERIFY_TOKEN = Deno.env.get("WHATSAPP_WEBHOOK_VERIFY_TOKEN") ?? "";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

async function graph(path: string, token: string, init?: RequestInit) {
  const res = await fetch(`https://graph.facebook.com/${GRAPH}/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok)
    throw new Error(`graph ${path} ${res.status}: ${JSON.stringify(data?.error ?? data)}`);
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader) return json({ error: "missing authorization" }, 401);

  const body = await req.json().catch(() => ({}));
  const { organizationId, mode, code, accessToken, wabaId, phoneNumberId } = body ?? {};
  if (!organizationId) return json({ error: "organizationId obrigatório" }, 400);

  // 1) Valida o usuário e a permissão whatsapp.connect (client escopado ao JWT).
  const asUser = createClient(SUPABASE_URL, ANON, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: canConnect, error: permErr } = await asUser.rpc("has_permission", {
    org: organizationId,
    perm: "whatsapp.connect",
  });
  if (permErr) return json({ error: permErr.message }, 400);
  if (!canConnect) return json({ error: "forbidden" }, 403);

  try {
    // 2) Obtém o token de sistema.
    let token: string;
    if (mode === "embedded") {
      if (!code) return json({ error: "code obrigatório no modo embedded" }, 400);
      if (!APP_ID || !APP_SECRET)
        return json({ error: "META_APP_ID/SECRET não configurados" }, 400);
      const params = new URLSearchParams({ client_id: APP_ID, client_secret: APP_SECRET, code });
      const res = await fetch(`https://graph.facebook.com/${GRAPH}/oauth/access_token?${params}`);
      const data = await res.json();
      if (!res.ok || !data.access_token) {
        return json({ error: "falha no token exchange", detail: data?.error ?? data }, 400);
      }
      token = data.access_token;
    } else {
      if (!accessToken) return json({ error: "accessToken obrigatório no modo manual" }, 400);
      token = accessToken;
    }

    if (!wabaId || !phoneNumberId) {
      return json({ error: "wabaId e phoneNumberId obrigatórios" }, 400);
    }

    // 3) Busca dados do número + da conta no Graph.
    const phone = await graph(
      `${phoneNumberId}?fields=display_phone_number,verified_name,quality_rating`,
      token,
    );
    let name: string | null = null;
    let businessId: string | null = null;
    try {
      const waba = await graph(`${wabaId}?fields=name,owner_business_info`, token);
      name = waba?.name ?? null;
      businessId = waba?.owner_business_info?.id ?? null;
    } catch (_) {
      /* opcional */
    }

    // 4) Inscreve o app no webhook da WABA (recebimento de eventos).
    try {
      await graph(`${wabaId}/subscribed_apps`, token, { method: "POST" });
    } catch (e) {
      console.warn("[whatsapp-connect] subscribe falhou (verifique permissões):", String(e));
    }

    // 5) Persiste conta + número + credencial (service_role).
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
    const { data: stored, error: storeErr } = await admin.rpc("wa_store_connection", {
      p_org: organizationId,
      p_provider: "meta",
      p_waba_id: wabaId,
      p_business_id: businessId,
      p_name: name,
      p_phone_number_id: phoneNumberId,
      p_display: phone?.display_phone_number ?? null,
      p_verified_name: phone?.verified_name ?? null,
      p_access_token: token,
      p_app_secret: APP_SECRET || null,
      p_verify_token: VERIFY_TOKEN || null,
    });
    if (storeErr) return json({ error: storeErr.message }, 400);

    return json({
      ok: true,
      account: stored,
      phone: {
        display_phone_number: phone?.display_phone_number,
        verified_name: phone?.verified_name,
      },
    });
  } catch (e) {
    console.error("[whatsapp-connect]", e);
    return json({ error: String((e as Error)?.message ?? e) }, 400);
  }
});
