import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Play,
  Save,
  Zap,
  MessageCircle,
  Clock,
  GitBranch,
  Sparkles,
  Database,
  Webhook,
  Bolt,
  Plus,
  Trash2,
  Link2,
  X,
} from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { describeSchedule, parseSchedule, type NodeType } from "@/features/automacoes";
import {
  useAutomationGraph,
  useSaveAutomation,
  useTestAutomation,
} from "@/features/automacoes/hooks/use-automacoes";

export const Route = createFileRoute("/automacoes_/builder")({
  validateSearch: (s: Record<string, unknown>): { id?: string } => ({
    id: typeof s.id === "string" ? s.id : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Construtor visual — Automações — ConnectWeb" },
      { name: "description", content: "Construa fluxos de automação em drag-and-drop." },
    ],
  }),
  component: BuilderPage,
});

// ── Catálogos ────────────────────────────────────────────────────────────────
const TRIGGERS = [
  "lead.created",
  "lead.converted",
  "customer.created",
  "deal.created",
  "deal.stage.changed",
  "deal.won",
  "whatsapp.message.received",
  "whatsapp.message.sent",
  "manual",
  "scheduled",
] as const;

const ACTIONS = [
  "whatsapp.send",
  "whatsapp.send_template",
  "whatsapp.set_status",
  "conversation.assign",
  "conversation.add_tags",
  "customer.create",
  "customer.update",
  "customer.add_tag",
  "customer.remove_tag",
  "deal.create",
  "deal.move_stage",
  "deal.won",
  "crm.create_note",
  "webhook.call",
  "wait",
] as const;

const OPS = [
  "eq",
  "ne",
  "gt",
  "gte",
  "lt",
  "lte",
  "contains",
  "not_contains",
  "starts_with",
  "in",
  "exists",
  "not_exists",
] as const;
const VALUE_TYPES = ["text", "number", "date", "boolean"] as const;
const UNITS = ["seconds", "minutes", "hours", "days"] as const;

// Paleta (mesma estrutura visual; cada item adiciona um nó real).
const PALETTE: {
  g: string;
  items: { i: typeof Zap; n: string; type: NodeType; config: Record<string, unknown> }[];
}[] = [
  {
    g: "Gatilhos",
    items: [
      { i: Zap, n: "Novo lead", type: "trigger", config: { trigger_type: "lead.created" } },
      { i: Sparkles, n: "Negócio ganho", type: "trigger", config: { trigger_type: "deal.won" } },
      {
        i: MessageCircle,
        n: "WhatsApp recebido",
        type: "trigger",
        config: { trigger_type: "whatsapp.message.received" },
      },
      { i: Play, n: "Manual", type: "trigger", config: { trigger_type: "manual" } },
    ],
  },
  {
    g: "Ações",
    items: [
      {
        i: MessageCircle,
        n: "Enviar WhatsApp",
        type: "action",
        config: { action: "whatsapp.send", conversation_id: "{{conversationId}}", body: "" },
      },
      {
        i: Database,
        n: "Atualizar CRM",
        type: "action",
        config: { action: "customer.update", customer_id: "{{customerId}}" },
      },
      { i: Bolt, n: "Criar negócio", type: "action", config: { action: "deal.create", title: "" } },
      {
        i: Webhook,
        n: "Webhook",
        type: "action",
        config: { action: "webhook.call", url: "https://", method: "POST" },
      },
    ],
  },
  {
    g: "Lógica",
    items: [
      {
        i: GitBranch,
        n: "Condição (sim/não)",
        type: "condition",
        config: { field: "", op: "eq", value: "", valueType: "text" },
      },
      { i: Clock, n: "Aguardar", type: "delay", config: { amount: 1, unit: "minutes" } },
    ],
  },
];

const NODE_STYLE: Record<string, { icon: typeof Zap; color: string }> = {
  trigger: { icon: Zap, color: "bg-primary/15 text-primary ring-primary/25" },
  condition: { icon: GitBranch, color: "bg-muted text-foreground ring-border" },
  branch: { icon: GitBranch, color: "bg-muted text-foreground ring-border" },
  delay: { icon: Clock, color: "bg-warning/15 text-warning ring-warning/25" },
  action: { icon: Bolt, color: "bg-success/15 text-success ring-success/25" },
};

type EN = {
  node_key: string;
  type: NodeType;
  config: Record<string, unknown>;
  x: number;
  y: number;
};
type EE = { from_node: string; to_node: string; branch?: "yes" | "no" | null };

function num(v: unknown, fb: number) {
  return typeof v === "number" && Number.isFinite(v) ? v : fb;
}

function nodeLabel(n: EN): { title: string; desc: string } {
  const c = n.config;
  if (n.type === "trigger")
    return {
      title: "Gatilho",
      desc:
        c.trigger_type === "scheduled"
          ? describeSchedule(c.schedule)
          : String(c.trigger_type ?? "manual"),
    };
  if (n.type === "condition" || n.type === "branch")
    return { title: "Condição", desc: `${c.field ?? "?"} ${c.op ?? ""} ${c.value ?? ""}`.trim() };
  if (n.type === "delay")
    return { title: "Aguardar", desc: `${c.amount ?? ""} ${c.unit ?? ""}`.trim() };
  return { title: "Ação", desc: String(c.action ?? "") };
}

// Layout inicial de um grafo carregado (posição salva ou por profundidade).
function seedLayout(
  nodes: Array<{ node_key: string; type: string; config: unknown; position: unknown }>,
  edges: Array<{ from_node: string; to_node: string }>,
): EN[] {
  const depth = new Map<string, number>();
  const entry =
    nodes.find((n) => n.type === "trigger")?.node_key ??
    nodes.find((n) => !edges.some((e) => e.to_node === n.node_key))?.node_key;
  if (entry) {
    const q = [entry];
    depth.set(entry, 0);
    while (q.length) {
      const cur = q.shift()!;
      for (const e of edges.filter((x) => x.from_node === cur))
        if (!depth.has(e.to_node)) {
          depth.set(e.to_node, (depth.get(cur) ?? 0) + 1);
          q.push(e.to_node);
        }
    }
  }
  const rowByCol = new Map<number, number>();
  return nodes.map((n, i) => {
    const pos = (n.position && typeof n.position === "object" ? n.position : {}) as Record<
      string,
      unknown
    >;
    const col = depth.get(n.node_key) ?? i;
    const row = rowByCol.get(col) ?? 0;
    rowByCol.set(col, row + 1);
    return {
      node_key: n.node_key,
      type: n.type as NodeType,
      config: (n.config && typeof n.config === "object" ? n.config : {}) as Record<string, unknown>,
      x: num(pos.x, 60 + col * 300),
      y: num(pos.y, 60 + row * 140),
    };
  });
}

function BuilderPage() {
  const { id } = Route.useSearch();
  const navigate = useNavigate();
  const { data: graph, isLoading } = useAutomationGraph(id ?? null);
  const save = useSaveAutomation();
  const test = useTestAutomation();

  const [name, setName] = useState("Nova automação");
  const [description, setDescription] = useState("");
  const [nodes, setNodes] = useState<EN[]>([
    { node_key: "trigger_1", type: "trigger", config: { trigger_type: "manual" }, x: 80, y: 80 },
  ]);
  const [edges, setEdges] = useState<EE[]>([]);
  const [selected, setSelected] = useState<string | null>("trigger_1");
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const seededRef = useRef<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Semeia o estado a partir do fluxo carregado (uma vez por id).
  useEffect(() => {
    if (id && graph && seededRef.current !== id) {
      seededRef.current = id;
      setName(graph.automation.name);
      setDescription(graph.automation.description ?? "");
      const seeded = seedLayout(graph.nodes, graph.edges);
      const hydrated = seeded.map((node) => {
        if (
          node.type !== "trigger" ||
          node.config.trigger_type !== "scheduled" ||
          parseSchedule(node.config.schedule)
        ) {
          return node;
        }
        const savedSchedule = parseSchedule(graph.automation.trigger_config)
          ? graph.automation.trigger_config
          : { mode: "interval", every: 1, unit: "days" };
        return { ...node, config: { ...node.config, schedule: savedSchedule } };
      });
      setNodes(
        hydrated.length
          ? hydrated
          : [
              {
                node_key: "trigger_1",
                type: "trigger",
                config: {
                  trigger_type: graph.automation.trigger_type,
                  ...(graph.automation.trigger_type === "scheduled"
                    ? {
                        schedule: parseSchedule(graph.automation.trigger_config)
                          ? graph.automation.trigger_config
                          : { mode: "interval", every: 1, unit: "days" },
                      }
                    : {}),
                },
                x: 80,
                y: 80,
              },
            ],
      );
      setEdges(
        graph.edges.map((e) => ({ from_node: e.from_node, to_node: e.to_node, branch: e.branch })),
      );
      setSelected(null);
    }
  }, [id, graph]);

  const selNode = nodes.find((n) => n.node_key === selected) ?? null;
  const nodeById = (k: string) => nodes.find((n) => n.node_key === k);

  // ── Mutações de grafo ──────────────────────────────────────────────────────
  function addNode(type: NodeType, config: Record<string, unknown>) {
    const key = `${type}_${Date.now().toString(36)}`;
    setNodes((prev) => {
      // nasce à direita do nó mais à direita (nunca sobreposto ao gatilho)
      const maxX = prev.reduce((m, n) => Math.max(m, n.x), 0);
      const x = prev.length === 0 ? 80 : maxX + 280;
      const y = 80 + (prev.length % 4) * 130;
      return [...prev, { node_key: key, type, config: { ...config }, x, y }];
    });
    setSelected(key);
  }
  function updateConfig(key: string, patch: Record<string, unknown>) {
    setNodes((prev) =>
      prev.map((n) => (n.node_key === key ? { ...n, config: { ...n.config, ...patch } } : n)),
    );
  }
  function renameConfigKey(key: string, oldK: string, newK: string) {
    setNodes((prev) =>
      prev.map((n) => {
        if (n.node_key !== key) return n;
        const c: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(n.config)) c[k === oldK ? newK : k] = v;
        return { ...n, config: c };
      }),
    );
  }
  function removeConfigKey(key: string, k: string) {
    setNodes((prev) =>
      prev.map((n) => {
        if (n.node_key !== key) return n;
        const c = { ...n.config };
        delete c[k];
        return { ...n, config: c };
      }),
    );
  }
  function removeNode(key: string) {
    setNodes((prev) => prev.filter((n) => n.node_key !== key));
    setEdges((prev) => prev.filter((e) => e.from_node !== key && e.to_node !== key));
    if (selected === key) setSelected(null);
  }
  function addEdge(from: string, to: string) {
    if (from === to) return;
    const src = nodeById(from);
    setEdges((prev) => {
      if (prev.some((e) => e.from_node === from && e.to_node === to)) return prev;
      if (src && (src.type === "condition" || src.type === "branch")) {
        const hasYes = prev.some((e) => e.from_node === from && e.branch === "yes");
        const hasNo = prev.some((e) => e.from_node === from && e.branch === "no");
        if (hasYes && hasNo) return prev; // já tem os dois ramos
        return [...prev, { from_node: from, to_node: to, branch: hasYes ? "no" : "yes" }];
      }
      // nós lineares: no máx. 1 saída (substitui)
      return [
        ...prev.filter((e) => e.from_node !== from),
        { from_node: from, to_node: to, branch: null },
      ];
    });
  }
  function removeEdge(from: string, to: string) {
    setEdges((prev) => prev.filter((e) => !(e.from_node === from && e.to_node === to)));
  }
  function setEdgeBranch(from: string, to: string, branch: "yes" | "no") {
    setEdges((prev) =>
      prev.map((e) => (e.from_node === from && e.to_node === to ? { ...e, branch } : e)),
    );
  }

  // ── Drag de nós (pointer) ────────────────────────────────────────────────────
  function onNodePointerDown(e: React.PointerEvent, key: string) {
    if (e.button !== 0) return;
    const node = nodeById(key);
    if (!node) return;
    const startX = e.clientX,
      startY = e.clientY,
      ox = node.x,
      oy = node.y;
    let moved = false;
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - startX,
        dy = ev.clientY - startY;
      if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
      if (moved)
        setNodes((prev) =>
          prev.map((n) =>
            n.node_key === key ? { ...n, x: Math.max(0, ox + dx), y: Math.max(0, oy + dy) } : n,
          ),
        );
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      if (!moved) onNodeClick(key);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }
  function onNodeClick(key: string) {
    if (connectFrom && connectFrom !== key) {
      addEdge(connectFrom, key);
      setConnectFrom(null);
      return;
    }
    setSelected(key);
  }

  // ── Salvar / testar ──────────────────────────────────────────────────────────
  const triggerType = useMemo(() => {
    const t = nodes.find((n) => n.type === "trigger");
    return String(t?.config.trigger_type ?? "manual");
  }, [nodes]);
  const hasTrigger = nodes.some((n) => n.type === "trigger");

  function onSave() {
    save.mutate(
      {
        id: id ?? null,
        name: name.trim() || "Sem nome",
        description: description.trim() || null,
        triggerType,
        triggerConfig:
          triggerType === "scheduled"
            ? ((nodes.find((n) => n.type === "trigger")?.config.schedule as
                Record<string, unknown> | undefined) ?? {})
            : {},
        graph: {
          nodes: nodes.map((n) => ({
            node_key: n.node_key,
            type: n.type,
            config: n.config,
            position: { x: n.x, y: n.y },
          })),
          edges: edges.map((e) => ({
            from_node: e.from_node,
            to_node: e.to_node,
            branch: e.branch ?? null,
          })),
        },
      },
      {
        onSuccess: (res) => {
          if (!id && res?.id) navigate({ to: "/automacoes/builder", search: { id: res.id } });
        },
      },
    );
  }

  return (
    <AppLayout>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon" className="h-9 w-9">
            <Link to="/automacoes">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-8 w-64 rounded-lg border-transparent bg-transparent px-1 text-lg font-semibold tracking-tight hover:border-border focus:border-border"
            />
            <p className="px-1 text-xs text-muted-foreground">
              Gatilho: {triggerType}
              {id && graph ? ` · Versão ${graph.automation.current_version}` : " · novo"}
            </p>
          </div>
          {!hasTrigger && (
            <Badge className="rounded-md border-0 bg-warning/10 text-[11px] font-medium text-warning ring-1 ring-inset ring-warning/25">
              Sem gatilho
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="h-9 rounded-lg border-border bg-card"
            disabled={!id || test.isPending}
            onClick={() => id && test.mutate({ id })}
          >
            <Play className="mr-1.5 h-4 w-4" /> {test.isPending ? "Testando…" : "Testar"}
          </Button>
          <Button
            className="h-9 rounded-lg bg-primary hover:bg-primary/90"
            disabled={save.isPending || !name.trim()}
            onClick={onSave}
          >
            <Save className="mr-1.5 h-4 w-4" /> {save.isPending ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      </div>

      <div className="grid h-[calc(100vh-14rem)] grid-cols-1 gap-4 lg:grid-cols-[280px_1fr_320px]">
        {/* Paleta */}
        <aside className="hidden min-h-0 flex-col rounded-2xl border border-border bg-card lg:flex">
          <div className="border-b border-border p-3">
            <p className="text-xs font-medium text-muted-foreground">
              Clique para adicionar ao fluxo
            </p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {PALETTE.map((g) => (
              <div key={g.g} className="mb-4">
                <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {g.g}
                </p>
                <div className="space-y-1.5">
                  {g.items.map((it) => (
                    <button
                      key={it.n}
                      onClick={() => addNode(it.type, it.config)}
                      className="flex w-full items-center gap-2.5 rounded-lg border border-border bg-background p-2.5 text-left transition-colors hover:border-primary/40 hover:bg-primary/5"
                    >
                      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                        <it.i className="h-4 w-4" />
                      </div>
                      <p className="truncate text-xs font-medium">{it.n}</p>
                      <Plus className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* Canvas */}
        <div className="relative min-h-0 overflow-hidden rounded-2xl border border-border bg-background subtle-grid">
          <div ref={canvasRef} className="absolute inset-0 overflow-auto">
            <div className="relative" style={{ width: 1600, height: 700 }}>
              <svg className="absolute inset-0 h-full w-full" style={{ pointerEvents: "none" }}>
                <defs>
                  <marker
                    id="arrow"
                    markerWidth="10"
                    markerHeight="10"
                    refX="8"
                    refY="3"
                    orient="auto"
                  >
                    <path d="M0,0 L0,6 L9,3 z" fill="var(--color-border)" />
                  </marker>
                </defs>
                {edges.map((e) => {
                  const na = nodeById(e.from_node),
                    nb = nodeById(e.to_node);
                  if (!na || !nb) return null;
                  const x1 = na.x + 240,
                    y1 = na.y + 36,
                    x2 = nb.x,
                    y2 = nb.y + 36,
                    cx = (x1 + x2) / 2;
                  return (
                    <g key={e.from_node + e.to_node}>
                      <path
                        d={`M${x1},${y1} C${cx},${y1} ${cx},${y2} ${x2},${y2}`}
                        stroke={
                          e.branch === "no"
                            ? "var(--color-destructive)"
                            : e.branch === "yes"
                              ? "var(--color-success)"
                              : "var(--color-border)"
                        }
                        strokeWidth="1.5"
                        fill="none"
                        markerEnd="url(#arrow)"
                      />
                      {e.branch && (
                        <text
                          x={cx}
                          y={(y1 + y2) / 2 - 4}
                          fill="var(--color-muted-foreground)"
                          fontSize="10"
                          textAnchor="middle"
                        >
                          {e.branch === "yes" ? "sim" : "não"}
                        </text>
                      )}
                    </g>
                  );
                })}
              </svg>

              {nodes.map((n) => {
                const meta = NODE_STYLE[n.type] ?? NODE_STYLE.action;
                const Icon = meta.icon;
                const lbl = nodeLabel(n);
                return (
                  <div
                    key={n.node_key}
                    onPointerDown={(e) => onNodePointerDown(e, n.node_key)}
                    className={cn(
                      "group absolute w-60 cursor-grab touch-none select-none rounded-xl border border-border bg-card p-3 shadow-lg shadow-black/20 transition-shadow active:cursor-grabbing",
                      selected === n.node_key &&
                        "ring-2 ring-primary/40 ring-offset-2 ring-offset-background",
                      connectFrom === n.node_key && "ring-2 ring-success/50",
                    )}
                    style={{ left: n.x, top: n.y }}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={cn(
                          "grid h-9 w-9 shrink-0 place-items-center rounded-lg ring-1 ring-inset",
                          meta.color,
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold">{lbl.title}</p>
                        <p className="truncate text-[10px] text-muted-foreground">
                          {lbl.desc || n.node_key}
                        </p>
                      </div>
                    </div>
                    {/* Handle de conexão */}
                    <button
                      onPointerDown={(e) => {
                        e.stopPropagation();
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setConnectFrom(n.node_key);
                      }}
                      title="Conectar a partir deste nó"
                      className="absolute -right-2 top-1/2 grid h-5 w-5 -translate-y-1/2 place-items-center rounded-full border border-border bg-card text-muted-foreground opacity-0 transition-opacity hover:text-primary group-hover:opacity-100"
                    >
                      <Link2 className="h-3 w-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full border border-border bg-card/80 px-3 py-1 text-[10px] text-muted-foreground backdrop-blur-md">
            {isLoading
              ? "Carregando fluxo…"
              : connectFrom
                ? "Conectando — clique no nó de destino (Esc cancela)"
                : "Arraste os nós · use o ⛓ para conectar · clique para editar"}
          </div>
          {connectFrom && (
            <button
              onClick={() => setConnectFrom(null)}
              className="absolute right-4 top-4 flex items-center gap-1 rounded-lg border border-border bg-card px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" /> cancelar conexão
            </button>
          )}
        </div>

        {/* Inspector */}
        <aside className="hidden min-h-0 flex-col overflow-y-auto rounded-2xl border border-border bg-card p-5 lg:flex">
          {selNode ? (
            <Inspector
              key={selNode.node_key}
              node={selNode}
              edges={edges.filter((e) => e.from_node === selNode.node_key)}
              nodeById={nodeById}
              onConfig={(patch) => updateConfig(selNode.node_key, patch)}
              onRenameKey={(o, k) => renameConfigKey(selNode.node_key, o, k)}
              onRemoveKey={(k) => removeConfigKey(selNode.node_key, k)}
              onRemoveNode={() => removeNode(selNode.node_key)}
              onStartConnect={() => setConnectFrom(selNode.node_key)}
              onRemoveEdge={(to) => removeEdge(selNode.node_key, to)}
              onEdgeBranch={(to, b) => setEdgeBranch(selNode.node_key, to, b)}
            />
          ) : (
            <>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Propriedades
              </p>
              <h3 className="mt-1 text-sm font-semibold">Nenhum bloco selecionado</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Adicione blocos pela paleta e clique num deles para editar.
              </p>
              <div className="mt-5">
                <label className="mb-1 block text-xs font-medium">Descrição da automação</label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="text-xs"
                  placeholder="Opcional"
                />
              </div>
            </>
          )}
        </aside>
      </div>
    </AppLayout>
  );
}

function ScheduleEditor(props: {
  value: Record<string, unknown>;
  onChange: (value: Record<string, unknown>) => void;
}) {
  const mode = props.value.mode === "daily" ? "daily" : "interval";

  return (
    <div className="space-y-4 rounded-lg border border-primary/20 bg-primary/5 p-3">
      <Field label="Como repetir">
        <Select
          value={mode}
          onValueChange={(value) =>
            props.onChange(
              value === "daily"
                ? { mode: "daily", at: "12:00" }
                : { mode: "interval", every: 1, unit: "days" },
            )
          }
        >
          <SelectTrigger className="h-9 bg-background text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="interval" className="text-xs">
              A cada intervalo
            </SelectItem>
            <SelectItem value="daily" className="text-xs">
              Todos os dias
            </SelectItem>
          </SelectContent>
        </Select>
      </Field>

      {mode === "interval" ? (
        <div className="grid grid-cols-[1fr_1.4fr] gap-2">
          <Field label="A cada">
            <Input
              type="number"
              min={1}
              value={String(props.value.every ?? 1)}
              onChange={(event) =>
                props.onChange({
                  mode: "interval",
                  every: Math.max(1, Number(event.target.value) || 1),
                  unit: props.value.unit ?? "days",
                })
              }
              className="h-9 bg-background text-xs"
            />
          </Field>
          <Field label="Unidade">
            <Select
              value={String(props.value.unit ?? "days")}
              onValueChange={(unit) =>
                props.onChange({
                  mode: "interval",
                  every: Math.max(1, Number(props.value.every) || 1),
                  unit,
                })
              }
            >
              <SelectTrigger className="h-9 bg-background text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="minutes" className="text-xs">
                  minuto(s)
                </SelectItem>
                <SelectItem value="hours" className="text-xs">
                  hora(s)
                </SelectItem>
                <SelectItem value="days" className="text-xs">
                  dia(s)
                </SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
      ) : (
        <Field label="Horário diário (UTC)">
          <Input
            type="time"
            value={String(props.value.at ?? "12:00")}
            onChange={(event) => props.onChange({ mode: "daily", at: event.target.value })}
            className="h-9 bg-background text-xs"
          />
        </Field>
      )}

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        A automação precisa estar ativa. O próximo disparo é recalculado ao alterar este
        agendamento.
      </p>
    </div>
  );
}

// ── Inspector por tipo de nó ─────────────────────────────────────────────────
function Inspector(props: {
  node: EN;
  edges: EE[];
  nodeById: (k: string) => EN | undefined;
  onConfig: (patch: Record<string, unknown>) => void;
  onRenameKey: (oldK: string, newK: string) => void;
  onRemoveKey: (k: string) => void;
  onRemoveNode: () => void;
  onStartConnect: () => void;
  onRemoveEdge: (to: string) => void;
  onEdgeBranch: (to: string, b: "yes" | "no") => void;
}) {
  const { node, edges, nodeById, onConfig } = props;
  const c = node.config;
  const isCond = node.type === "condition" || node.type === "branch";

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Propriedades
        </p>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-destructive hover:text-destructive"
          onClick={props.onRemoveNode}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      <h3 className="mt-1 text-sm font-semibold capitalize">{node.type}</h3>
      <p className="text-[10px] text-muted-foreground">{node.node_key}</p>

      <div className="mt-5 space-y-4">
        {node.type === "trigger" && (
          <Field label="Evento (gatilho)">
            <Select
              value={String(c.trigger_type ?? "manual")}
              onValueChange={(v) =>
                onConfig({
                  trigger_type: v,
                  ...(v === "scheduled" && !c.schedule
                    ? { schedule: { mode: "interval", every: 1, unit: "days" } }
                    : {}),
                })
              }
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRIGGERS.map((t) => (
                  <SelectItem key={t} value={t} className="text-xs">
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}

        {node.type === "trigger" && c.trigger_type === "scheduled" && (
          <ScheduleEditor
            value={
              (c.schedule && typeof c.schedule === "object" ? c.schedule : {}) as Record<
                string,
                unknown
              >
            }
            onChange={(schedule) => onConfig({ schedule })}
          />
        )}

        {isCond && (
          <>
            <Field label="Campo (ex.: deal.amount)">
              <Input
                value={String(c.field ?? "")}
                onChange={(e) => onConfig({ field: e.target.value })}
                className="h-9 text-xs"
                placeholder="deal.amount"
              />
            </Field>
            <Field label="Operador">
              <Select value={String(c.op ?? "eq")} onValueChange={(v) => onConfig({ op: v })}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OPS.map((o) => (
                    <SelectItem key={o} value={o} className="text-xs">
                      {o}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Valor">
              <Input
                value={String(c.value ?? "")}
                onChange={(e) => onConfig({ value: e.target.value })}
                className="h-9 text-xs"
                placeholder="1000"
              />
            </Field>
            <Field label="Tipo do valor">
              <Select
                value={String(c.valueType ?? "text")}
                onValueChange={(v) => onConfig({ valueType: v })}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VALUE_TYPES.map((t) => (
                    <SelectItem key={t} value={t} className="text-xs">
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </>
        )}

        {node.type === "delay" && (
          <>
            <Field label="Quantidade">
              <Input
                type="number"
                min={0}
                value={String(c.amount ?? 1)}
                onChange={(e) => onConfig({ amount: Number(e.target.value) })}
                className="h-9 text-xs"
              />
            </Field>
            <Field label="Unidade">
              <Select
                value={String(c.unit ?? "minutes")}
                onValueChange={(v) => onConfig({ unit: v })}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNITS.map((u) => (
                    <SelectItem key={u} value={u} className="text-xs">
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </>
        )}

        {node.type === "action" && (
          <>
            <Field label="Ação">
              <Select
                value={String(c.action ?? "whatsapp.send")}
                onValueChange={(v) => onConfig({ action: v })}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACTIONS.map((a) => (
                    <SelectItem key={a} value={a} className="text-xs">
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <ParamEditor
              node={node}
              onConfig={onConfig}
              onRenameKey={props.onRenameKey}
              onRemoveKey={props.onRemoveKey}
            />
          </>
        )}

        {/* Conexões de saída */}
        <div className="border-t border-border pt-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Conexões
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 gap-1 px-2 text-[11px]"
              onClick={props.onStartConnect}
            >
              <Link2 className="h-3 w-3" /> conectar
            </Button>
          </div>
          {edges.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">
              Sem saídas. Use “conectar” e clique no destino.
            </p>
          ) : (
            <div className="space-y-1.5">
              {edges.map((e) => {
                const t = nodeById(e.to_node);
                return (
                  <div
                    key={e.to_node}
                    className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-2 py-1.5 text-[11px]"
                  >
                    <span className="truncate">→ {t ? nodeLabel(t).title : e.to_node}</span>
                    {isCond && (
                      <Select
                        value={e.branch ?? "yes"}
                        onValueChange={(v) => props.onEdgeBranch(e.to_node, v as "yes" | "no")}
                      >
                        <SelectTrigger className="ml-auto h-6 w-16 text-[11px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="yes" className="text-xs">
                            sim
                          </SelectItem>
                          <SelectItem value="no" className="text-xs">
                            não
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        "h-5 w-5 text-muted-foreground hover:text-destructive",
                        !isCond && "ml-auto",
                      )}
                      onClick={() => props.onRemoveEdge(e.to_node)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium">{label}</label>
      {children}
    </div>
  );
}

// Editor de parâmetros (chave/valor) para nós de ação — suporta {{contexto}}.
function ParamEditor(props: {
  node: EN;
  onConfig: (patch: Record<string, unknown>) => void;
  onRenameKey: (oldK: string, newK: string) => void;
  onRemoveKey: (k: string) => void;
}) {
  const entries = Object.entries(props.node.config).filter(([k]) => k !== "action");
  return (
    <div>
      <label className="mb-1 block text-xs font-medium">Parâmetros</label>
      <div className="space-y-1.5">
        {entries.map(([k, v], i) => (
          <div key={i} className="flex items-center gap-1.5">
            <Input
              value={k}
              onChange={(e) => props.onRenameKey(k, e.target.value)}
              className="h-8 w-28 text-[11px] font-mono"
            />
            <Input
              value={typeof v === "object" ? JSON.stringify(v) : String(v ?? "")}
              onChange={(e) => props.onConfig({ [k]: e.target.value })}
              className="h-8 flex-1 text-[11px]"
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={() => props.onRemoveKey(k)}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        ))}
      </div>
      <Button
        variant="outline"
        size="sm"
        className="mt-2 h-7 gap-1 text-[11px]"
        onClick={() => props.onConfig({ [`campo_${Object.keys(props.node.config).length}`]: "" })}
      >
        <Plus className="h-3 w-3" /> parâmetro
      </Button>
      <p className="mt-1.5 text-[10px] text-muted-foreground">
        Use <code>{"{{campo}}"}</code> p/ valores do gatilho (ex.:{" "}
        <code>{"{{conversationId}}"}</code>).
      </p>
    </div>
  );
}
