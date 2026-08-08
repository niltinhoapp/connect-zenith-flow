// Webhook público do Asaas com autenticação própria, idempotência e
// confirmação ativa da cobrança antes de liberar créditos.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY") ?? "";
const ASAAS_WEBHOOK_TOKEN = Deno.env.get("ASAAS_WEBHOOK_TOKEN") ?? "";
const ASAAS_ENV = Deno.env.get("ASAAS_ENV") ?? "sandbox";
const ASAAS_BASE =
  ASAAS_ENV === "production" ? "https://api.asaas.com/v3" : "https://api-sandbox.asaas.com/v3";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
const PAID = new Set(["PAYMENT_RECEIVED", "PAYMENT_CONFIRMED"]);
const CANCELED = new Set(["PAYMENT_DELETED"]);

function safeEqual(left: string, right: string): boolean {
  const a = new TextEncoder().encode(left);
  const b = new TextEncoder().encode(right);
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) difference |= a[index] ^ b[index];
  return difference === 0;
}

async function getPayment(id: string) {
  const response = await fetch(`${ASAAS_BASE}/payments/${encodeURIComponent(id)}`, {
    headers: { access_token: ASAAS_API_KEY, "User-Agent": "ConnectWeb-Automations/1.0" },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(`Não foi possível confirmar a cobrança no Asaas (${response.status})`);
  return body;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  const suppliedToken = req.headers.get("asaas-access-token") ?? "";
  if (!ASAAS_WEBHOOK_TOKEN || !safeEqual(suppliedToken, ASAAS_WEBHOOK_TOKEN)) {
    return json({ error: "unauthorized" }, 401);
  }

  const payload = await req.json().catch(() => null);
  const eventId = String(payload?.id ?? "");
  const eventType = String(payload?.event ?? "");
  const paymentId = String(payload?.payment?.id ?? "");
  if (!eventId || !eventType) return json({ error: "invalid event" }, 400);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  const { data: isNew, error: recordError } = await admin.rpc("record_billing_provider_event", {
    p_provider: "asaas",
    p_event_id: eventId,
    p_event_type: eventType,
    p_object_id: paymentId || null,
    p_payload: payload,
  });
  if (recordError) return json({ error: recordError.message }, 500);
  if (!isNew) return json({ ok: true, duplicate: true });

  const finish = async (status: "processed" | "ignored" | "failed", error?: string) => {
    await admin.rpc("finish_billing_provider_event", {
      p_provider: "asaas",
      p_event_id: eventId,
      p_status: status,
      p_error: error ?? null,
    });
  };

  try {
    if (!paymentId) {
      await finish("ignored");
      return json({ ok: true, ignored: true });
    }
    if (PAID.has(eventType)) {
      if (!ASAAS_API_KEY) throw new Error("ASAAS_API_KEY não configurada");
      const payment = await getPayment(paymentId);
      const match = /^cw:addon:([0-9a-f-]{36})$/i.exec(String(payment.externalReference ?? ""));
      if (!match) {
        await finish("ignored");
        return json({ ok: true, ignored: true });
      }
      const { data: purchase, error: purchaseError } = await admin
        .from("billing_purchases")
        .select("id,amount_cents,provider_payment_id")
        .eq("id", match[1])
        .single();
      if (purchaseError || !purchase) throw purchaseError ?? new Error("Compra não encontrada");
      if (purchase.provider_payment_id !== payment.id)
        throw new Error("Cobrança não pertence à compra");
      if (Math.round(Number(payment.value) * 100) !== purchase.amount_cents)
        throw new Error("Valor da cobrança divergente");
      if (!["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"].includes(String(payment.status))) {
        throw new Error("Cobrança ainda não está confirmada");
      }
      const { error: settleError } = await admin.rpc("settle_ai_addon_purchase", {
        p_purchase: purchase.id,
        p_provider: "asaas",
        p_payment_id: payment.id,
      });
      if (settleError) throw settleError;
      await finish("processed");
      return json({ ok: true });
    }
    if (CANCELED.has(eventType)) {
      const { error } = await admin.rpc("fail_asaas_addon_purchase", {
        p_payment_id: paymentId,
        p_status: "canceled",
      });
      if (error) throw error;
      await finish("processed");
      return json({ ok: true });
    }
    await finish("ignored");
    return json({ ok: true, ignored: true });
  } catch (error) {
    const message = String((error as Error)?.message ?? error);
    console.error("[asaas-webhook]", message);
    await finish("failed", message);
    return json({ error: "processing failed" }, 500);
  }
});
