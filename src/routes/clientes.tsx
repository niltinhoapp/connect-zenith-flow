import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, Search, Filter, Download, ArrowUpDown, MoreHorizontal } from "lucide-react";
import { useEffect, useState } from "react";
import { AppLayout } from "@/components/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useCustomers } from "@/features/clientes/hooks/use-customers";
import type { Customer } from "@/features/clientes";
import { formatBRL } from "@/lib/format";
import { CustomerFormDialog } from "@/features/clientes/components/customer-form-dialog";

export const Route = createFileRoute("/clientes")({
  head: () => ({
    meta: [
      { title: "Clientes — ConnectWeb" },
      { name: "description", content: "Base completa de clientes, contatos e contas." },
    ],
  }),
  component: ClientesPage,
});

const statusStyles: Record<string, string> = {
  Ativo: "bg-success/10 text-success ring-success/25",
  Trial: "bg-warning/10 text-warning ring-warning/25",
  Inativo: "bg-muted text-muted-foreground ring-border",
};

const statusLabel: Record<string, keyof typeof statusStyles> = {
  active: "Ativo",
  vip: "Ativo",
  prospect: "Trial",
  inactive: "Inativo",
};

const tabToStatus: Record<string, string | undefined> = {
  todos: undefined,
  ativos: "active",
  trial: "prospect",
  inativos: "inactive",
  vip: "vip",
};

const PAGE_SIZE = 8;

function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

type RowVM = {
  id: string;
  name: string;
  email: string;
  company: string;
  plan: string;
  status: string;
  mrr: string;
  city: string;
  tags: string[];
};

function toRow(c: Customer): RowVM {
  const p = c.toJSON();
  return {
    id: c.id,
    name: c.displayName,
    email: p.email ?? "",
    company: p.companyName ?? "—",
    plan: "—",
    status: statusLabel[p.status] ?? "Ativo",
    mrr: formatBRL(p.lifetimeValue),
    city: p.originChannel ?? "—",
    tags: p.tags,
  };
}

function ClientesPage() {
  const [tab, setTab] = useState("todos");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const debouncedSearch = useDebounced(search);

  const { data, isLoading, isError, refetch, isFetching } = useCustomers({
    status: tabToStatus[tab],
    search: debouncedSearch || undefined,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  });

  const rows: RowVM[] = (data?.items ?? []).map(toRow);
  const total = data?.total ?? 0;
  const from = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const to = Math.min(total, (page + 1) * PAGE_SIZE);
  const hasPrev = page > 0;
  const hasNext = to < total;

  return (
    <AppLayout
      title="Clientes"
      subtitle={`${total.toLocaleString("pt-BR")} clientes`}
      actions={
        <>
          <Button variant="outline" className="h-9 rounded-lg border-border bg-card">
            <Download className="mr-1.5 h-4 w-4" /> Exportar
          </Button>
          <Button
            onClick={() => setCreateOpen(true)}
            className="h-9 rounded-lg bg-primary hover:bg-primary/90"
          >
            <Plus className="mr-1.5 h-4 w-4" /> Novo cliente
          </Button>
        </>
      }
    >
      <div className="rounded-2xl border border-border bg-card">
        <div className="flex flex-col gap-3 border-b border-border px-4 py-3 md:flex-row md:items-center md:justify-between md:px-5">
          <Tabs
            value={tab}
            onValueChange={(v) => {
              setTab(v);
              setPage(0);
            }}
          >
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
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
                placeholder="Buscar cliente..."
                className="h-9 w-full min-w-[220px] rounded-lg border-border bg-background pl-8 text-sm"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-9 rounded-lg border-border bg-background"
            >
              <Filter className="mr-1.5 h-3.5 w-3.5" /> Filtros
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="w-10 px-5 py-3">
                  <Checkbox />
                </th>
                <th className="px-4 py-3 font-medium">
                  <button className="inline-flex items-center gap-1 hover:text-foreground">
                    Cliente <ArrowUpDown className="h-3 w-3" />
                  </button>
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
              {isLoading &&
                Array.from({ length: PAGE_SIZE }).map((_, i) => (
                  <tr key={`sk-${i}`} className="border-b border-border/60 last:border-0">
                    <td className="px-5 py-3">
                      <Checkbox />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-8 w-8 rounded-full" />
                        <div className="min-w-0 space-y-1.5">
                          <Skeleton className="h-3.5 w-32" />
                          <Skeleton className="h-3 w-40" />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Skeleton className="h-3.5 w-24" />
                    </td>
                    <td className="px-4 py-3">
                      <Skeleton className="h-5 w-14 rounded-md" />
                    </td>
                    <td className="px-4 py-3">
                      <Skeleton className="h-5 w-16 rounded-md" />
                    </td>
                    <td className="px-4 py-3">
                      <Skeleton className="h-3.5 w-16" />
                    </td>
                    <td className="px-4 py-3">
                      <Skeleton className="h-3.5 w-24" />
                    </td>
                    <td className="px-4 py-3">
                      <Skeleton className="h-5 w-16 rounded-md" />
                    </td>
                    <td className="px-5 py-3" />
                  </tr>
                ))}

              {isError && (
                <tr className="border-b border-border/60 last:border-0">
                  <td colSpan={9} className="px-5 py-12 text-center">
                    <p className="text-sm text-muted-foreground">
                      Não foi possível carregar os clientes.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => refetch()}
                      className="mt-3 h-8 rounded-md border-border bg-background text-xs"
                    >
                      Tentar novamente
                    </Button>
                  </td>
                </tr>
              )}

              {!isLoading && !isError && rows.length === 0 && (
                <tr className="border-b border-border/60 last:border-0">
                  <td colSpan={9} className="px-5 py-12 text-center text-sm text-muted-foreground">
                    Nenhum cliente encontrado.
                  </td>
                </tr>
              )}

              {!isLoading &&
                !isError &&
                rows.map((r) => (
                  <tr
                    key={r.id}
                    className="group border-b border-border/60 transition-colors last:border-0 hover:bg-accent/30"
                  >
                    <td className="px-5 py-3">
                      <Checkbox />
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        to="/clientes/$id"
                        params={{ id: r.id }}
                        className="flex items-center gap-3"
                      >
                        <Avatar className="h-8 w-8 border border-border">
                          <AvatarFallback className="bg-primary/15 text-[10px] font-semibold text-primary">
                            {r.name
                              .split(" ")
                              .map((n) => n[0])
                              .slice(0, 2)
                              .join("")}
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
                      <Badge
                        variant="secondary"
                        className="rounded-md border-0 bg-muted text-[11px] text-foreground"
                      >
                        {r.plan}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset",
                          statusStyles[r.status],
                        )}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-current" /> {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium tabular-nums">{r.mrr}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.city}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {r.tags.map((t) => (
                          <Badge
                            key={t}
                            className="rounded-md border-0 bg-primary/10 text-[10px] font-medium text-primary"
                          >
                            {t}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 opacity-0 group-hover:opacity-100"
                      >
                        <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-border px-5 py-3 text-xs text-muted-foreground">
          <span>
            Mostrando {from}–{to} de {total.toLocaleString("pt-BR")}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={!hasPrev || isFetching}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="h-8 rounded-md border-border bg-background text-xs"
            >
              Anterior
            </Button>
            <Button size="sm" className="h-8 w-8 rounded-md bg-primary p-0 text-xs">
              {page + 1}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!hasNext || isFetching}
              onClick={() => setPage((p) => p + 1)}
              className="h-8 rounded-md border-border bg-background text-xs"
            >
              Próximo
            </Button>
          </div>
        </div>
      </div>

      <CustomerFormDialog open={createOpen} onOpenChange={setCreateOpen} />
    </AppLayout>
  );
}
