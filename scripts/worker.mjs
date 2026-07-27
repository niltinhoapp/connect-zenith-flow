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

// Handlers registrados por tipo (módulos futuros adicionam os seus).
const handlers = {
  "noop": async () => {},
  "outbox.relay": async (job) => {
    const id = job.payload?.event_id;
    if (id) await rpc("relay_domain_event", { p_event_id: id });
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
