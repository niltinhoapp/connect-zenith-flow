// Cria uma cobrança avulsa de créditos de IA no Asaas.
// O preço e os créditos são sempre lidos do catálogo interno.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY") ?? "";
const ASAAS_ENV = Deno.env.get("ASAAS_ENV") ?? "sandbox";
const ASAAS_BASE =
  ASAAS_ENV === "production" ? "https://api.asaas.com/v3" : "https://api-sandbox.asaas.com/v3";

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
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PRODUCT = /^ai_(advantage|turbo|ultra)$/;

function assertEnvironment() {
  if (!ASAAS_API_KEY) throw new Error("ASAAS_API_KEY não configurada");
  if (ASAAS_ENV !== "sandbox" && ASAAS_ENV !== "production") throw new Error("ASAAS_ENV inválido");
  const expected = ASAAS_ENV === "production" ? "$aact_prod_" : "$aact_hmlg_";
  if (!ASAAS_API_KEY.startsWith(expected)) {
    throw new Error(`A chave do Asaas não corresponde ao ambiente ${ASAAS_ENV}`);
  }
}

async function asaas(path: string, init: RequestInit = {}) {
  const response = await fetch(`${ASAAS_BASE}${path}`, {
    ...init,
    headers: {
      access_token: ASAAS_API_KEY,
      "Content-Type": "application/json",
      "User-Agent": "ConnectWeb-Automations/1.0",
      ...(init.headers ?? {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      body?.errors
        ?.map((item: { description?: string }) => item.description)
        .filter(Boolean)
        .join("; ") || `Asaas respondeu ${response.status}`;
    throw new Error(message);
  }
  return body;
}

function dueDate(): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + 3);
  return date.toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const authorization = req.headers.get("Authorization") ?? "";
  if (!authorization) return json({ error: "missing authorization" }, 401);

  try {
    assertEnvironment();
    const input = await req.json().catch(() => ({}));
    const organizationId = String(input?.organizationId ?? "");
    const productId = String(input?.productId ?? "");
    const idempotencyKey = String(input?.idempotencyKey ?? crypto.randomUUID());
    const customer = input?.customer ?? {};
    if (!UUID.test(organizationId) || !PRODUCT.test(productId))
      return json({ error: "dados inválidos" }, 400);

    const asUser = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    });
    const { data: allowed, error: permissionError } = await asUser.rpc("has_permission", {
      org: organizationId,
      perm: "billing.manage",
    });
    if (permissionError) throw permissionError;
    if (!allowed) return json({ error: "forbidden" }, 403);

    const { error: profileError } = await asUser.rpc("store_billing_customer_profile", {
      p_org: organizationId,
      p_legal_name: String(customer.legalName ?? ""),
      p_email: String(customer.email ?? ""),
      p_tax_id: String(customer.taxId ?? ""),
      p_phone: customer.phone ? String(customer.phone) : null,
    });
    if (profileError) return json({ error: profileError.message }, 400);

    const { data: purchaseId, error: purchaseError } = await asUser.rpc(
      "request_ai_addon_purchase",
      {
        p_org: organizationId,
        p_product: productId,
        p_idempotency_key: idempotencyKey,
      },
    );
    if (purchaseError) throw purchaseError;

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
    const [{ data: purchase, error: readError }, { data: profile, error: customerError }] =
      await Promise.all([
        admin
          .from("billing_purchases")
          .select("id,product_id,status,amount_cents,provider_payment_id,metadata")
          .eq("id", purchaseId)
          .single(),
        admin
          .from("billing_customer_profiles")
          .select("legal_name,email,tax_id,phone,provider,provider_customer_id")
          .eq("organization_id", organizationId)
          .single(),
      ]);
    if (readError || customerError || !purchase || !profile)
      throw readError ?? customerError ?? new Error("dados de cobrança ausentes");
    if (purchase.provider_payment_id && purchase.metadata?.invoice_url) {
      return json({
        purchaseId,
        paymentId: purchase.provider_payment_id,
        url: purchase.metadata.invoice_url,
      });
    }

    let customerId = profile.provider === "asaas" ? profile.provider_customer_id : null;
    if (!customerId) {
      const created = await asaas("/customers", {
        method: "POST",
        body: JSON.stringify({
          name: profile.legal_name,
          email: profile.email,
          cpfCnpj: profile.tax_id,
          mobilePhone: profile.phone || undefined,
          externalReference: organizationId,
          notificationDisabled: false,
        }),
      });
      customerId = created.id;
    }

    const payment = await asaas("/payments", {
      method: "POST",
      body: JSON.stringify({
        customer: customerId,
        billingType: "UNDEFINED",
        value: purchase.amount_cents / 100,
        dueDate: dueDate(),
        description: `ConnectWeb — créditos adicionais de IA (${purchase.product_id})`,
        externalReference: `cw:addon:${purchase.id}`,
      }),
    });
    if (!payment?.id || !payment?.invoiceUrl)
      throw new Error("Asaas não devolveu o link da cobrança");

    const { error: attachError } = await admin.rpc("attach_asaas_addon_checkout", {
      p_purchase: purchase.id,
      p_customer_id: customerId,
      p_payment_id: payment.id,
      p_invoice_url: payment.invoiceUrl,
    });
    if (attachError) throw attachError;

    return json({
      purchaseId: purchase.id,
      paymentId: payment.id,
      url: payment.invoiceUrl,
      environment: ASAAS_ENV,
    });
  } catch (error) {
    console.error("[asaas-checkout]", error);
    return json({ error: String((error as Error)?.message ?? error) }, 400);
  }
});
