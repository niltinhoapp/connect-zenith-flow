// Edge Function: ai-generate-flow  (AI Automation Copilot)
// Recebe uma descrição em linguagem natural e devolve um GRAFO de automação
// gerado pela IA (Claude Opus 5), para revisão humana no builder.
//
// Segurança:
//   - Exige JWT do usuário; valida RBAC (automacoes.manage) na org informada.
//   - A chave da IA é um secret do projeto — NUNCA vai para o frontend.
//   - A saída da IA é NÃO-CONFIÁVEL: o cliente ainda normaliza/sanitiza o grafo
//     (src/features/automacoes/domain/ai-flow.ts) antes de qualquer uso, e o
//     save real passa por RBAC/RLS. Aqui só geramos um rascunho.
//
// Deploy:  supabase functions deploy ai-generate-flow
// Secret:  supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//   (SUPABASE_URL / SUPABASE_ANON_KEY são injetados automaticamente.)
//
// Chamada externa via fetch (Anthropic Messages API) — mesma abordagem dos
// outros edge functions do projeto, robusta e independente de versão de SDK.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

// ── Catálogo permitido (espelho de domain/ai-flow.ts) ────────────────────────
const TRIGGERS = ["lead.created","lead.converted","customer.created","deal.created","deal.stage.changed","deal.won","whatsapp.message.received","whatsapp.message.sent","manual","scheduled"];
const NODE_TYPES = ["trigger","condition","delay","action","branch"];

const FLOW_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    name: { type: "string" },
    description: { type: "string" },
    trigger_type: { type: "string", enum: TRIGGERS },
    nodes: {
      type: "array",
      items: {
        type: "object", additionalProperties: true,
        properties: {
          node_key: { type: "string" },
          type: { type: "string", enum: NODE_TYPES },
          config: { type: "object", additionalProperties: true },
        },
        required: ["node_key", "type", "config"],
      },
    },
    edges: {
      type: "array",
      items: {
        type: "object", additionalProperties: false,
        properties: {
          from_node: { type: "string" },
          to_node: { type: "string" },
          branch: { type: "string", enum: ["yes", "no", "none"] },
        },
        required: ["from_node", "to_node"],
      },
    },
  },
  required: ["name", "trigger_type", "nodes", "edges"],
};

const SYSTEM = `Você é um projetista de automações do ConnectWeb. A pessoa descreve, em português, um fluxo de automação de CRM/WhatsApp e você produz um GRAFO válido usando a ferramenta build_flow.
Regras: sempre exatamente 1 nó "trigger" (config.trigger_type entre os permitidos); condition/branch usam {field, op, value, valueType} e ligam-se por arestas branch "yes"/"no"; delay usa {amount, unit}; action usa {action, ...parâmetros} com {{campo}} para valores do gatilho (ex.: {{conversationId}}, {{customerId}}); conecte os nós a partir do trigger; use APENAS gatilhos/ações/operadores permitidos; seja conciso.`;

async function generateFlow(description: string): Promise<unknown> {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-opus-5",
      max_tokens: 16000,
      // Extração estruturada: força a ferramenta e desliga thinking (permitido em
      // effort ≤ high) para uma resposta determinística em tool_use.
      thinking: { type: "disabled" },
      system: SYSTEM,
      tools: [{
        name: "build_flow",
        description: "Registra o grafo de automação projetado.",
        input_schema: FLOW_SCHEMA,
        strict: true,
      }],
      tool_choice: { type: "tool", name: "build_flow" },
      messages: [{ role: "user", content: `Descreva como automação (use build_flow): ${description.trim()}` }],
    }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.error?.message ?? `anthropic ${r.status}`);
  const block = (data.content ?? []).find((b: { type?: string }) => b.type === "tool_use");
  if (!block) throw new Error("IA não retornou um grafo");
  return block.input;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader) return json({ error: "unauthorized" }, 401);
  if (!ANTHROPIC_API_KEY) return json({ error: "ANTHROPIC_API_KEY não configurada no projeto" }, 503);

  let body: { description?: string; organizationId?: string };
  try { body = await req.json(); } catch { return json({ error: "bad json" }, 400); }
  const description = String(body.description ?? "").trim();
  const org = String(body.organizationId ?? "");
  if (description.length < 4) return json({ error: "descrição muito curta" }, 400);
  if (!org) return json({ error: "organizationId obrigatório" }, 400);

  // RBAC: valida como o usuário (RLS aplica auth.uid()).
  const supabase = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return json({ error: "unauthorized" }, 401);
  const { data: allowed, error: permErr } = await supabase.rpc("has_permission", { org, perm: "automacoes.manage" });
  if (permErr) return json({ error: permErr.message }, 500);
  if (!allowed) return json({ error: "forbidden" }, 403);

  try {
    const flow = await generateFlow(description);
    return json({ flow });
  } catch (e) {
    console.error("[ai-generate-flow]", e);
    return json({ error: String((e as Error)?.message ?? e) }, 502);
  }
});
