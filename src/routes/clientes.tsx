import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, Search, Filter, Download, ArrowUpDown, MoreHorizontal } from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/clientes")({
  head: () => ({
    meta: [
      { title: "Clientes — ConnectWeb" },
      { name: "description", content: "Base completa de clientes, contatos e contas." },
    ],
  }),
  component: ClientesPage,
});

const rows = [
  { id: "1", name: "Mariana Costa", email: "mariana@nexus.com.br", company: "Nexus Ltda.", plan: "Pro", status: "Ativo", mrr: "R$ 2.400", city: "São Paulo, BR", tags: ["Enterprise"] },
  { id: "2", name: "Diego Ramos", email: "diego@alphacorp.io", company: "Alpha Corp", plan: "Business", status: "Ativo", mrr: "R$ 4.800", city: "Rio de Janeiro, BR", tags: ["Prioridade"] },
  { id: "3", name: "Ana Beatriz", email: "ana@ventosul.com", company: "Vento Sul", plan: "Starter", status: "Trial", mrr: "R$ 0", city: "Curitiba, BR", tags: [] },
  { id: "4", name: "Rafael Andrade", email: "rafael@fintechzed.com", company: "Fintech Zed", plan: "Enterprise", status: "Ativo", mrr: "R$ 12.000", city: "São Paulo, BR", tags: ["VIP"] },
  { id: "5", name: "Camila Duarte", email: "camila@studiobyte.co", company: "Studio Byte", plan: "Pro", status: "Ativo", mrr: "R$ 2.400", city: "Porto Alegre, BR", tags: [] },
  { id: "6", name: "Luís Henrique", email: "luis@graodigital.com", company: "Grão Digital", plan: "Business", status: "Inativo", mrr: "R$ 0", city: "Belo Horizonte, BR", tags: [] },
  { id: "7", name: "Fernanda Lopes", email: "fernanda@nortelog.com", company: "Norte Log.", plan: "Enterprise", status: "Ativo", mrr: "R$ 18.400", city: "Manaus, BR", tags: ["VIP", "Enterprise"] },
  { id: "8", name: "Pedro Vitor", email: "pedro@casaverde.com", company: "Casa Verde", plan: "Pro", status: "Ativo", mrr: "R$ 2.400", city: "Florianópolis, BR", tags: [] },
];

const statusStyles: Record<string, string> = {
  Ativo: "bg-success/10 text-success ring-success/25",
  Trial: "bg-warning/10 text-warning ring-warning/25",
  Inativo: "bg-muted text-muted-foreground ring-border",
};

function ClientesPage() {
  return (
    <AppLayout
      title="Clientes"
      subtitle="1.284 clientes · R$ 214.800 em MRR"
      actions={
        <>
          <Button variant="outline" className="h-9 rounded-lg border-border bg-card">
            <Download className="mr-1.5 h-4 w-4" /> Exportar
          </Button>
          <Button className="h-9 rounded-lg bg-primary hover:bg-primary/90">
            <Plus className="mr-1.5 h-4 w-4" /> Novo cliente
          </Button>
        </>
      }
    >
      <div className="rounded-2xl border border-border bg-card">
        <div className="flex flex-col gap-3 border-b border-border px-4 py-3 md:flex-row md:items-center md:justify-between md:px-5">
          <Tabs defaultValue="todos">
            <TabsList className="h-9 rounded-lg border border-border bg-background p-0.5">
              {["Todos", "Ativos", "Trial", "Inativos", "VIP"].map((t) => (
                <TabsTrigger
                  key={t}
                  value={t.toLowerCase()}
                  className="h-8 rounded-md px-3 text-xs data-[state=active]:bg-card data-[state=active]:shadow-sm"
                >
                  {t}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Buscar cliente..." className="h-9 w-full min-w-[220px] rounded-lg border-border bg-background pl-8 text-sm" />
            </div>
            <Button variant="outline" size="sm" className="h-9 rounded-lg border-border bg-background">
              <Filter className="mr-1.5 h-3.5 w-3.5" /> Filtros
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="w-10 px-5 py-3"><Checkbox /></th>
                <th className="px-4 py-3 font-medium">
                  <button className="inline-flex items-center gap-1 hover:text-foreground">Cliente <ArrowUpDown className="h-3 w-3" /></button>
                </th>
                <th className="px-4 py-3 font-medium">Empresa</th>
                <th className="px-4 py-3 font-medium">Plano</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">MRR</th>
                <th className="px-4 py-3 font-medium">Localização</th>
                <th className="px-4 py-3 font-medium">Tags</th>
                <th className="w-12 px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="group border-b border-border/60 transition-colors last:border-0 hover:bg-accent/30">
                  <td className="px-5 py-3"><Checkbox /></td>
                  <td className="px-4 py-3">
                    <Link to="/clientes/$id" params={{ id: r.id }} className="flex items-center gap-3">
                      <Avatar className="h-8 w-8 border border-border">
                        <AvatarFallback className="bg-primary/15 text-[10px] font-semibold text-primary">
                          {r.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{r.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{r.email}</p>
                      </div>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{r.company}</td>
                  <td className="px-4 py-3">
                    <Badge variant="secondary" className="rounded-md border-0 bg-muted text-[11px] text-foreground">{r.plan}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn("inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset", statusStyles[r.status])}>
                      <span className="h-1.5 w-1.5 rounded-full bg-current" /> {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium tabular-nums">{r.mrr}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.city}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {r.tags.map((t) => (
                        <Badge key={t} className="rounded-md border-0 bg-primary/10 text-[10px] font-medium text-primary">
                          {t}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100">
                      <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-border px-5 py-3 text-xs text-muted-foreground">
          <span>Mostrando 1–8 de 1.284</span>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" className="h-8 rounded-md border-border bg-background text-xs">Anterior</Button>
            <Button size="sm" className="h-8 w-8 rounded-md bg-primary p-0 text-xs">1</Button>
            <Button variant="outline" size="sm" className="h-8 w-8 rounded-md border-border bg-background p-0 text-xs">2</Button>
            <Button variant="outline" size="sm" className="h-8 w-8 rounded-md border-border bg-background p-0 text-xs">3</Button>
            <Button variant="outline" size="sm" className="h-8 rounded-md border-border bg-background text-xs">Próximo</Button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
