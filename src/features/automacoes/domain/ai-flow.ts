/**
 * AI Automation Copilot — contrato + normalizador do fluxo gerado por IA.
 *
 * A IA (Claude) devolve um grafo estruturado; ESTE módulo é a camada de
 * segurança: a saída do LLM é NÃO-CONFIÁVEL, então validamos/sanitizamos contra
 * o catálogo conhecido do motor (gatilhos/ações/operadores) antes de qualquer
 * uso. Nós desconhecidos são descartados; arestas órfãs, removidas; sempre há
 * exatamente um gatilho. Puro e 100% testável (sem chamada de API aqui).
 *
 * O fluxo normalizado é apenas CARREGADO no builder para revisão humana — nada
 * é ativado automaticamente; o save real passa por RBAC/RLS (automation_save).
 */
import type { FlowEdge, FlowNode, NodeType } from "./engine";
import type { FlowGraphInput } from "../application/automacao-application-service";

// ── Catálogo (autoridade para validação da IA) ───────────────────────────────
export const AI_TRIGGERS = [
  "lead.created", "lead.converted", "customer.created", "deal.created",
  "deal.stage.changed", "deal.won", "whatsapp.message.received",
  "whatsapp.message.sent", "manual", "scheduled",
] as const;

export const AI_ACTIONS = [
  "whatsapp.send", "whatsapp.send_template", "whatsapp.set_status",
  "conversation.assign", "conversation.add_tags", "customer.create",
  "customer.update", "customer.add_tag", "customer.remove_tag",
  "deal.create", "deal.move_stage", "deal.won", "crm.create_note",
  "webhook.call", "wait",
] as const;

export const AI_OPS = [
  "eq", "ne", "gt", "gte", "lt", "lte", "contains", "not_contains",
  "starts_with", "in", "exists", "not_exists",
] as const;
export const AI_VALUE_TYPES = ["text", "number", "date", "boolean"] as const;
export const AI_UNITS = ["seconds", "minutes", "hours", "days"] as const;
export const AI_NODE_TYPES: NodeType[] = ["trigger", "condition", "delay", "action", "branch"];

// ── Contrato bruto (o que a IA devolve) ──────────────────────────────────────
export interface AiRawNode {
  node_key?: unknown;
  type?: unknown;
  config?: unknown;
}
export interface AiRawEdge {
  from_node?: unknown;
  to_node?: unknown;
  branch?: unknown;
}
export interface AiRawFlow {
  name?: unknown;
  description?: unknown;
  trigger_type?: unknown;
  nodes?: unknown;
  edges?: unknown;
}

export interface NormalizedFlow {
  name: string;
  description: string | null;
  triggerType: string;
  graph: FlowGraphInput;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const str = (v: unknown): string => (typeof v === "string" ? v : "");
const asObj = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const asArr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const inList = <T extends readonly string[]>(list: T, v: string): v is T[number] =>
  (list as readonly string[]).includes(v);

// Aliases de parâmetros que a IA costuma gerar → nomes que o executor lê.
const PARAM_ALIAS: Record<string, string> = {
  customerId: "customer_id",
  conversationId: "conversation_id",
  dealId: "deal_id",
  assigneeId: "assignee_id",
  templateId: "template_id",
  pipelineId: "pipeline_id",
  stageId: "stage_id",
  content: "body",
  text: "body",
  message: "body",
};

/** Sanitiza o config de um nó por tipo, mantendo só campos conhecidos. */
function sanitizeConfig(type: NodeType, raw: Record<string, unknown>): Record<string, unknown> {
  if (type === "condition" || type === "branch") {
    const op = str(raw.op);
    const vt = str(raw.valueType);
    return {
      field: str(raw.field),
      op: inList(AI_OPS, op) ? op : "eq",
      value: typeof raw.value === "string" || typeof raw.value === "number" || typeof raw.value === "boolean" ? raw.value : "",
      valueType: inList(AI_VALUE_TYPES, vt) ? vt : "text",
    };
  }
  if (type === "delay") {
    const unit = str(raw.unit);
    const amount = Number(raw.amount);
    return {
      amount: Number.isFinite(amount) && amount > 0 ? amount : 1,
      unit: inList(AI_UNITS, unit) ? unit : "minutes",
    };
  }
  if (type === "action") {
    // A IA às vezes nomeia o campo da ação como action_type/type/name.
    const action = str(raw.action) || str(raw.action_type) || str(raw.type) || str(raw.name);
    const safeAction = inList(AI_ACTIONS, action) ? action : "wait";
    const out: Record<string, unknown> = { action: safeAction };
    // Copia parâmetros escalares, canonizando aliases comuns da IA (camelCase e
    // sinônimos) para os nomes que o executor `automation_action` lê (snake_case).
    for (const [k0, v] of Object.entries(raw)) {
      if (k0 === "action" || k0 === "action_type" || k0 === "type" || k0 === "name") continue;
      if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
        out[PARAM_ALIAS[k0] ?? k0] = v;
      }
    }
    return out;
  }
  if (type === "trigger") {
    const t = str(raw.trigger_type);
    return inList(AI_TRIGGERS, t) ? { trigger_type: t } : {};
  }
  return {};
}

// Layout por profundidade (mesma ideia do builder) para posições legíveis.
function layout(nodes: FlowNode[], edges: FlowEdge[]): Array<FlowNode & { position: Record<string, number> }> {
  const depth = new Map<string, number>();
  const entry = nodes.find((n) => n.type === "trigger")?.node_key
    ?? nodes.find((n) => !edges.some((e) => e.to_node === n.node_key))?.node_key;
  if (entry) {
    const q = [entry]; depth.set(entry, 0);
    while (q.length) {
      const cur = q.shift()!;
      for (const e of edges.filter((x) => x.from_node === cur))
        if (!depth.has(e.to_node)) { depth.set(e.to_node, (depth.get(cur) ?? 0) + 1); q.push(e.to_node); }
    }
  }
  const rowByCol = new Map<number, number>();
  return nodes.map((n, i) => {
    const col = depth.get(n.node_key) ?? i;
    const row = rowByCol.get(col) ?? 0; rowByCol.set(col, row + 1);
    return { ...n, position: { x: 80 + col * 300, y: 80 + row * 140 } };
  });
}

/**
 * Valida e sanitiza o fluxo bruto da IA num FlowGraphInput seguro.
 * Garante: node_keys únicos, tipos/ações/operadores conhecidos, exatamente um
 * gatilho, arestas apenas entre nós existentes, sem auto-loop e sem duplicatas.
 */
export function normalizeAiFlow(raw: AiRawFlow): NormalizedFlow {
  const name = str(raw.name).trim() || "Automação gerada por IA";
  const description = str(raw.description).trim() || null;

  // 1) Nós: tipos válidos + node_keys únicos.
  const seen = new Set<string>();
  const nodes: FlowNode[] = [];
  for (const rn of asArr(raw.nodes)) {
    const o = asObj(rn);
    const type = str(o.type) as NodeType;
    if (!AI_NODE_TYPES.includes(type)) continue;
    let key = str(o.node_key).trim() || `${type}_${nodes.length}`;
    while (seen.has(key)) key = `${key}_${nodes.length}`;
    seen.add(key);
    nodes.push({ node_key: key, type, config: sanitizeConfig(type, asObj(o.config)) });
  }

  // 2) Exatamente um gatilho. Deriva trigger_type do config OU do topo.
  let triggerType = str(raw.trigger_type);
  const triggers = nodes.filter((n) => n.type === "trigger");
  if (triggers.length === 0) {
    if (!inList(AI_TRIGGERS, triggerType)) triggerType = "manual";
    nodes.unshift({ node_key: "trigger_0", type: "trigger", config: { trigger_type: triggerType } });
  } else {
    // mantém o primeiro; rebaixa os demais para não-executáveis (removidos)
    const first = triggers[0];
    const cfgTrigger = str((first.config as Record<string, unknown>).trigger_type);
    triggerType = inList(AI_TRIGGERS, cfgTrigger) ? cfgTrigger
      : inList(AI_TRIGGERS, triggerType) ? triggerType : "manual";
    (first.config as Record<string, unknown>).trigger_type = triggerType;
    for (const extra of triggers.slice(1)) {
      const idx = nodes.indexOf(extra);
      if (idx >= 0) nodes.splice(idx, 1);
    }
  }
  const keys = new Set(nodes.map((n) => n.node_key));

  // 3) Arestas: só entre nós existentes, sem auto-loop, sem duplicata; branch válido.
  const edges: FlowEdge[] = [];
  const edgeSeen = new Set<string>();
  for (const re of asArr(raw.edges)) {
    const o = asObj(re);
    const from = str(o.from_node), to = str(o.to_node);
    if (!keys.has(from) || !keys.has(to) || from === to) continue;
    const id = `${from}->${to}`;
    if (edgeSeen.has(id)) continue;
    edgeSeen.add(id);
    const b = str(o.branch);
    const branch = b === "yes" || b === "no" ? (b as "yes" | "no") : null;
    edges.push({ from_node: from, to_node: to, branch });
  }

  const positioned = layout(nodes, edges);
  return {
    name,
    description,
    triggerType,
    graph: {
      nodes: positioned.map((n) => ({ node_key: n.node_key, type: n.type, config: n.config, position: n.position })),
      edges,
    },
  };
}

// ── Schema JSON para a IA (strict tool use garante a forma) ──────────────────
export const AI_FLOW_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    name: { type: "string", description: "Nome curto do fluxo" },
    description: { type: "string", description: "Descrição de uma linha" },
    trigger_type: { type: "string", enum: [...AI_TRIGGERS] },
    nodes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: true,
        properties: {
          node_key: { type: "string" },
          type: { type: "string", enum: [...AI_NODE_TYPES] },
          config: { type: "object", additionalProperties: true },
        },
        required: ["node_key", "type", "config"],
      },
    },
    edges: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
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
} as const;

/** System prompt para a geração de fluxos (usado pela Edge Function). */
export const AI_SYSTEM_PROMPT = `Você é um projetista de automações do ConnectWeb. A pessoa descreve, em português, um fluxo de automação de CRM/WhatsApp e você produz um GRAFO de automação válido.

Regras:
- Sempre exatamente 1 nó do tipo "trigger". Seu config.trigger_type deve ser um dos gatilhos permitidos.
- Nós do tipo "condition"/"branch" usam config {field, op, value, valueType}. Ligue-os com arestas branch "yes" e "no".
- Nós "delay" usam config {amount, unit}.
- Nós "action" usam config {action, ...parâmetros}. Use {{campo}} para valores vindos do gatilho (ex.: {{conversationId}}, {{customerId}}).
- Conecte os nós com arestas (from_node → to_node). O grafo deve fluir a partir do trigger.
- Use APENAS os gatilhos, ações e operadores permitidos (definidos no schema). Se algo não for possível, aproxime com o mais próximo permitido.
- Seja conciso e prático. Não invente ações fora da lista.`;

/** Monta o prompt do usuário (a descrição em linguagem natural). */
export function buildUserPrompt(description: string): string {
  return `Descreva como automação (gere o grafo com a ferramenta): ${description.trim()}`;
}
