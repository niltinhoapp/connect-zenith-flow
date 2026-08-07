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

// ── Supabase Storage (binário via REST, service role) ───────────────────────
const BUCKET = "whatsapp-media";
async function storageGet(path) {
  const r = await fetch(`${BASE}/storage/v1/object/${BUCKET}/${path}`,
    { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } });
  if (!r.ok) throw new Error(`storage get ${r.status}`);
  return new Uint8Array(await r.arrayBuffer());
}
async function storagePut(path, bytes, mime) {
  const r = await fetch(`${BASE}/storage/v1/object/${BUCKET}/${path}`, { method: "POST",
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": mime, "x-upsert": "true" }, body: bytes });
  if (!r.ok) throw new Error(`storage put ${r.status}: ${(await r.text()).slice(0, 120)}`);
}

// Upload de mídia para a Meta (multipart) → media_id. 4xx = permanente.
async function metaUploadMedia(ctx, bytes, mime, filename) {
  const form = new FormData();
  form.append("messaging_product", "whatsapp");
  form.append("type", mime);
  form.append("file", new Blob([bytes], { type: mime }), filename || "file");
  const r = await fetch(`https://graph.facebook.com/${GRAPH}/${ctx.phone_number_id}/media`,
    { method: "POST", headers: { Authorization: `Bearer ${ctx.access_token}` }, body: form });
  const d = await r.json().catch(() => ({}));
  if (r.ok && d.id) return { mediaId: d.id };
  if (r.status >= 400 && r.status < 500) return { permanent: d?.error?.message ?? `upload ${r.status}` };
  throw new Error(`meta upload ${r.status}`);
}
// Envia mensagem de mídia (por media_id). 4xx = permanente.
async function metaSendMedia(ctx, mediaId) {
  const t = ctx.type; // image|audio|document
  const mediaObj = { id: mediaId };
  if (ctx.body && (t === "image" || t === "document")) mediaObj.caption = ctx.body;
  if (ctx.media?.filename && t === "document") mediaObj.filename = ctx.media.filename;
  const r = await fetch(`https://graph.facebook.com/${GRAPH}/${ctx.phone_number_id}/messages`, { method: "POST",
    headers: { Authorization: `Bearer ${ctx.access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to: ctx.to, type: t, [t]: mediaObj }) });
  const d = await r.json().catch(() => ({}));
  if (r.ok) return { externalId: d.messages?.[0]?.id };
  if (r.status >= 400 && r.status < 500) return { permanent: d?.error?.message ?? `meta ${r.status}` };
  throw new Error(`meta ${r.status}`);
}

// Baixa a mídia da Meta (resolve url → binário). 4xx = permanente.
async function metaDownloadMedia(ctx) {
  const auth = { Authorization: `Bearer ${ctx.access_token}` };
  const m = await fetch(`https://graph.facebook.com/${GRAPH}/${ctx.external_media_id}`, { headers: auth });
  const md = await m.json().catch(() => ({}));
  if (!m.ok || !md.url) {
    if (m.status >= 400 && m.status < 500) return { permanent: md?.error?.message ?? `media ${m.status}` };
    throw new Error(`meta media ${m.status}`);
  }
  const b = await fetch(md.url, { headers: auth });
  if (!b.ok) throw new Error(`meta media dl ${b.status}`);
  return { bytes: new Uint8Array(await b.arrayBuffer()), mime: md.mime_type || ctx.mime || "application/octet-stream" };
}

// ── Motor de automações — espelho de src/features/automacoes/domain/engine.ts ─
// (o worker é .mjs e não importa TS; a versão TS + testes é a spec autoritativa)
const MAX_STEPS = 200;
const UNIT_MS = { seconds: 1000, minutes: 60000, hours: 3600000, days: 86400000 };
const _getNode = (g, k) => g.nodes.find((n) => n.node_key === k);
function _entryNode(g) {
  const t = g.nodes.find((n) => n.type === "trigger");
  if (t) return t;
  const targets = new Set(g.edges.map((e) => e.to_node));
  return g.nodes.find((n) => !targets.has(n.node_key));
}
function _resolveNext(g, from, branch) {
  const out = g.edges.filter((e) => e.from_node === from);
  if (!out.length) return null;
  if (branch !== undefined) {
    const labeled = out.find((e) => e.branch === (branch ? "yes" : "no"));
    if (labeled) return labeled.to_node;
    const linear = out.find((e) => !e.branch);
    return branch && linear ? linear.to_node : null;
  }
  return (out.find((e) => !e.branch) ?? out[0]).to_node;
}
function _resolveField(ctx, path) {
  if (!path) return undefined;
  return path.split(".").reduce((a, k) => (a && typeof a === "object" ? a[k] : undefined), ctx);
}
function _coerce(v, type) {
  if (v == null) return v;
  if (type === "number") return typeof v === "number" ? v : Number(v);
  if (type === "boolean") return typeof v === "boolean" ? v : v === "true" || v === true || v === 1;
  if (type === "date") { const t = v instanceof Date ? v.getTime() : Date.parse(String(v)); return Number.isNaN(t) ? NaN : t; }
  return typeof v === "string" ? v : String(v);
}
function _evalCondition(c, ctx) {
  const raw = _resolveField(ctx, c.field), op = c.op, vt = c.valueType;
  if (op === "exists") return raw !== undefined && raw !== null && raw !== "";
  if (op === "not_exists") return raw === undefined || raw === null || raw === "";
  if (op === "in") { const list = Array.isArray(c.value) ? c.value : [c.value]; return list.some((i) => _coerce(raw, vt) === _coerce(i, vt)); }
  if (op === "contains" || op === "not_contains") {
    const needle = _coerce(c.value, vt ?? "text");
    const hit = Array.isArray(raw) ? raw.map((x) => _coerce(x, vt ?? "text")).includes(needle) : String(raw ?? "").includes(String(needle ?? ""));
    return op === "contains" ? hit : !hit;
  }
  if (op === "starts_with") return String(raw ?? "").startsWith(String(c.value ?? ""));
  const l = _coerce(raw, vt), r = _coerce(c.value, vt);
  switch (op) { case "eq": return l === r; case "ne": return l !== r; case "gt": return l > r; case "gte": return l >= r; case "lt": return l < r; case "lte": return l <= r; default: return false; }
}
function _delayMs(cfg) {
  if (typeof cfg.ms === "number") return Math.max(0, cfg.ms);
  return Math.max(0, Number(cfg.amount ?? 0) * (UNIT_MS[String(cfg.unit ?? "minutes")] ?? 60000));
}
function planFrom(g, startKey, ctx) {
  const steps = []; let cur;
  if (!startKey) { const e = _entryNode(g); cur = e ? _resolveNext(g, e.node_key) : null; } else cur = startKey;
  for (let i = 0; i < MAX_STEPS && cur; i++) {
    const node = _getNode(g, cur);
    if (!node) return { steps, done: true };
    if (node.type === "condition" || node.type === "branch") {
      const result = _evalCondition(node.config, ctx);
      steps.push({ node: node.node_key, type: node.type, result });
      cur = _resolveNext(g, node.node_key, result); continue;
    }
    if (node.type === "delay") {
      const next = _resolveNext(g, node.node_key);
      if (!next) return { steps, done: true };
      return { steps, wait: { node: next, ms: _delayMs(node.config) }, done: false };
    }
    if (node.type === "action") {
      steps.push({ node: node.node_key, type: "action", action: String(node.config.action ?? ""), config: node.config });
      cur = _resolveNext(g, node.node_key); continue;
    }
    cur = _resolveNext(g, node.node_key);
  }
  return { steps, done: cur === null };
}

// Interpola {{caminho}} no config do nó com o contexto da run (valores concretos).
function interpolate(config, ctx) {
  const walk = (v) => {
    if (typeof v === "string") {
      const exact = v.match(/^\{\{\s*([\w.]+)\s*\}\}$/);
      if (exact) { const r = _resolveField(ctx, exact[1]); return r === undefined ? v : r; }
      return v.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, p) => { const r = _resolveField(ctx, p); return r == null ? "" : String(r); });
    }
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") { const o = {}; for (const k of Object.keys(v)) o[k] = walk(v[k]); return o; }
    return v;
  };
  return walk(config || {});
}

// Ação externa (webhook) — fronteira de Provider no worker; 5xx = transitório.
async function callWebhook(cfg) {
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), 10000);
  try {
    const method = (cfg.method || "POST").toUpperCase();
    const r = await fetch(cfg.url, {
      method,
      headers: { "Content-Type": "application/json", ...(cfg.headers || {}) },
      body: method === "GET" ? undefined : JSON.stringify(cfg.body ?? {}),
      signal: ctrl.signal,
    });
    if (!r.ok && r.status >= 500) throw new Error(`webhook ${r.status}`);
    return { status: r.status };
  } finally { clearTimeout(to); }
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

    let out;
    if (ctx.media) {
      // Mídia: baixa do Storage → upload p/ Meta → envia por media_id.
      const bytes = await storageGet(ctx.media.storage_path);
      const up = await metaUploadMedia(ctx, bytes, ctx.media.mime, ctx.media.filename);
      if (up.permanent) { await rpc("wa_mark_failed", { p_org: org, p_message_id: messageId, p_error: { message: up.permanent } }); return; }
      out = await metaSendMedia(ctx, up.mediaId);
    } else {
      out = await metaSend(ctx);                                 // texto/template
    }
    if (out.permanent) {
      await rpc("wa_mark_failed", { p_org: org, p_message_id: messageId, p_error: { message: out.permanent } });
    } else if (out.externalId) {
      await rpc("wa_mark_sent", { p_org: org, p_message_id: messageId, p_wa_message_id: out.externalId });
    }
  },
  "whatsapp.media.download": async (job) => {
    const mediaId = job.payload?.media_id;
    if (!mediaId) return;
    const ctx = await rpc("wa_media_download_context", { p_media_id: mediaId });
    if (!ctx || ctx.status === "stored") return;                 // idempotente
    if (!ctx.access_token || !ctx.external_media_id) return;
    const dl = await metaDownloadMedia(ctx);
    if (dl.permanent) return;                                     // mídia expirada na Meta: desiste
    const ext = (dl.mime.split("/")[1] || "bin").split(";")[0];
    const path = `${ctx.organization_id}/inbound/${mediaId}.${ext}`;
    await storagePut(path, dl.bytes, dl.mime);
    await rpc("wa_media_stored", { p_media_id: mediaId, p_storage_path: path, p_size: dl.bytes.length });
  },
  "automation.run": async (job) => {
    const runId = job.payload?.run_id;
    if (!runId) return;
    const ctx = await rpc("automation_run_context", { p_run_id: runId });
    if (!ctx) return;
    if (["succeeded", "failed", "canceled"].includes(ctx.status)) return; // idempotente
    const org = ctx.organization_id;
    const flowCtx = ctx.context || {};

    // Marca em execução (publica automation.started na 1ª vez).
    await rpc("automation_advance_run", { p_run_id: runId, p_current_node: ctx.current_node, p_status: "running", p_error: null });

    const graph = { nodes: ctx.nodes || [], edges: ctx.edges || [] };
    const plan = planFrom(graph, ctx.current_node, flowCtx);

    for (const step of plan.steps) {
      if (step.type === "condition" || step.type === "branch") {
        await rpc("automation_record_step", { p_run_id: runId, p_node: step.node, p_type: step.type, p_status: "ok", p_input: {}, p_output: { result: step.result }, p_error: null });
        continue;
      }
      // Idempotência retry-safe: pula só se este nó de ação já concluiu com 'ok'.
      // (a falha NÃO marca conclusão → o retry reexecuta; sem mascarar falha.)
      if (await rpc("automation_node_done", { p_run_id: runId, p_node: step.node })) continue;
      const resolved = interpolate(step.config, flowCtx);
      try {
        const out = step.action === "webhook.call"
          ? await callWebhook(resolved)
          : await rpc("automation_action", { p_org: org, p_action: step.action, p_config: resolved });
        await rpc("automation_record_step", { p_run_id: runId, p_node: step.node, p_type: "action", p_status: "ok", p_input: resolved, p_output: out ?? {}, p_error: null });
      } catch (e) {
        await rpc("automation_record_step", { p_run_id: runId, p_node: step.node, p_type: "action", p_status: "failed", p_input: resolved, p_output: {}, p_error: String(e?.message ?? e) });
        throw e; // deixa a fila fazer retry/backoff/DLQ
      }
    }

    if (plan.wait) {
      const at = new Date(Date.now() + plan.wait.ms).toISOString();
      await rpc("automation_record_step", { p_run_id: runId, p_node: plan.wait.node, p_type: "delay", p_status: "waiting", p_input: {}, p_output: { resume_at: at }, p_error: null });
      await rpc("automation_advance_run", { p_run_id: runId, p_current_node: plan.wait.node, p_status: "running", p_error: null });
      await rpc("enqueue_job", {
        p_org: org, p_type: "automation.run", p_payload: { run_id: runId }, p_available_at: at,
        p_priority: 0, p_max_attempts: 5, p_trace_id: null, p_correlation_id: null,
        p_idempotency_key: `automation.run:${runId}:resume:${plan.wait.node}`, p_payload_version: 1,
      });
    } else {
      await rpc("automation_advance_run", { p_run_id: runId, p_current_node: null, p_status: "succeeded", p_error: null });
    }
  },
};

// ── Agendador — espelho de src/features/automacoes/domain/schedule.ts ─────────
const SCHED_UNIT_MS = { minutes: 60000, hours: 3600000, days: 86400000 };
function parseSchedule(c) {
  if (!c || typeof c !== "object") return null;
  const mode = String(c.mode ?? (c.every ? "interval" : c.at ? "daily" : ""));
  if (mode === "interval") {
    const every = Math.floor(Number(c.every)); const unit = String(c.unit);
    if (!Number.isFinite(every) || every < 1 || !(unit in SCHED_UNIT_MS)) return null;
    return { mode: "interval", every, unit };
  }
  if (mode === "daily") {
    const at = String(c.at ?? "");
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(at)) return null;
    return { mode: "daily", at };
  }
  return null;
}
function nextRunAt(config, from = new Date()) {
  const s = parseSchedule(config); if (!s) return null;
  if (s.mode === "interval") return new Date(from.getTime() + s.every * SCHED_UNIT_MS[s.unit]);
  const [h, m] = s.at.split(":").map(Number);
  const next = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate(), h, m, 0, 0));
  if (next.getTime() <= from.getTime()) next.setUTCDate(next.getUTCDate() + 1);
  return next;
}

// Dispara automações "scheduled" vencidas e reprograma o próximo horário.
// Idempotente por slot (start_run dedup por 'sched:<slot>'); reprograma a partir
// de "agora" (pula slots perdidos se o worker esteve fora, evitando enxurrada).
async function dispatchScheduled() {
  const due = (await rpc("automation_due_scheduled", { p_limit: 50 })) ?? [];
  const now = new Date();
  for (const a of due) {
    const next = nextRunAt(a.trigger_config, now);
    if (!next) continue; // schedule inválida: ignora
    if (a.next_run_at == null) {
      await rpc("automation_set_next_run", { p_id: a.id, p_next: next.toISOString() }); // 1ª vez: só agenda
      continue;
    }
    const slot = new Date(a.next_run_at).toISOString();
    await rpc("automation_start_run", {
      p_org: a.organization_id, p_automation_id: a.id, p_trigger_event: "scheduled",
      p_context: { scheduledAt: slot }, p_idempotency: `sched:${slot}`,
    }).catch((e) => console.warn(`  ! start_run scheduled ${a.id}: ${e?.message ?? e}`));
    await rpc("automation_set_next_run", { p_id: a.id, p_next: next.toISOString() });
    console.log(`⏰ scheduled ${a.id} → run (slot ${slot}); próximo ${next.toISOString()}`);
  }
}

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
      const err = String(e?.message ?? e);
      const outcome = await rpc("fail_job", { p_id: job.id, p_error: err }).catch(() => "?");
      // Esgotou retries (DLQ): marca a run como failed (publica automation.failed).
      if (outcome === "dead" && job.type === "automation.run" && job.payload?.run_id) {
        await rpc("automation_advance_run", {
          p_run_id: job.payload.run_id, p_current_node: null, p_status: "failed", p_error: err,
        }).catch((e2) => console.warn(`  ! falha ao marcar run failed: ${e2?.message ?? e2}`));
      }
      console.warn(`✗ ${job.type} ${job.id} → ${outcome}`);
    }
  }
}

console.log(`[worker] iniciado (${WORKER}) → ${BASE}`);
let lastSched = 0;
while (running) {
  try { await runOnce(); } catch (e) { console.error("[worker] loop:", e.message); }
  // Agendador: verifica a cada ~30s (não a cada tick) os fluxos "scheduled".
  try {
    if (Date.now() - lastSched > 30000) { lastSched = Date.now(); await dispatchScheduled(); }
  } catch (e) { console.error("[worker] scheduled:", e.message); }
  await new Promise((r) => setTimeout(r, 2000));
}
console.log("[worker] parado.");
