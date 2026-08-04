import { describe, it, expect } from "vitest";
import {
  entryNode, resolveNext, resolveField, evalCondition, delayMs, planFrom,
  type FlowGraph, type ConditionConfig,
} from "./domain/engine";

// Grafo: trigger → cond(deal.value >= 1000) → [sim] action A / [não] action B
const branchingGraph: FlowGraph = {
  nodes: [
    { node_key: "t", type: "trigger", config: {} },
    { node_key: "c", type: "condition", config: { field: "deal.value", op: "gte", value: 1000, valueType: "number" } },
    { node_key: "a", type: "action", config: { action: "whatsapp.send", to: "x" } },
    { node_key: "b", type: "action", config: { action: "crm.add_tag", tag: "frio" } },
  ],
  edges: [
    { from_node: "t", to_node: "c" },
    { from_node: "c", to_node: "a", branch: "yes" },
    { from_node: "c", to_node: "b", branch: "no" },
  ],
};

describe("engine · grafo", () => {
  it("entryNode acha o trigger", () => {
    expect(entryNode(branchingGraph)?.node_key).toBe("t");
  });
  it("resolveNext linear e ramificado", () => {
    expect(resolveNext(branchingGraph, "t")).toBe("c");
    expect(resolveNext(branchingGraph, "c", true)).toBe("a");
    expect(resolveNext(branchingGraph, "c", false)).toBe("b");
    expect(resolveNext(branchingGraph, "a")).toBeNull();
  });
});

describe("engine · resolveField", () => {
  it("resolve caminho por ponto", () => {
    const ctx = { deal: { value: 2500, stage: "won" }, customer: { tags: ["vip"] } };
    expect(resolveField(ctx, "deal.value")).toBe(2500);
    expect(resolveField(ctx, "customer.tags")).toEqual(["vip"]);
    expect(resolveField(ctx, "deal.missing")).toBeUndefined();
    expect(resolveField(ctx, "x.y.z")).toBeUndefined();
  });
});

describe("engine · evalCondition", () => {
  const ctx = {
    deal: { value: 2500, stage: "negotiation" },
    customer: { origem: "site", tags: ["vip", "novo"], ativo: true },
    msg: { body: "Quero um orçamento" },
  };
  const c = (config: ConditionConfig) => evalCondition(config, ctx);

  it("número: gte/lt", () => {
    expect(c({ field: "deal.value", op: "gte", value: 1000, valueType: "number" })).toBe(true);
    expect(c({ field: "deal.value", op: "lt", value: 1000, valueType: "number" })).toBe(false);
  });
  it("texto: eq/contains/starts_with", () => {
    expect(c({ field: "deal.stage", op: "eq", value: "negotiation", valueType: "text" })).toBe(true);
    expect(c({ field: "msg.body", op: "contains", value: "orçamento", valueType: "text" })).toBe(true);
    expect(c({ field: "msg.body", op: "starts_with", value: "Quero" })).toBe(true);
  });
  it("tag em lista (contains sobre array)", () => {
    expect(c({ field: "customer.tags", op: "contains", value: "vip" })).toBe(true);
    expect(c({ field: "customer.tags", op: "not_contains", value: "frio" })).toBe(true);
  });
  it("origem: in", () => {
    expect(c({ field: "customer.origem", op: "in", value: ["site", "indicacao"] })).toBe(true);
    expect(c({ field: "customer.origem", op: "in", value: ["ads"] })).toBe(false);
  });
  it("booleano e exists", () => {
    expect(c({ field: "customer.ativo", op: "eq", value: true, valueType: "boolean" })).toBe(true);
    expect(c({ field: "customer.origem", op: "exists" })).toBe(true);
    expect(c({ field: "customer.telefone", op: "not_exists" })).toBe(true);
  });
  it("data: gte", () => {
    const withDate = { d: "2026-06-01" };
    expect(evalCondition({ field: "d", op: "gte", value: "2026-01-01", valueType: "date" }, withDate)).toBe(true);
    expect(evalCondition({ field: "d", op: "lt", value: "2026-01-01", valueType: "date" }, withDate)).toBe(false);
  });
});

describe("engine · delayMs", () => {
  it("converte unidades", () => {
    expect(delayMs({ amount: 2, unit: "minutes" })).toBe(120_000);
    expect(delayMs({ amount: 1, unit: "hours" })).toBe(3_600_000);
    expect(delayMs({ amount: 1, unit: "days" })).toBe(86_400_000);
    expect(delayMs({ ms: 500 })).toBe(500);
  });
});

describe("engine · planFrom", () => {
  it("ramo SIM → executa ação A", () => {
    const plan = planFrom(branchingGraph, undefined, { deal: { value: 5000 } });
    expect(plan.done).toBe(true);
    expect(plan.wait).toBeUndefined();
    const actions = plan.steps.filter((s) => s.type === "action");
    expect(actions).toHaveLength(1);
    expect((actions[0] as { action: string }).action).toBe("whatsapp.send");
  });
  it("ramo NÃO → executa ação B", () => {
    const plan = planFrom(branchingGraph, undefined, { deal: { value: 10 } });
    const actions = plan.steps.filter((s) => s.type === "action");
    expect((actions[0] as { action: string }).action).toBe("crm.add_tag");
  });

  it("delay pausa o fluxo e aponta o nó de retomada", () => {
    const g: FlowGraph = {
      nodes: [
        { node_key: "t", type: "trigger", config: {} },
        { node_key: "a1", type: "action", config: { action: "crm.add_tag", tag: "novo" } },
        { node_key: "d", type: "delay", config: { amount: 1, unit: "hours" } },
        { node_key: "a2", type: "action", config: { action: "whatsapp.send" } },
      ],
      edges: [
        { from_node: "t", to_node: "a1" },
        { from_node: "a1", to_node: "d" },
        { from_node: "d", to_node: "a2" },
      ],
    };
    const plan = planFrom(g, undefined, {});
    expect(plan.done).toBe(false);
    expect(plan.wait).toEqual({ node: "a2", ms: 3_600_000 });
    // só a ação antes do delay foi planejada
    expect(plan.steps.filter((s) => s.type === "action")).toHaveLength(1);

    // retomada a partir de a2 executa a segunda ação e finaliza
    const resumed = planFrom(g, "a2", {});
    expect(resumed.done).toBe(true);
    expect(resumed.steps.filter((s) => s.type === "action")).toHaveLength(1);
  });

  it("protege contra ciclos (não trava)", () => {
    const loop: FlowGraph = {
      nodes: [
        { node_key: "t", type: "trigger", config: {} },
        { node_key: "a", type: "action", config: { action: "noop" } },
      ],
      edges: [
        { from_node: "t", to_node: "a" },
        { from_node: "a", to_node: "a" },
      ],
    };
    const plan = planFrom(loop, undefined, {});
    expect(plan.steps.length).toBeLessThanOrEqual(200);
  });
});
