import { createFileRoute } from "@tanstack/react-router";
import { Plus, Filter, MoreHorizontal, Calendar, DollarSign, GripVertical } from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/crm")({
  head: () => ({
    meta: [
      { title: "CRM Kanban — ConnectWeb" },
      { name: "description", content: "Pipeline visual de vendas com estágios personalizáveis." },
    ],
  }),
  component: CrmPage,
});

type Deal = { id: string; title: string; company: string; value: string; owner: string; tag?: string; days: number; priority?: "alta" | "media" | "baixa" };

const cols: { id: string; title: string; hint: string; deals: Deal[] }[] = [
  {
    id: "novo",
    title: "Novo lead",
    hint: "8 · R$ 84k",
    deals: [
      { id: "1", title: "Implantação CRM Nexus", company: "Nexus Ltda.", value: "R$ 12.400", owner: "MC", days: 2, tag: "Inbound", priority: "media" },
      { id: "2", title: "Migração ERP Alpha", company: "Alpha Corp", value: "R$ 24.800", owner: "DR", days: 4, tag: "Outbound", priority: "alta" },
      { id: "3", title: "Piloto WhatsApp", company: "Vento Sul", value: "R$ 3.900", owner: "RA", days: 1 },
    ],
  },
  {
    id: "qualif",
    title: "Qualificação",
    hint: "5 · R$ 62k",
    deals: [
      { id: "4", title: "Automação de cobrança", company: "Fintech Zed", value: "R$ 18.000", owner: "MC", days: 6, tag: "Enterprise", priority: "alta" },
      { id: "5", title: "Onboarding IA", company: "Studio Byte", value: "R$ 8.400", owner: "DR", days: 3 },
    ],
  },
  {
    id: "prop",
    title: "Proposta",
    hint: "4 · R$ 112k",
    deals: [
      { id: "6", title: "Contrato anual Pro", company: "Grão Digital", value: "R$ 48.000", owner: "RA", days: 9, tag: "Renovação", priority: "media" },
      { id: "7", title: "Integração ERP", company: "Metalúrgica AR", value: "R$ 32.500", owner: "MC", days: 12, priority: "alta" },
    ],
  },
  {
    id: "neg",
    title: "Negociação",
    hint: "3 · R$ 96k",
    deals: [
      { id: "8", title: "Expansão módulo IA", company: "Norte Log.", value: "R$ 62.000", owner: "DR", days: 15, priority: "alta" },
      { id: "9", title: "Add-on WhatsApp", company: "Casa Verde", value: "R$ 9.800", owner: "RA", days: 7 },
    ],
  },
  {
    id: "fechado",
    title: "Fechado",
    hint: "12 · R$ 214k",
    deals: [
      { id: "10", title: "Plano Pro anual", company: "Fábrica Criativa", value: "R$ 24.000", owner: "MC", days: 1, tag: "Ganho" },
      { id: "11", title: "Automação #14", company: "Loja Boreal", value: "R$ 6.400", owner: "RA", days: 2, tag: "Ganho" },
    ],
  },
];

const prioColor = {
  alta: "bg-destructive/15 text-destructive ring-destructive/25",
  media: "bg-warning/15 text-warning ring-warning/25",
  baixa: "bg-muted text-muted-foreground ring-border",
} as const;

function CrmPage() {
  return (
    <AppLayout
      title="CRM · Pipeline"
      subtitle="32 negócios ativos · R$ 568.000 em pipeline"
      actions={
        <>
          <Button variant="outline" className="h-9 rounded-lg border-border bg-card">
            <Filter className="mr-1.5 h-4 w-4" /> Filtros
          </Button>
          <Button className="h-9 rounded-lg bg-primary hover:bg-primary/90">
            <Plus className="mr-1.5 h-4 w-4" /> Novo negócio
          </Button>
        </>
      }
    >
      <div className="-mx-4 overflow-x-auto px-4 pb-2 md:-mx-8 md:px-8">
        <div className="flex min-w-max gap-4">
          {cols.map((col) => (
            <div key={col.id} className="w-80 shrink-0">
              <div className="mb-3 flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-primary" />
                  <h3 className="text-sm font-semibold">{col.title}</h3>
                  <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                    {col.deals.length}
                  </span>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </div>
              <p className="mb-3 px-1 text-[11px] text-muted-foreground">{col.hint}</p>

              <div className="space-y-2.5">
                {col.deals.map((d) => (
                  <article
                    key={d.id}
                    className="group cursor-grab rounded-xl border border-border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 active:cursor-grabbing"
                  >
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <h4 className="text-sm font-medium leading-snug text-foreground">{d.title}</h4>
                      <button className="opacity-0 transition-opacity group-hover:opacity-100">
                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground">{d.company}</p>

                    <div className="mt-3 flex items-center gap-1.5">
                      {d.tag && (
                        <Badge variant="secondary" className="h-5 rounded-md border-0 bg-primary/10 px-1.5 text-[10px] font-medium text-primary">
                          {d.tag}
                        </Badge>
                      )}
                      {d.priority && (
                        <Badge
                          className={cn(
                            "h-5 rounded-md border-0 px-1.5 text-[10px] font-medium ring-1 ring-inset",
                            prioColor[d.priority],
                          )}
                        >
                          {d.priority}
                        </Badge>
                      )}
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1 tabular-nums">
                          <DollarSign className="h-3 w-3" /> {d.value}
                        </span>
                        <span className="inline-flex items-center gap-1 tabular-nums">
                          <Calendar className="h-3 w-3" /> {d.days}d
                        </span>
                      </div>
                      <Avatar className="h-6 w-6 border border-border">
                        <AvatarFallback className="bg-primary/15 text-[9px] font-semibold text-primary">
                          {d.owner}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                  </article>
                ))}

                <button className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-foreground">
                  <Plus className="h-3.5 w-3.5" /> Adicionar card
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
