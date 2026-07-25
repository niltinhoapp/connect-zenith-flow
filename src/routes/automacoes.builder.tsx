import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Play, Save, Zap, MessageCircle, Mail, Clock, GitBranch, Sparkles, Filter, Database, Webhook, Search } from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/automacoes/builder")({
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

type Node = { id: string; x: number; y: number; icon: any; title: string; desc: string; color: string };

const nodes: Node[] = [
  { id: "n1", x: 40,  y: 80,  icon: Zap,           title: "Gatilho: Novo lead", desc: "Origem: WhatsApp",         color: "bg-primary/15 text-primary ring-primary/25" },
  { id: "n2", x: 340, y: 80,  icon: Sparkles,      title: "Classificar com IA", desc: "Intenção do cliente",       color: "bg-warning/15 text-warning ring-warning/25" },
  { id: "n3", x: 640, y: 20,  icon: GitBranch,     title: "Condição",           desc: "Se score > 80",             color: "bg-muted text-foreground ring-border" },
  { id: "n4", x: 940, y: 20,  icon: MessageCircle, title: "Enviar WhatsApp",    desc: "Template: Boas-vindas VIP", color: "bg-success/15 text-success ring-success/25" },
  { id: "n5", x: 940, y: 160, icon: Mail,          title: "Enviar e-mail",      desc: "Template: Nutrição",         color: "bg-primary/15 text-primary ring-primary/25" },
];

function BuilderPage() {
  return (
    <AppLayout>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon" className="h-9 w-9">
            <Link to="/automacoes"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Roteamento inteligente com IA</h1>
            <p className="text-xs text-muted-foreground">Última alteração há 12min · Versão 3</p>
          </div>
          <Badge className="ml-2 rounded-md border-0 bg-success/10 text-[11px] font-medium text-success ring-1 ring-inset ring-success/25">
            Ativa
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="h-9 rounded-lg border-border bg-card">
            <Play className="mr-1.5 h-4 w-4" /> Testar
          </Button>
          <Button className="h-9 rounded-lg bg-primary hover:bg-primary/90">
            <Save className="mr-1.5 h-4 w-4" /> Salvar
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
                {[
                  ["n1", "n2"], ["n2", "n3"], ["n3", "n4"], ["n3", "n5"],
                ].map(([a, b]) => {
                  const na = nodes.find((n) => n.id === a)!;
                  const nb = nodes.find((n) => n.id === b)!;
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
              {nodes.map((n) => (
                <div
                  key={n.id}
                  className={cn(
                    "absolute w-60 cursor-move rounded-xl border border-border bg-card p-3 shadow-lg shadow-black/20 transition-all hover:-translate-y-0.5 hover:border-primary/50",
                    n.id === "n2" && "ring-2 ring-primary/40 ring-offset-2 ring-offset-background",
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
                </div>
              ))}
            </div>
          </div>

          <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full border border-border bg-card/80 px-3 py-1 text-[10px] text-muted-foreground backdrop-blur-md">
            Arraste blocos da barra lateral para o canvas
          </div>
        </div>

        {/* Inspector */}
        <aside className="hidden min-h-0 flex-col overflow-y-auto rounded-2xl border border-border bg-card p-5 lg:flex">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Bloco selecionado</p>
          <h3 className="mt-1 text-sm font-semibold">Classificar com IA</h3>
          <p className="mt-1 text-xs text-muted-foreground">Modelo LLM para intenção</p>

          <div className="mt-5 space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium">Modelo</label>
              <div className="rounded-lg border border-border bg-background px-3 py-2 text-xs">
                gpt-4o-mini · Rápido
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Prompt</label>
              <textarea
                rows={5}
                defaultValue={"Classifique a mensagem em: {venda | suporte | financeiro | outro}. Retorne JSON."}
                className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary/40"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Saída → Variável</label>
              <div className="rounded-lg border border-border bg-background px-3 py-2 text-xs font-mono">
                $intent
              </div>
            </div>
          </div>
        </aside>
      </div>
    </AppLayout>
  );
}
