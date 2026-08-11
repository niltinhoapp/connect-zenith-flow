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
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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

function callbackUrls(req: Request) {
  const base = callbackBase(req);
  const returnUrl = `${base}/configuracoes`;
  if (!base.startsWith("http://localhost")) {
    return { successUrl: returnUrl, cancelUrl: returnUrl, expiredUrl: returnUrl };
  }

  const bridge = (status: "success" | "cancel" | "expired") => {
    const url = new URL(`${SUPABASE_URL}/functions/v1/asaas-subscription-checkout`);
    url.searchParams.set("returnTo", returnUrl);
    url.searchParams.set("checkout", status);
    return url.toString();
  };
  return {
    successUrl: bridge("success"),
    cancelUrl: bridge("cancel"),
    expiredUrl: bridge("expired"),
  };
}

function redirectFromCheckout(req: Request) {
  const requestUrl = new URL(req.url);
  const targetValue = requestUrl.searchParams.get("returnTo") ?? "";
  const status = requestUrl.searchParams.get("checkout") ?? "unknown";
  try {
    const target = new URL(targetValue);
    const configuredOrigin = APP_PUBLIC_URL ? new URL(APP_PUBLIC_URL).origin : null;
    const isLocal = target.protocol === "http:" && target.hostname === "localhost";
    const isConfigured = configuredOrigin !== null && target.origin === configuredOrigin;
    if (!isLocal && !isConfigured) return json({ error: "Destino de retorno inválido" }, 400);
    target.searchParams.set("checkout", status);
    return new Response(null, { status: 302, headers: { Location: target.toString(), ...CORS } });
  } catch {
    return json({ error: "Destino de retorno inválido" }, 400);
  }
}

function asaasDateTime(date: Date) {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

async function asaasRequest(path: string, method: "GET" | "POST" | "PUT", body?: unknown) {
  const response = await fetch(`${ASAAS_BASE}${path}`, {
    method,
    headers: {
      access_token: ASAAS_API_KEY,
      "Content-Type": "application/json",
      "User-Agent": "ConnectWeb-Automations/1.0",
    },
    body: method === "GET" ? undefined : JSON.stringify(body),
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

const createCheckout = (body: unknown) => asaasRequest("/checkouts", "POST", body);

async function asaasCityFromPostalCode(postalCode: string) {
  const postalResponse = await fetch(
    `https://viacep.com.br/ws/${encodeURIComponent(postalCode)}/json/`,
    { headers: { "User-Agent": "ConnectWeb-Automations/1.0" } },
  );
  const postal = await postalResponse.json().catch(() => ({}));
  if (!postalResponse.ok || postal?.erro || !postal?.localidade) {
    throw new Error("CEP não encontrado. Confira o número informado.");
  }
  const result = await asaasRequest(
    `/cities?name=${encodeURIComponent(String(postal.localidade))}`,
    "GET",
  );
  const cities = Array.isArray(result?.data) ? result.data : [];
  const normalizedState = String(postal.uf ?? "").toUpperCase();
  const city =
    cities.find(
      (item: { name?: string; state?: string }) =>
        String(item.name ?? "").toLocaleLowerCase("pt-BR") ===
          String(postal.localidade).toLocaleLowerCase("pt-BR") &&
        (!item.state || String(item.state).toUpperCase() === normalizedState),
    ) ?? cities[0];
  const cityId = Number(city?.id);
  if (!Number.isInteger(cityId) || cityId <= 0) {
    throw new Error("Cidade do CEP não encontrada na base do Asaas.");
  }
  return cityId;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method === "GET") return redirectFromCheckout(req);
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

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
    if (input?.action === "sync") {
      const { data: current, error: currentError } = await admin
        .from("billing_subscriptions")
        .select("id,status,provider_checkout_id")
        .eq("organization_id", organizationId)
        .single();
      if (currentError || !current) throw currentError ?? new Error("Assinatura não encontrada");
      if (current.status === "active") return json({ synced: true, status: "active" });
      if (!current.provider_checkout_id) return json({ synced: false, status: current.status });
      const checkout = await asaasRequest(
        `/checkouts/${encodeURIComponent(current.provider_checkout_id)}`,
        "GET",
      );
      if (String(checkout?.status) !== "PAID") {
        return json({ synced: false, status: current.status });
      }
      const providerSubscriptionId = String(checkout?.subscription?.id ?? "");
      const { error: activateError } = await admin.rpc("activate_asaas_subscription", {
        p_checkout_id: current.provider_checkout_id,
        p_provider_subscription_id: providerSubscriptionId || null,
      });
      if (activateError) throw activateError;
      return json({ synced: true, status: "active" });
    }

    const address = String(customer.address ?? "").trim();
    const addressNumber = String(customer.addressNumber ?? "").trim();
    const postalCode = String(customer.postalCode ?? "").replace(/\D/g, "");
    const province = String(customer.province ?? "").trim();
    if (!address || !addressNumber || postalCode.length !== 8 || !province) {
      return json({ error: "Informe CEP, endereço, número e bairro para continuar" }, 400);
    }

    const { error: profileError } = await asUser.rpc("store_billing_customer_profile", {
      p_org: organizationId,
      p_legal_name: String(customer.legalName ?? ""),
      p_email: String(customer.email ?? ""),
      p_tax_id: String(customer.taxId ?? ""),
      p_phone: customer.phone ? String(customer.phone) : null,
    });
    if (profileError) return json({ error: profileError.message }, 400);

    const [{ data: product }, { data: profile }, { data: subscription }] = await Promise.all([
      admin
        .from("billing_products")
        .select("id,name,description,price_cents")
        .eq("id", "connectweb_complete")
        .single(),
      admin
        .from("billing_customer_profiles")
        .select("legal_name,email,tax_id,phone,provider,provider_customer_id")
        .eq("organization_id", organizationId)
        .single(),
      admin
        .from("billing_subscriptions")
        .select("id,status,trial_ends_at")
        .eq("organization_id", organizationId)
        .single(),
    ]);
    if (!product || !profile || !subscription)
      throw new Error("Dados da assinatura não encontrados");
    if (subscription.status === "active") return json({ error: "A assinatura já está ativa" }, 409);
    if (subscription.status === "trialing") {
      return json(
        { error: "A assinatura estará disponível quando o período gratuito terminar" },
        409,
      );
    }

    const callback = callbackUrls(req);
    const formattedPostalCode = `${postalCode.slice(0, 5)}-${postalCode.slice(5)}`;
    const city = await asaasCityFromPostalCode(postalCode);
    const customerPayload = {
      name: profile.legal_name,
      email: profile.email,
      cpfCnpj: profile.tax_id,
      mobilePhone: profile.phone || undefined,
      postalCode: formattedPostalCode,
      address,
      addressNumber,
      province,
      city,
      externalReference: organizationId,
      notificationDisabled: false,
    };
    const existingCustomerId = profile.provider === "asaas" ? profile.provider_customer_id : null;
    const asaasCustomer = existingCustomerId
      ? await asaasRequest(
          `/customers/${encodeURIComponent(existingCustomerId)}`,
          "PUT",
          customerPayload,
        )
      : await asaasRequest("/customers", "POST", customerPayload);
    const customerId = String(asaasCustomer?.id ?? existingCustomerId ?? "");
    if (!customerId) throw new Error("Asaas não devolveu o identificador do cliente");
    const { error: saveCustomerError } = await admin
      .from("billing_customer_profiles")
      .update({
        provider: "asaas",
        provider_customer_id: customerId,
        updated_at: new Date().toISOString(),
      })
      .eq("organization_id", organizationId);
    if (saveCustomerError) throw saveCustomerError;
    // O cartão é autorizado agora, mas a primeira cobrança respeita integralmente
    // o período gratuito ainda disponível para a empresa.
    const trialEnd = subscription.trial_ends_at ? new Date(subscription.trial_ends_at) : null;
    const firstChargeAt =
      trialEnd && Number.isFinite(trialEnd.getTime()) && trialEnd.getTime() > Date.now()
        ? trialEnd
        : new Date();
    const nextDueDate = asaasDateTime(firstChargeAt);
    const checkout = await createCheckout({
      billingTypes: ["CREDIT_CARD"],
      chargeTypes: ["RECURRENT"],
      minutesToExpire: 120,
      externalReference: `cw:subscription:${subscription.id}`,
      callback,
      items: [
        {
          name: product.name,
          description: product.description,
          quantity: 1,
          value: product.price_cents / 100,
        },
      ],
      customer: customerId,
      subscription: { cycle: "MONTHLY", nextDueDate },
    });
    if (!checkout?.id) throw new Error("Asaas não devolveu o identificador do checkout");
    const url =
      checkout.link ||
      `https://asaas.com/checkoutSession/show?id=${encodeURIComponent(checkout.id)}`;
    const { error: attachError } = await admin.rpc("attach_asaas_subscription_checkout", {
      p_org: organizationId,
      p_customer_id: customerId,
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
