import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const MODEL = Deno.env.get("ANTHROPIC_COPILOT_MODEL") ?? "claude-sonnet-5";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...CORS, "Content-Type": "application/json" },
});

const INTENT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    action: { type: "string", enum: ["clientes.create.batch", "none"] },
    message: { type: "string" },
    preview: { type: "string" },
    customers: {
      type: "array",
      maxItems: 20,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          firstName: { type: "string" },
          lastName: { type: ["string", "null"] },
          email: { type: ["string", "null"] },
          phone: { type: ["string", "null"] },
          status: { type: "string", enum: ["active", "inactive", "prospect", "vip"] },
          tags: { type: "array", items: { type: "string" }, maxItems: 8 },
          notes: { type: ["string", "null"] },
        },
        required: ["firstName", "status", "tags"],
      },
    },
  },
  required: ["action", "message", "preview", "customers"],
};

const SYSTEM = `Você é o Copiloto global do ConnectWeb, um CRM brasileiro.
Interprete o pedido e use interpret_request. Nesta versão, a única ação executável é clientes.create.batch.

REGRAS:
- Use clientes.create.batch somente quando o usuário pedir para cadastrar/criar clientes ou contatos.
- Extraia os contatos fornecidos. Se pedir dados fictícios, gere no máximo 20 nomes brasileiros variados, e-mails somente no domínio example.com e não invente telefone real (use null).
- Para dados fictícios, inclua a tag "Teste IA" e notes deixando claro que é demonstração.
- Status permitido: active, inactive, prospect, vip. Traduza a intenção do usuário.
- Nunca inclua organizationId, ownerId ou permissões: isso vem da sessão segura.
- preview deve resumir claramente quantidade, nomes e quais dados serão gravados.
- Se o pedido não for criação de clientes, retorne action "none", customers [] e explique que esta primeira versão cria clientes; as demais ações chegarão gradualmente.
- Não execute nada. Você só prepara uma proposta que exigirá confirmação humana.`;

function cleanCustomer(raw: Record<string, unknown>) {
  const text = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";
  const nullable = (value: unknown, max: number) => text(value, max) || null;
  const allowedStatus = new Set(["active", "inactive", "prospect", "vip"]);
  const status = text(raw.status, 20);
  return {
    firstName: text(raw.firstName, 100),
    lastName: nullable(raw.lastName, 100),
    email: nullable(raw.email, 255),
    phone: nullable(raw.phone, 30),
    status: allowedStatus.has(status) ? status : "prospect",
    tags: Array.isArray(raw.tags)
      ? raw.tags.map((tag) => text(tag, 50)).filter(Boolean).slice(0, 8)
      : [],
    notes: nullable(raw.notes, 500),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  if (!ANTHROPIC_API_KEY) return json({ error: "IA não configurada no projeto" }, 503);

  const authorization = req.headers.get("Authorization") ?? "";
  if (!authorization) return json({ error: "unauthorized" }, 401);

  let body: { prompt?: string; organizationId?: string };
  try { body = await req.json(); } catch { return json({ error: "bad json" }, 400); }
  const prompt = String(body.prompt ?? "").trim();
  const organizationId = String(body.organizationId ?? "");
  if (prompt.length < 3 || prompt.length > 4_000) return json({ error: "pedido inválido" }, 400);
  if (!organizationId) return json({ error: "organizationId obrigatório" }, 400);

  const supabase = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authorization } },
  });
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return json({ error: "unauthorized" }, 401);

  const [{ data: canUseAI, error: aiError }, { data: canWrite, error: writeError }] = await Promise.all([
    supabase.rpc("has_permission", { org: organizationId, perm: "ia.use" }),
    supabase.rpc("has_permission", { org: organizationId, perm: "clientes.write" }),
  ]);
  if (aiError || writeError) return json({ error: (aiError ?? writeError)?.message }, 500);
  if (!canUseAI || !canWrite) return json({ error: "Você não possui permissão para usar esta ação." }, 403);

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 3_000,
        thinking: { type: "disabled" },
        system: SYSTEM,
        tools: [{
          name: "interpret_request",
          description: "Prepara uma ação segura do Copiloto para confirmação humana.",
          input_schema: INTENT_SCHEMA,
        }],
        tool_choice: { type: "tool", name: "interpret_request" },
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error?.message ?? `anthropic ${response.status}`);
    const block = (data.content ?? []).find((item: { type?: string }) => item.type === "tool_use");
    if (!block?.input) throw new Error("A IA não conseguiu interpretar o pedido.");

    const credits = Math.max(1, Number(data.usage?.input_tokens ?? 0) + Number(data.usage?.output_tokens ?? 0));
    const { data: consumed, error: quotaError } = await supabase.rpc("try_consume_quota", {
      p_org: organizationId,
      p_resource: "ai_credits",
      p_amount: credits,
    });
    if (quotaError) return json({ error: quotaError.message }, 500);
    if (!consumed) return json({ error: "Seu limite de IA foi atingido." }, 429);

    const input = block.input as Record<string, unknown>;
    const action = input.action === "clientes.create.batch" ? input.action : "none";
    const customers = action === "clientes.create.batch" && Array.isArray(input.customers)
      ? input.customers.map((item: Record<string, unknown>) => cleanCustomer(item)).filter((item) => item.firstName).slice(0, 20)
      : [];
    return json({
      action: customers.length ? action : "none",
      message: String(input.message ?? "Pedido interpretado."),
      preview: String(input.preview ?? ""),
      input: { customers },
    });
  } catch (error) {
    console.error("[ai-copilot-intent]", error);
    return json({ error: String((error as Error)?.message ?? error) }, 502);
  }
});
