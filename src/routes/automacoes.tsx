import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, Play, Pause, Zap, Sparkles, MessageCircle, Mail, Clock, Filter, MoreHorizontal, ArrowRight } from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { SectionCard } from "@/components/shared/section-card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/automacoes")({
  head: () => ({
    meta: [
      { title: "Automações — ConnectWeb" },
      { name: "description", content: "Fluxos de automação drag-and-drop com IA integrada." },
    ],
  }),
  component: AutomacoesPage,
});

const flows = [
  { n: "Onboarding de novos clientes", desc: "3 gatilhos · 8 etapas", runs: "1.284", success: "98,2%", channel: MessageCircle, active: true, tag: "Vendas" },
  { n: "Roteamento inteligente com IA", desc: "IA classifica intenção e direciona", runs: "8.421", success: "96,7%", channel: Sparkles, active: true, tag: "Suporte" },
  { n: "Recuperação de carrinho", desc: "E-mail + WhatsApp em cascata", runs: "412", success: "42,1%", channel: Mail, active: true, tag: "E-commerce" },
  { n: "Cobrança automatizada", desc: "Notifica antes e depois do vencimento", runs: "918", success: "88,4%", channel: Clock, active: false, tag: "Financeiro" },
  { n: "Reengajamento de leads frios", desc: "60 dias sem interação", runs: "2.104", success: "24,8%", channel: MessageCircle, active: true, tag: "Marketing" },
  { n: "NPS pós-atendimento", desc: "Envio 24h após fechamento", runs: "3.612", success: "76,4%", channel: Sparkles, active: true, tag: "Sucesso" },
];

function AutomacoesPage() {
  return (
    <AppLayout
      title="Automações"
      subtitle="47 fluxos · 16.751 execuções nos últimos 30 dias"
      actions={
        <>
          <Button variant="outline" className="h-9 rounded-lg border-border bg-card">
            <Filter className="mr-1.5 h-4 w-4" /> Filtrar
          </Button>
          <Button asChild className="h-9 rounded-lg bg-primary hover:bg-primary/90">
            <Link to="/automacoes/builder">
              <Plus className="mr-1.5 h-4 w-4" /> Nova automação
            </Link>
          </Button>
        </>
      }
    >
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        {[
          { l: "Execuções (30d)", v: "16.751", d: "+21%" },
          { l: "Taxa de sucesso", v: "94,2%", d: "+1,4pp" },
          { l: "Tempo médio", v: "3,8s", d: "-0,6s" },
        ].map((k) => (
          <div key={k.l} className="rounded-2xl border border-border bg-card p-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">{k.l}</p>
            <div className="mt-2 flex items-baseline gap-2">
              <p className="text-2xl font-semibold tabular-nums">{k.v}</p>
              <span className="rounded-md bg-success/10 px-1.5 py-0.5 text-[11px] font-medium text-success ring-1 ring-inset ring-success/25">
                {k.d}
              </span>
            </div>
          </div>
        ))}
      </div>

      <SectionCard
        title="Meus fluxos"
        description="Ative, pause ou edite suas automações"
        padded={false}
        action={
          <div className="w-56">
            <Input placeholder="Buscar automação..." className="h-8 rounded-lg border-border bg-background text-xs" />
          </div>
        }
      >
        <ul className="divide-y divide-border">
          {flows.map((f) => (
            <li key={f.n} className="group flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-accent/20 md:flex-row md:items-center">
              <div className="flex flex-1 items-center gap-4">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/20">
                  <f.channel className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium">{f.n}</p>
                    <Badge className="rounded-md border-0 bg-muted text-[10px] text-muted-foreground">{f.tag}</Badge>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{f.desc}</p>
                </div>
              </div>
              <div className="flex items-center gap-6 text-xs md:pl-4">
                <div className="text-right">
                  <p className="text-muted-foreground">Execuções</p>
                  <p className="font-semibold tabular-nums text-foreground">{f.runs}</p>
                </div>
                <div className="text-right">
                  <p className="text-muted-foreground">Sucesso</p>
                  <p className="font-semibold tabular-nums text-success">{f.success}</p>
                </div>
                <Switch checked={f.active} />
                <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100">
                  <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </SectionCard>

      <div className="mt-6 rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/10 to-transparent p-6">
        <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
          <div className="flex items-start gap-4">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/20 text-primary ring-1 ring-inset ring-primary/30">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold">Peça à IA para criar uma automação</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Descreva o que precisa em linguagem natural — nós montamos o fluxo pra você.
              </p>
            </div>
          </div>
          <Button className="h-9 rounded-lg bg-primary hover:bg-primary/90">
            Gerar com IA <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
