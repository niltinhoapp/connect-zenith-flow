// Worker local da plataforma (F3.0.1 · H2). Runtime inicial — sem Edge Functions.
// Reivindica jobs da fila (claim_jobs), executa o handler por `type` e conclui
// (complete) ou falha (fail → retry/backoff/DLQ). Mesmo protocolo do
// RestQueueProvider/JobWorker do Core. Rodar: `npm run worker`.
import { readFileSync } from "node:fs";

const env = readFileSync(new URL("../.env", import.meta.url), "utf8");
const get = (k) => { const m = env.match(new RegExp("^" + k + "=(.*)$", "m")); return m ? m[1].trim().replace(/^["']|["']$/g, "") : ""; };
const BASE = get("VITE_SUPABASE_URL");
const KEY = get("SUPABASE_SERVICE_ROLE_KEY");
if (!BASE || !KEY) { console.error("[worker] .env sem VITE_SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY"); process.exit(1); }
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

const rpc = async (n, b) => {
  const r = await fetch(`${BASE}/rest/v1/rpc/${n}`, { method: "POST", headers: H, body: JSON.stringify(b) });
  if (!r.ok) throw new Error(`${n} ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.status === 204 ? null : r.json();
};

const GRAPH = get("WHATSAPP_GRAPH_VERSION") || "v21.0";

// Envio via WhatsApp Cloud API (Meta). Erro 4xx = permanente (marca failed);
// erro de rede/5xx = transitório (relança → retry/backoff da fila).
async function metaSend(ctx) {
  const url = `https://graph.facebook.com/${GRAPH}/${ctx.phone_number_id}/messages`;
  const body = ctx.type === "template"
    ? { messaging_product: "whatsapp", to: ctx.to, type: "template",
        template: { name: ctx.template?.name, language: { code: ctx.template?.language },
          ...(ctx.template?.components?.length ? { components: ctx.template.components } : {}) } }
    : { messaging_product: "whatsapp", to: ctx.to, type: "text", text: { preview_url: false, body: ctx.body ?? "" } };
  const r = await fetch(url, { method: "POST",
    headers: { Authorization: `Bearer ${ctx.access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body) });
  const data = await r.json().catch(() => ({}));
  if (r.ok) return { externalId: data.messages?.[0]?.id };
  if (r.status >= 400 && r.status < 500) return { permanent: data?.error?.message ?? `meta ${r.status}` };
  throw new Error(`meta ${r.status}`); // transitório
}

// Handlers registrados por tipo (módulos futuros adicionam os seus).
const handlers = {
  "noop": async () => {},
  "outbox.relay": async (job) => {
    const id = job.payload?.event_id;
    if (id) await rpc("relay_domain_event", { p_event_id: id });
  },
  "whatsapp.send": async (job) => {
    const messageId = job.payload?.message_id;
    if (!messageId) return;
    const ctx = await rpc("wa_send_context", { p_message_id: messageId });
    if (!ctx || ctx.status !== "pending") return;                 // idempotente
    const org = ctx.organization_id;
    if (!ctx.phone_number_id || !ctx.access_token) {
      await rpc("wa_mark_failed", { p_org: org, p_message_id: messageId, p_error: { reason: "sem credencial/numero" } });
      return;
    }
    const first = await rpc("claim_idempotency", { p_org: org, p_key: `whatsapp.send:dispatch:${messageId}` });
    if (!first) return;                                           // despacho já feito
    const out = await metaSend(ctx);                             // pode relançar (retry)
    if (out.permanent) {
      await rpc("wa_mark_failed", { p_org: org, p_message_id: messageId, p_error: { message: out.permanent } });
    } else if (out.externalId) {
      await rpc("wa_mark_sent", { p_org: org, p_message_id: messageId, p_wa_message_id: out.externalId });
    }
  },
};

const WORKER = `worker-local-${process.pid}`;
let running = true;
process.on("SIGINT", () => { running = false; });
process.on("SIGTERM", () => { running = false; });

async function runOnce() {
  const jobs = (await rpc("claim_jobs", { p_worker: WORKER, p_limit: 10, p_lease_seconds: 60 })) ?? [];
  for (const job of jobs) {
    const handler = handlers[job.type];
    try {
      if (!handler) throw new Error(`sem handler para o tipo "${job.type}"`);
      const result = await handler(job);
      await rpc("complete_job", { p_id: job.id, p_result: result ?? {} });
      console.log(`✓ ${job.type} ${job.id}`);
    } catch (e) {
      const outcome = await rpc("fail_job", { p_id: job.id, p_error: String(e?.message ?? e) }).catch(() => "?");
      console.warn(`✗ ${job.type} ${job.id} → ${outcome}`);
    }
  }
}

console.log(`[worker] iniciado (${WORKER}) → ${BASE}`);
while (running) {
  try { await runOnce(); } catch (e) { console.error("[worker] loop:", e.message); }
  await new Promise((r) => setTimeout(r, 2000));
}
console.log("[worker] parado.");
