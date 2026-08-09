// Checkout hospedado do plano mensal ConnectWeb Completo.
// Cartão é coletado diretamente pelo Asaas; a ConnectWeb nunca o recebe.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY") ?? "";
const ASAAS_ENV = Deno.env.get("ASAAS_ENV") ?? "sandbox";
const APP_PUBLIC_URL = Deno.env.get("APP_PUBLIC_URL") ?? "";
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

function assertEnvironment() {
  if (!ASAAS_API_KEY) throw new Error("ASAAS_API_KEY não configurada");
  const prefix = ASAAS_ENV === "production" ? "$aact_prod_" : "$aact_hmlg_";
  if (!ASAAS_API_KEY.startsWith(prefix)) throw new Error("Chave Asaas incompatível com o ambiente");
}

function callbackBase(req: Request) {
  const candidate = APP_PUBLIC_URL || req.headers.get("origin") || "http://localhost:8080";
  const url = new URL(candidate);
  if (url.protocol !== "https:" && url.hostname !== "localhost")
    throw new Error("APP_PUBLIC_URL inválida");
  return url.origin;
}

async function createCheckout(body: unknown) {
  const response = await fetch(`${ASAAS_BASE}/checkouts`, {
    method: "POST",
    headers: {
      access_token: ASAAS_API_KEY,
      "Content-Type": "application/json",
      "User-Agent": "ConnectWeb-Automations/1.0",
    },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      data?.errors
        ?.map((item: { description?: string }) => item.description)
        .filter(Boolean)
        .join("; ") || `Asaas respondeu ${response.status}`;
    throw new Error(message);
  }
  return data;
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
    const customer = input?.customer ?? {};
    if (!UUID.test(organizationId)) return json({ error: "organizationId inválido" }, 400);

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

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
    const [{ data: product }, { data: profile }, { data: subscription }] = await Promise.all([
      admin
        .from("billing_products")
        .select("id,name,description,price_cents")
        .eq("id", "connectweb_complete")
        .single(),
      admin
        .from("billing_customer_profiles")
        .select("legal_name,email,tax_id,phone")
        .eq("organization_id", organizationId)
        .single(),
      admin
        .from("billing_subscriptions")
        .select("id,status")
        .eq("organization_id", organizationId)
        .single(),
    ]);
    if (!product || !profile || !subscription)
      throw new Error("Dados da assinatura não encontrados");
    if (subscription.status === "active") return json({ error: "A assinatura já está ativa" }, 409);

    const base = callbackBase(req);
    const returnUrl = `${base}/configuracoes`;
    const now = new Date();
    const nextDueDate = now.toISOString().slice(0, 10);
    const checkout = await createCheckout({
      billingTypes: ["CREDIT_CARD"],
      chargeTypes: ["RECURRENT"],
      minutesToExpire: 120,
      externalReference: `cw:subscription:${subscription.id}`,
      callback: { successUrl: returnUrl, cancelUrl: returnUrl, expiredUrl: returnUrl },
      items: [
        {
          name: product.name,
          description: product.description,
          quantity: 1,
          value: product.price_cents / 100,
        },
      ],
      customerData: {
        name: profile.legal_name,
        email: profile.email,
        cpfCnpj: profile.tax_id,
        phone: profile.phone || undefined,
      },
      subscription: { cycle: "MONTHLY", nextDueDate },
    });
    if (!checkout?.id) throw new Error("Asaas não devolveu o identificador do checkout");
    const url =
      checkout.link ||
      `https://asaas.com/checkoutSession/show?id=${encodeURIComponent(checkout.id)}`;
    const { error: attachError } = await admin.rpc("attach_asaas_subscription_checkout", {
      p_org: organizationId,
      p_customer_id: "",
      p_checkout_id: checkout.id,
      p_checkout_url: url,
    });
    if (attachError) throw attachError;
    return json({
      subscriptionId: subscription.id,
      checkoutId: checkout.id,
      url,
      environment: ASAAS_ENV,
    });
  } catch (error) {
    console.error("[asaas-subscription-checkout]", error);
    return json({ error: String((error as Error)?.message ?? error) }, 400);
  }
});
