import { describe, it, expect } from "vitest";
import { normalizeAiFlow, type AiRawFlow } from "./domain/ai-flow";

describe("ai-flow · normalizeAiFlow (camada de segurança)", () => {
  it("normaliza um fluxo válido preservando trigger/ação/ramificação", () => {
    const raw: AiRawFlow = {
      name: "Boas-vindas",
      description: "responde novos leads",
      trigger_type: "lead.created",
      nodes: [
        { node_key: "t", type: "trigger", config: { trigger_type: "lead.created" } },
        { node_key: "c", type: "condition", config: { field: "lead.origem", op: "eq", value: "site", valueType: "text" } },
        { node_key: "a", type: "action", config: { action: "whatsapp.send", conversation_id: "{{conversationId}}", body: "Olá!" } },
      ],
      edges: [
        { from_node: "t", to_node: "c" },
        { from_node: "c", to_node: "a", branch: "yes" },
      ],
    };
    const out = normalizeAiFlow(raw);
    expect(out.name).toBe("Boas-vindas");
    expect(out.triggerType).toBe("lead.created");
    expect(out.graph.nodes).toHaveLength(3);
    const action = out.graph.nodes.find((n) => n.type === "action")!;
    expect(action.config.action).toBe("whatsapp.send");
    expect(action.config.body).toBe("Olá!");
    expect(action.config.conversation_id).toBe("{{conversationId}}"); // interpolação preservada
    const yes = out.graph.edges.find((e) => e.from_node === "c");
    expect(yes?.branch).toBe("yes");
    // posições atribuídas
    expect(typeof (out.graph.nodes[0].position as Record<string, number>).x).toBe("number");
  });

  it("descarta tipos de nó desconhecidos", () => {
    const out = normalizeAiFlow({
      trigger_type: "manual",
      nodes: [
        { node_key: "t", type: "trigger", config: { trigger_type: "manual" } },
        { node_key: "x", type: "ia_magica", config: {} },
      ],
      edges: [{ from_node: "t", to_node: "x" }],
    });
    expect(out.graph.nodes.map((n) => n.type)).toEqual(["trigger"]);
    expect(out.graph.edges).toHaveLength(0); // aresta órfã removida
  });

  it("ação desconhecida vira 'wait'; operador inválido vira 'eq'", () => {
    const out = normalizeAiFlow({
      trigger_type: "manual",
      nodes: [
        { node_key: "t", type: "trigger", config: { trigger_type: "manual" } },
        { node_key: "a", type: "action", config: { action: "enviar_foguete" } },
        { node_key: "c", type: "condition", config: { field: "x", op: "explode", value: 1, valueType: "number" } },
      ],
      edges: [],
    });
    expect(out.graph.nodes.find((n) => n.type === "action")!.config.action).toBe("wait");
    expect(out.graph.nodes.find((n) => n.type === "condition")!.config.op).toBe("eq");
  });

  it("sem gatilho → adiciona um 'manual'", () => {
    const out = normalizeAiFlow({
      nodes: [{ node_key: "a", type: "action", config: { action: "wait" } }],
      edges: [],
    });
    const triggers = out.graph.nodes.filter((n) => n.type === "trigger");
    expect(triggers).toHaveLength(1);
    expect(out.triggerType).toBe("manual");
  });

  it("múltiplos gatilhos → mantém só um", () => {
    const out = normalizeAiFlow({
      nodes: [
        { node_key: "t1", type: "trigger", config: { trigger_type: "deal.won" } },
        { node_key: "t2", type: "trigger", config: { trigger_type: "lead.created" } },
      ],
      edges: [],
    });
    expect(out.graph.nodes.filter((n) => n.type === "trigger")).toHaveLength(1);
    expect(out.triggerType).toBe("deal.won"); // o primeiro
  });

  it("remove auto-loop, duplicatas e arestas órfãs; valida branch", () => {
    const out = normalizeAiFlow({
      trigger_type: "manual",
      nodes: [
        { node_key: "t", type: "trigger", config: { trigger_type: "manual" } },
        { node_key: "a", type: "action", config: { action: "wait" } },
      ],
      edges: [
        { from_node: "t", to_node: "a", branch: "talvez" }, // branch inválido → null
        { from_node: "t", to_node: "a" },                    // duplicata
        { from_node: "a", to_node: "a" },                    // auto-loop
        { from_node: "t", to_node: "fantasma" },             // órfã
      ],
    });
    expect(out.graph.edges).toHaveLength(1);
    expect(out.graph.edges[0]).toMatchObject({ from_node: "t", to_node: "a", branch: null });
  });

  it("node_keys duplicados são desambiguados", () => {
    const out = normalizeAiFlow({
      trigger_type: "manual",
      nodes: [
        { node_key: "n", type: "trigger", config: { trigger_type: "manual" } },
        { node_key: "n", type: "action", config: { action: "wait" } },
      ],
      edges: [],
    });
    const keys = out.graph.nodes.map((n) => n.node_key);
    expect(new Set(keys).size).toBe(keys.length); // todos únicos
  });

  it("canoniza aliases de parâmetros (camelCase/sinônimos → snake_case do executor)", () => {
    const out = normalizeAiFlow({
      trigger_type: "customer.created",
      nodes: [
        { node_key: "t", type: "trigger", config: { trigger_type: "customer.created" } },
        { node_key: "tag", type: "action", config: { action: "customer.add_tag", customerId: "{{customerId}}", tag: "vip" } },
        { node_key: "note", type: "action", config: { action: "crm.create_note", customerId: "{{customerId}}", content: "Origem: automação" } },
      ],
      edges: [{ from_node: "t", to_node: "tag" }, { from_node: "tag", to_node: "note" }],
    });
    const tag = out.graph.nodes.find((n) => n.node_key === "tag")!;
    expect(tag.config.customer_id).toBe("{{customerId}}"); // customerId → customer_id
    expect(tag.config.customerId).toBeUndefined();
    const note = out.graph.nodes.find((n) => n.node_key === "note")!;
    expect(note.config.body).toBe("Origem: automação"); // content → body
    expect(note.config.customer_id).toBe("{{customerId}}");
  });

  it("aplica defaults de nome/descrição em entrada vazia", () => {
    const out = normalizeAiFlow({});
    expect(out.name).toBe("Automação gerada por IA");
    expect(out.description).toBeNull();
    expect(out.graph.nodes.filter((n) => n.type === "trigger")).toHaveLength(1);
  });
});
