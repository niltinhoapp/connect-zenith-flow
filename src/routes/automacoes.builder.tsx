import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft, Play, Save, Zap, MessageCircle, Mail, Clock, GitBranch, Sparkles, Filter, Database, Webhook, Search, Bolt } from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Json } from "@/types/database";
import { useAutomationGraph, useSaveAutomation, useTestAutomation } from "@/features/automacoes/hooks/use-automacoes";

export const Route = createFileRoute("/automacoes/builder")({
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

const blocks = [
  { g: "Gatilhos", items: [
    { i: Zap, n: "Novo lead", d: "Quando um lead é criado" },
    { i: MessageCircle, n: "Mensagem recebida", d: "WhatsApp / SMS" },
    { i: Webhook, n: "Webhook", d: "Chamada HTTP externa" },
  ]},
  { g: "Ações", items: [
    { i: Mail, n: "Enviar e-mail", d: "Template ou personalizado" },
    { i: MessageCircle, n: "Enviar WhatsApp", d: "Texto, mídia ou template" },
    { i: Database, n: "Atualizar CRM", d: "Estágio, campo, tag" },
  ]},
  { g: "Lógica", items: [
    { i: GitBranch, n: "Condição", d: "If / else / branch" },
    { i: Clock, n: "Aguardar", d: "Delay ou horário" },
    { i: Filter, n: "Filtrar", d: "Segmentar audiência" },
  ]},
  { g: "IA", items: [
    { i: Sparkles, n: "Classificar intenção", d: "Modelo LLM" },
    { i: Sparkles, n: "Gerar resposta", d: "Chat completion" },
  ]},
];

type DemoNode = { id: string; x: number; y: number; icon: typeof Zap; title: string; desc: string; color: string };

// Fallback visual (entrada "Nova automação", sem id) — mockup preservado.
const demoNodes: DemoNode[] = [
  { id: "n1", x: 40,  y: 80,  icon: Zap,           title: "Gatilho: Novo lead", desc: "Origem: WhatsApp",         color: "bg-primary/15 text-primary ring-primary/25" },
  { id: "n2", x: 340, y: 80,  icon: Sparkles,      title: "Classificar com IA", desc: "Intenção do cliente",       color: "bg-warning/15 text-warning ring-warning/25" },
  { id: "n3", x: 640, y: 20,  icon: GitBranch,     title: "Condição",           desc: "Se score > 80",             color: "bg-muted text-foreground ring-border" },
  { id: "n4", x: 940, y: 20,  icon: MessageCircle, title: "Enviar WhatsApp",    desc: "Template: Boas-vindas VIP", color: "bg-success/15 text-success ring-success/25" },
  { id: "n5", x: 940, y: 160, icon: Mail,          title: "Enviar e-mail",      desc: "Template: Nutrição",         color: "bg-primary/15 text-primary ring-primary/25" },
];
const demoEdges: Array<[string, string]> = [["n1", "n2"], ["n2", "n3"], ["n3", "n4"], ["n3", "n5"]];

// Estilo (ícone/cor) por tipo de nó — mesma linguagem visual dos cards.
const NODE_STYLE: Record<string, { icon: typeof Zap; color: string }> = {
  trigger: { icon: Zap, color: "bg-primary/15 text-primary ring-primary/25" },
  condition: { icon: GitBranch, color: "bg-muted text-foreground ring-border" },
  branch: { icon: GitBranch, color: "bg-muted text-foreground ring-border" },
  delay: { icon: Clock, color: "bg-warning/15 text-warning ring-warning/25" },
  action: { icon: Bolt, color: "bg-success/15 text-success ring-success/25" },
};

type RenderNode = { id: string; x: number; y: number; icon: typeof Zap; title: string; desc: string; color: string; type: string; config: Record<string, unknown> };

function num(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

/** Posiciona nós reais: usa position salva ({x,y}) ou layout por profundidade. */
function layoutNodes(
  nodes: Array<{ node_key: string; type: string; config: Json; position: Json }>,
  edges: Array<{ from_node: string; to_node: string }>,
): RenderNode[] {
  // profundidade (coluna) por BFS a partir da entrada
  const depth = new Map<string, number>();
  const entry = nodes.find((n) => n.type === "trigger")?.node_key
    ?? nodes.find((n) => !edges.some((e) => e.to_node === n.node_key))?.node_key;
  if (entry) {
    const q = [entry]; depth.set(entry, 0);
    while (q.length) {
      const cur = q.shift()!;
      for (const e of edges.filter((x) => x.from_node === cur)) {
        if (!depth.has(e.to_node)) { depth.set(e.to_node, (depth.get(cur) ?? 0) + 1); q.push(e.to_node); }
      }
    }
  }
  const rowByCol = new Map<number, number>();
  return nodes.map((n, i) => {
    const cfg = (n.config && typeof n.config === "object" ? n.config : {}) as Record<string, unknown>;
    const pos = (n.position && typeof n.position === "object" ? n.position : {}) as Record<string, unknown>;
    const col = depth.get(n.node_key) ?? i;
    const row = rowByCol.get(col) ?? 0;
    rowByCol.set(col, row + 1);
    const style = NODE_STYLE[n.type] ?? NODE_STYLE.action;
    const title = String(cfg.title ?? cfg.action ?? n.type);
    const descBits = n.type === "action" ? String(cfg.action ?? "")
      : n.type === "condition" || n.type === "branch" ? `${cfg.field ?? ""} ${cfg.op ?? ""} ${cfg.value ?? ""}`.trim()
      : n.type === "delay" ? `${cfg.amount ?? ""} ${cfg.unit ?? ""}`.trim()
      : n.type === "trigger" ? "Gatilho" : "";
    return {
      id: n.node_key,
      x: num(pos.x, 40 + col * 300),
      y: num(pos.y, 40 + row * 140),
      icon: style.icon,
      title,
      desc: descBits || n.node_key,
      color: style.color,
      type: n.type,
      config: cfg,
    };
  });
}

function BuilderPage() {
  const { id } = Route.useSearch();
  const { data: graph, isLoading } = useAutomationGraph(id ?? null);
  const save = useSaveAutomation();
  const test = useTestAutomation();
  const [selected, setSelected] = useState<string | null>(null);

  const isReal = !!id && !!graph;
  const renderNodes: RenderNode[] = useMemo(() => {
    if (isReal) return layoutNodes(graph!.nodes, graph!.edges);
    return demoNodes.map((n) => ({ ...n, type: "demo", config: {} }));
  }, [isReal, graph]);

  const renderEdges: Array<{ a: string; b: string }> = isReal
    ? graph!.edges.map((e) => ({ a: e.from_node, b: e.to_node }))
    : demoEdges.map(([a, b]) => ({ a, b }));

  const selNode = renderNodes.find((n) => n.id === selected) ?? null;
  const nodeById = (k: string) => renderNodes.find((n) => n.id === k);

  const headerName = isReal ? graph!.automation.name : "Nova automação";
  const headerVersion = isReal ? graph!.automation.current_version : 1;
  const status = isReal ? graph!.automation.status : "draft";

  const onSave = () => {
    if (!isReal) return; // sem editor interativo não há grafo novo para persistir
    save.mutate({
      id: graph!.automation.id,
      name: graph!.automation.name,
      description: graph!.automation.description,
      triggerType: graph!.automation.trigger_type,
      triggerConfig: (graph!.automation.trigger_config as Record<string, unknown>) ?? {},
      graph: {
        nodes: graph!.nodes.map((n) => ({ node_key: n.node_key, type: n.type as never, config: (n.config ?? {}) as Record<string, unknown>, position: (n.position ?? {}) as Record<string, unknown> })),
        edges: graph!.edges.map((e) => ({ from_node: e.from_node, to_node: e.to_node, branch: e.branch })),
      },
    });
  };

  return (
    <AppLayout>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon" className="h-9 w-9">
            <Link to="/automacoes"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">{headerName}</h1>
            <p className="text-xs text-muted-foreground">Versão {headerVersion}</p>
          </div>
          <Badge className={cn(
            "ml-2 rounded-md border-0 text-[11px] font-medium ring-1 ring-inset",
            status === "active" ? "bg-success/10 text-success ring-success/25"
              : status === "paused" ? "bg-warning/10 text-warning ring-warning/25"
              : "bg-muted text-muted-foreground ring-border",
          )}>
            {status === "active" ? "Ativa" : status === "paused" ? "Pausada" : "Rascunho"}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="h-9 rounded-lg border-border bg-card"
            disabled={!isReal || test.isPending}
            onClick={() => id && test.mutate({ id })}
          >
            <Play className="mr-1.5 h-4 w-4" /> {test.isPending ? "Testando…" : "Testar"}
          </Button>
          <Button
            className="h-9 rounded-lg bg-primary hover:bg-primary/90"
            disabled={!isReal || save.isPending}
            onClick={onSave}
          >
            <Save className="mr-1.5 h-4 w-4" /> {save.isPending ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      </div>

      <div className="grid h-[calc(100vh-14rem)] grid-cols-1 gap-4 lg:grid-cols-[280px_1fr_300px]">
        {/* Blocks palette */}
        <aside className="hidden min-h-0 flex-col rounded-2xl border border-border bg-card lg:flex">
          <div className="border-b border-border p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Buscar bloco..." className="h-9 rounded-lg border-border bg-background pl-8 text-xs" />
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {blocks.map((g) => (
              <div key={g.g} className="mb-4">
                <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {g.g}
                </p>
                <div className="space-y-1.5">
                  {g.items.map((it) => (
                    <button
                      key={it.n}
                      className="flex w-full items-center gap-2.5 rounded-lg border border-border bg-background p-2.5 text-left transition-colors hover:border-primary/40 hover:bg-primary/5"
                    >
                      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                        <it.i className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium">{it.n}</p>
                        <p className="truncate text-[10px] text-muted-foreground">{it.d}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* Canvas */}
        <div className="relative min-h-0 overflow-hidden rounded-2xl border border-border bg-background subtle-grid">
          <div className="absolute inset-0 overflow-auto">
            <div className="relative" style={{ width: 1280, height: 500 }}>
              <svg className="absolute inset-0 h-full w-full" style={{ pointerEvents: "none" }}>
                <defs>
                  <marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
                    <path d="M0,0 L0,6 L9,3 z" fill="var(--color-border)" />
                  </marker>
                </defs>
                {renderEdges.map(({ a, b }) => {
                  const na = nodeById(a); const nb = nodeById(b);
                  if (!na || !nb) return null;
                  const x1 = na.x + 240, y1 = na.y + 40;
                  const x2 = nb.x, y2 = nb.y + 40;
                  const cx = (x1 + x2) / 2;
                  return (
                    <path
                      key={a + b}
                      d={`M${x1},${y1} C${cx},${y1} ${cx},${y2} ${x2},${y2}`}
                      stroke="var(--color-border)"
                      strokeWidth="1.5"
                      fill="none"
                      markerEnd="url(#arrow)"
                    />
                  );
                })}
              </svg>
              {renderNodes.map((n) => (
                <button
                  key={n.id}
                  onClick={() => setSelected(n.id)}
                  className={cn(
                    "absolute w-60 cursor-pointer rounded-xl border border-border bg-card p-3 text-left shadow-lg shadow-black/20 transition-all hover:-translate-y-0.5 hover:border-primary/50",
                    selected === n.id && "ring-2 ring-primary/40 ring-offset-2 ring-offset-background",
                  )}
                  style={{ left: n.x, top: n.y }}
                >
                  <div className="flex items-center gap-2.5">
                    <div className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg ring-1 ring-inset", n.color)}>
                      <n.icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold">{n.title}</p>
                      <p className="truncate text-[10px] text-muted-foreground">{n.desc}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full border border-border bg-card/80 px-3 py-1 text-[10px] text-muted-foreground backdrop-blur-md">
            {isLoading ? "Carregando fluxo…" : isReal ? "Clique num bloco para ver as propriedades" : "Arraste blocos da barra lateral para o canvas"}
          </div>
        </div>

        {/* Inspector */}
        <aside className="hidden min-h-0 flex-col overflow-y-auto rounded-2xl border border-border bg-card p-5 lg:flex">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Bloco selecionado</p>
          {selNode ? (
            <>
              <h3 className="mt-1 text-sm font-semibold">{selNode.title}</h3>
              <p className="mt-1 text-xs capitalize text-muted-foreground">{selNode.type}</p>
              <div className="mt-5 space-y-4">
                {Object.keys(selNode.config).length === 0 ? (
                  <p className="text-xs text-muted-foreground">Sem propriedades.</p>
                ) : (
                  Object.entries(selNode.config).map(([k, v]) => (
                    <div key={k}>
                      <label className="mb-1 block text-xs font-medium capitalize">{k}</label>
                      <div className="rounded-lg border border-border bg-background px-3 py-2 text-xs font-mono break-all">
                        {typeof v === "object" ? JSON.stringify(v) : String(v)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            <>
              <h3 className="mt-1 text-sm font-semibold">Nenhum bloco</h3>
              <p className="mt-1 text-xs text-muted-foreground">Selecione um bloco no canvas para ver suas propriedades.</p>
            </>
          )}
        </aside>
      </div>
    </AppLayout>
  );
}
