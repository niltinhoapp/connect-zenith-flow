/**
 * Motor de automações — interpretador puro do grafo de fluxo.
 *
 * Sem efeitos colaterais: recebe o grafo (nós/arestas) + o contexto do gatilho
 * e produz um "plano" — a sequência de ações a executar até o próximo ponto de
 * espera (delay) ou o fim. Condições/ramificações são resolvidas aqui; as ações
 * são apenas descritas (o worker as executa via Providers/RPCs). 100% testável.
 */

export type NodeType = "trigger" | "condition" | "delay" | "action" | "branch";

export interface FlowNode {
  node_key: string;
  type: NodeType;
  config: Record<string, unknown>;
}
export interface FlowEdge {
  from_node: string;
  to_node: string;
  branch?: "yes" | "no" | null;
}
export interface FlowGraph {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

export type FlowContext = Record<string, unknown>;

/** Operadores suportados por condições/ramificações. */
export type CompareOp =
  | "eq" | "ne" | "gt" | "gte" | "lt" | "lte"
  | "contains" | "not_contains" | "starts_with"
  | "in" | "exists" | "not_exists";

export type ValueType = "text" | "number" | "date" | "boolean";

export interface ConditionConfig {
  field: string; // caminho no contexto, ex.: "deal.value", "customer.tags"
  op: CompareOp;
  value?: unknown;
  valueType?: ValueType;
}

/** Passo do plano (para log por etapa e execução). */
export type PlanStep =
  | { node: string; type: "condition" | "branch"; result: boolean }
  | { node: string; type: "action"; action: string; config: Record<string, unknown> };

export interface Plan {
  steps: PlanStep[];
  /** Se definido, o fluxo pausa: reagendar no nó `node` após `ms`. */
  wait?: { node: string; ms: number };
  /** Fluxo chegou ao fim (sem próximo nó). */
  done: boolean;
}

const MAX_STEPS = 200; // proteção contra ciclos

// ── Acesso ao grafo ──────────────────────────────────────────────────────────
export function getNode(graph: FlowGraph, key: string): FlowNode | undefined {
  return graph.nodes.find((n) => n.node_key === key);
}

/** Nó de entrada: o trigger (ou o primeiro nó sem aresta de entrada). */
export function entryNode(graph: FlowGraph): FlowNode | undefined {
  const trigger = graph.nodes.find((n) => n.type === "trigger");
  if (trigger) return trigger;
  const targets = new Set(graph.edges.map((e) => e.to_node));
  return graph.nodes.find((n) => !targets.has(n.node_key));
}

/**
 * Próximo nó a partir de `from`. Para condition/branch usa a aresta cujo
 * `branch` casa com o resultado; se não houver aresta rotulada, cai na linear.
 */
export function resolveNext(graph: FlowGraph, from: string, branch?: boolean): string | null {
  const out = graph.edges.filter((e) => e.from_node === from);
  if (out.length === 0) return null;
  if (branch !== undefined) {
    const want = branch ? "yes" : "no";
    const labeled = out.find((e) => e.branch === want);
    if (labeled) return labeled.to_node;
    // sem aresta rotulada: só segue se for o ramo "sim"
    const linear = out.find((e) => !e.branch);
    return branch && linear ? linear.to_node : null;
  }
  const linear = out.find((e) => !e.branch) ?? out[0];
  return linear.to_node;
}

// ── Avaliação de condições ──────────────────────────────────────────────────
/** Resolve um caminho por ponto no contexto: "deal.value" → ctx.deal.value. */
export function resolveField(ctx: FlowContext, path: string): unknown {
  if (!path) return undefined;
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[key];
    return undefined;
  }, ctx);
}

function coerce(v: unknown, type?: ValueType): unknown {
  if (v === null || v === undefined) return v;
  switch (type) {
    case "number": return typeof v === "number" ? v : Number(v);
    case "boolean": return typeof v === "boolean" ? v : v === "true" || v === true || v === 1;
    case "date": {
      const t = v instanceof Date ? v.getTime() : Date.parse(String(v));
      return Number.isNaN(t) ? NaN : t;
    }
    default: return typeof v === "string" ? v : String(v);
  }
}

export function evalCondition(config: ConditionConfig, ctx: FlowContext): boolean {
  const raw = resolveField(ctx, config.field);
  const { op, valueType } = config;

  if (op === "exists") return raw !== undefined && raw !== null && raw !== "";
  if (op === "not_exists") return raw === undefined || raw === null || raw === "";

  if (op === "in") {
    const list = Array.isArray(config.value) ? config.value : [config.value];
    return list.some((item) => coerce(raw, valueType) === coerce(item, valueType));
  }

  // "contains" aceita tanto array (tag em lista) quanto substring de texto.
  if (op === "contains" || op === "not_contains") {
    const needle = coerce(config.value, valueType ?? "text");
    let hit: boolean;
    if (Array.isArray(raw)) hit = raw.map((x) => coerce(x, valueType ?? "text")).includes(needle);
    else hit = String(raw ?? "").includes(String(needle ?? ""));
    return op === "contains" ? hit : !hit;
  }
  if (op === "starts_with") return String(raw ?? "").startsWith(String(config.value ?? ""));

  const left = coerce(raw, valueType);
  const right = coerce(config.value, valueType);
  switch (op) {
    case "eq": return left === right;
    case "ne": return left !== right;
    case "gt": return (left as number) > (right as number);
    case "gte": return (left as number) >= (right as number);
    case "lt": return (left as number) < (right as number);
    case "lte": return (left as number) <= (right as number);
    default: return false;
  }
}

// ── Delay ────────────────────────────────────────────────────────────────────
const UNIT_MS: Record<string, number> = {
  seconds: 1000, minutes: 60_000, hours: 3_600_000, days: 86_400_000,
};
/** Duração de um nó delay em ms. config: { amount, unit } ou { ms }. */
export function delayMs(config: Record<string, unknown>): number {
  if (typeof config.ms === "number") return Math.max(0, config.ms);
  const amount = Number(config.amount ?? 0);
  const unit = String(config.unit ?? "minutes");
  return Math.max(0, amount * (UNIT_MS[unit] ?? 60_000));
}

// ── Planejamento ─────────────────────────────────────────────────────────────
/**
 * Caminha o grafo a partir de `startKey` (inclusive) resolvendo condições e
 * coletando ações, até encontrar um delay (pausa) ou o fim. Puro e determinístico.
 * Se `startKey` for undefined, começa no sucessor do nó de entrada (trigger).
 */
export function planFrom(graph: FlowGraph, startKey: string | null | undefined, ctx: FlowContext): Plan {
  const steps: PlanStep[] = [];
  let cur: string | null;

  if (!startKey) {
    const entry = entryNode(graph);
    cur = entry ? resolveNext(graph, entry.node_key) : null;
  } else {
    cur = startKey;
  }

  for (let i = 0; i < MAX_STEPS && cur; i++) {
    const node = getNode(graph, cur);
    if (!node) return { steps, done: true };

    if (node.type === "condition" || node.type === "branch") {
      const result = evalCondition(node.config as unknown as ConditionConfig, ctx);
      steps.push({ node: node.node_key, type: node.type, result });
      cur = resolveNext(graph, node.node_key, result);
      continue;
    }
    if (node.type === "delay") {
      const next = resolveNext(graph, node.node_key);
      if (!next) return { steps, done: true };
      return { steps, wait: { node: next, ms: delayMs(node.config) }, done: false };
    }
    if (node.type === "action") {
      steps.push({
        node: node.node_key,
        type: "action",
        action: String(node.config.action ?? ""),
        config: node.config,
      });
      cur = resolveNext(graph, node.node_key);
      continue;
    }
    // trigger no meio (defensivo): apenas segue
    cur = resolveNext(graph, node.node_key);
  }

  return { steps, done: cur === null };
}
