import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
// Relatórios são uma tarefa curta e estruturada: Haiku reduz o custo por lojista.
const MODEL = Deno.env.get("ANTHROPIC_REPORTS_MODEL") ?? "claude-haiku-4-5";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...CORS, "Content-Type": "application/json" },
});

const ANSWER_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    answer: { type: "string" },
    highlights: { type: "array", items: { type: "string" }, maxItems: 4 },
  },
  required: ["answer", "highlights"],
};

const SYSTEM = `Você é o analista de dados do ConnectWeb. Responda em português simples para um lojista.
Use SOMENTE o JSON de métricas fornecido. Nunca invente vendas, percentuais, períodos, causas ou comparações.
revenueTotal e avgTicket estão em centavos de real. revenueTrend contém receita mensal dos últimos 12 meses.
O total de receita representa negócios marcados como ganhos no CRM, não extrato bancário.
Se a pergunta exigir dado ausente, diga claramente que esse indicador ainda não está disponível.
Seja direto: resposta em até 5 frases e no máximo 4 destaques curtos.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  if (!ANTHROPIC_API_KEY) return json({ error: "IA não configurada no projeto" }, 503);

  const authorization = req.headers.get("Authorization") ?? "";
  if (!authorization) return json({ error: "unauthorized" }, 401);
  let body: { question?: string; organizationId?: string };
  try { body = await req.json(); } catch { return json({ error: "bad json" }, 400); }
  const question = String(body.question ?? "").trim();
  const organizationId = String(body.organizationId ?? "");
  if (question.length < 3 || question.length > 1_000) return json({ error: "pergunta inválida" }, 400);
  if (!organizationId) return json({ error: "organizationId obrigatório" }, 400);

  const supabase = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authorization } },
  });
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return json({ error: "unauthorized" }, 401);
  const [{ data: canRead, error: readError }, { data: canUseAI, error: aiError }] = await Promise.all([
    supabase.rpc("has_permission", { org: organizationId, perm: "relatorios.read" }),
    supabase.rpc("has_permission", { org: organizationId, perm: "ia.use" }),
  ]);
  if (readError || aiError) return json({ error: (readError ?? aiError)?.message }, 500);
  if (!canRead || !canUseAI) return json({ error: "Você não possui permissão para esta análise." }, 403);

  const { data: metrics, error: metricsError } = await supabase.rpc("reports_metrics", { p_org: organizationId });
  if (metricsError) return json({ error: metricsError.message }, 500);

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
        max_tokens: 700,
        thinking: { type: "disabled" },
        system: SYSTEM,
        tools: [{
          name: "answer_report",
          description: "Responde à pergunta usando exclusivamente as métricas fornecidas.",
          input_schema: ANSWER_SCHEMA,
        }],
        tool_choice: { type: "tool", name: "answer_report" },
        messages: [{
          role: "user",
          content: `PERGUNTA:\n${question}\n\nMÉTRICAS REAIS:\n${JSON.stringify(metrics ?? {})}`,
        }],
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error?.message ?? `anthropic ${response.status}`);
    const block = (data.content ?? []).find((item: { type?: string }) => item.type === "tool_use");
    if (!block?.input) throw new Error("A IA não conseguiu responder agora.");

    const credits = Math.max(1, Number(data.usage?.input_tokens ?? 0) + Number(data.usage?.output_tokens ?? 0));
    const { data: consumed, error: quotaError } = await supabase.rpc("try_consume_quota", {
      p_org: organizationId,
      p_resource: "ai_credits",
      p_amount: credits,
    });
    if (quotaError) return json({ error: quotaError.message }, 500);
    if (!consumed) return json({ error: "Seu limite de IA foi atingido." }, 429);

    const result = block.input as { answer?: unknown; highlights?: unknown };
    return json({
      answer: String(result.answer ?? "Não foi possível concluir a análise.").slice(0, 2_000),
      highlights: Array.isArray(result.highlights)
        ? result.highlights.map((item) => String(item).slice(0, 200)).slice(0, 4)
        : [],
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[ai-reports-answer]", error);
    return json({ error: String((error as Error)?.message ?? error) }, 502);
  }
});
