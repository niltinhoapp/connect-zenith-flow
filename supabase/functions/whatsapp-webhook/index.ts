// Edge Function: whatsapp-webhook
// Recebe eventos da WhatsApp Cloud API (Meta). Deploy SEM verificação de JWT
// (a Meta chama sem auth): `supabase functions deploy whatsapp-webhook --no-verify-jwt`.
//
// GET  → verificação do webhook (hub.challenge).
// POST → valida assinatura X-Hub-Signature-256 (HMAC do corpo cru com o App
//        Secret), roteia mensagens/status ao tenant certo e persiste via RPC.
//
// Secrets (supabase secrets set ...):
//   WHATSAPP_WEBHOOK_VERIFY_TOKEN, WHATSAPP_APP_SECRET
//   (SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são injetados automaticamente)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VERIFY_TOKEN = Deno.env.get("WHATSAPP_WEBHOOK_VERIFY_TOKEN") ?? "";
const APP_SECRET = Deno.env.get("WHATSAPP_APP_SECRET") ?? "";

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

const enc = new TextEncoder();
const toHex = (buf: ArrayBuffer) =>
  [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

/** Valida X-Hub-Signature-256 (sha256=<hmac>) sobre o corpo cru. */
async function validSignature(raw: string, header: string | null): Promise<boolean> {
  if (!APP_SECRET) return true; // sem segredo configurado ainda: não bloqueia (pré-credencial)
  if (!header?.startsWith("sha256=")) return false;
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(APP_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(raw));
  const expected = toHex(sig);
  const got = header.slice("sha256=".length);
  // comparação em tempo ~constante
  if (expected.length !== got.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ got.charCodeAt(i);
  return diff === 0;
}

// ── Normalização do payload da Meta (formato neutro) ─────────────────────────
type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === "object" ? (v as Obj) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

function bodyOf(msg: Obj, type: string): string | null {
  if (type === "text") return String(obj(msg.text).body ?? "") || null;
  if (type === "button") return String(obj(msg.button).text ?? "") || null;
  const caption = obj((msg as Obj)[type]).caption;
  return caption ? String(caption) : null;
}

const MEDIA_TYPES = ["image", "audio", "document", "video", "sticker"];
/** Extrai id/mime/filename de uma mensagem de mídia; null se não for mídia. */
function mediaOf(msg: Obj, type: string): { id: string; mime: string; filename: string | null } | null {
  if (!MEDIA_TYPES.includes(type)) return null;
  const m = obj((msg as Obj)[type]);
  const id = m.id ? String(m.id) : "";
  if (!id) return null;
  return { id, mime: m.mime_type ? String(m.mime_type) : "", filename: m.filename ? String(m.filename) : null };
}

async function handlePost(raw: string): Promise<Response> {
  let payload: Obj;
  try { payload = obj(JSON.parse(raw)); } catch { return new Response("bad json", { status: 400 }); }

  for (const entry of arr(payload.entry)) {
    for (const change of arr(obj(entry).changes)) {
      const value = obj(obj(change).value);
      const phoneNumberId = String(obj(value.metadata).phone_number_id ?? "");
      if (!phoneNumberId) continue;

      // Roteia ao tenant pelo phone_number_id (Meta) → org + número interno.
      const { data: resolved } = await admin.rpc("wa_resolve_phone", { p_phone_number_id: phoneNumberId });
      if (!resolved) continue; // número não conectado a nenhuma org: ignora
      const org = (resolved as Obj).organization_id as string;
      const phoneId = (resolved as Obj).phone_id as string;

      const contacts = arr(value.contacts).map(obj);
      const contactName = contacts.length ? String(obj(contacts[0].profile).name ?? "") || null : null;

      // Mensagens recebidas (texto inalterado; mídia é aditiva)
      for (const raw2 of arr(value.messages).map(obj)) {
        const type = String(raw2.type ?? "text");
        const wamid = String(raw2.id ?? "");
        const { data: msgId } = await admin.rpc("wa_ingest_inbound", {
          p_org: org, p_phone_number_id: phoneId, p_contact_wa_id: String(raw2.from ?? ""),
          p_contact_name: contactName, p_wa_message_id: wamid, p_type: type,
          p_body: bodyOf(raw2, type), p_payload: raw2,
        });
        await admin.rpc("wa_log_webhook", {
          p_org: org, p_provider: "meta", p_event_type: "message", p_external_id: wamid, p_payload: raw2,
        });
        // Mídia inbound: registra + enfileira o download (idempotente por external id).
        const media = mediaOf(raw2, type);
        if (media && msgId) {
          await admin.rpc("wa_register_inbound_media", {
            p_org: org, p_message_id: msgId as string, p_external_media_id: media.id,
            p_mime: media.mime, p_filename: media.filename,
          });
        }
      }

      // Status de entrega
      for (const st of arr(value.statuses).map(obj)) {
        const status = String(st.status ?? "");
        if (!["sent", "delivered", "read", "failed"].includes(status)) continue;
        const wamid = String(st.id ?? "");
        const ts = Number(st.timestamp);
        await admin.rpc("wa_apply_status", {
          p_org: org, p_wa_message_id: wamid, p_status: status,
          p_occurred_at: Number.isFinite(ts) ? new Date(ts * 1000).toISOString() : new Date().toISOString(),
          p_raw: st,
        });
        await admin.rpc("wa_log_webhook", {
          p_org: org, p_provider: "meta", p_event_type: "status:" + status,
          p_external_id: wamid + ":" + status, p_payload: st,
        });
      }
    }
  }
  return new Response("ok", { status: 200 });
}

Deno.serve(async (req) => {
  const url = new URL(req.url);

  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge") ?? "";
    if (mode === "subscribe" && token && token === VERIFY_TOKEN) {
      return new Response(challenge, { status: 200 });
    }
    return new Response("forbidden", { status: 403 });
  }

  if (req.method === "POST") {
    const raw = await req.text();
    if (!(await validSignature(raw, req.headers.get("x-hub-signature-256")))) {
      return new Response("invalid signature", { status: 401 });
    }
    try {
      return await handlePost(raw);
    } catch (e) {
      console.error("[whatsapp-webhook]", e);
      // 200 mesmo em erro interno evita retempestade de retries da Meta;
      // o envelope fica auditável e reprocessável.
      return new Response("ok", { status: 200 });
    }
  }

  return new Response("method not allowed", { status: 405 });
});
