import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  Building2,
  MessageCircle,
  Edit3,
  MoreHorizontal,
  CheckCircle2,
} from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { SectionCard } from "@/components/shared/section-card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useCustomer } from "@/features/clientes/hooks/use-customers";
import { useCustomerTimeline } from "@/features/clientes/hooks/use-timeline";
import { useDeals } from "@/features/crm/hooks/use-deals";
import { initials, formatBRL as fmtBRL, relativeTime as relTime } from "@/lib/format";
import { CustomerFormDialog } from "@/features/clientes/components/customer-form-dialog";

export const Route = createFileRoute("/clientes/$id")({
  head: () => ({
    meta: [
      { title: "Perfil do cliente — ConnectWeb" },
      { name: "description", content: "Visão 360º do cliente: negócios, atividades e histórico." },
    ],
  }),
  component: ClienteDetalhe,
});

const statusBadge: Record<string, string> = {
  active: "bg-success/10 text-success ring-success/25",
  vip: "bg-primary/10 text-primary ring-primary/25",
  prospect: "bg-warning/10 text-warning ring-warning/25",
  inactive: "bg-muted text-muted-foreground ring-border",
};
const statusText: Record<string, string> = {
  active: "Ativo",
  vip: "VIP",
  prospect: "Prospect",
  inactive: "Inativo",
};

function ClienteDetalhe() {
  const { id } = Route.useParams();
  const [editOpen, setEditOpen] = useState(false);
  const { data: customer, isLoading, isError } = useCustomer(id);
  const { data: timeline = [], isLoading: tLoading } = useCustomerTimeline(id);
  const { data: dealsData } = useDeals({ customerId: id });

  const p = customer?.toJSON();
  const name = customer?.displayName ?? "";
  const status = p?.status ?? "active";
  const deals = dealsData?.items ?? [];

  return (
    <AppLayout>
      <div className="mb-6 flex items-center gap-2 text-xs text-muted-foreground">
        <Link to="/clientes" className="inline-flex items-center gap-1 hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Clientes
        </Link>
        <span>/</span>
        <span className="text-foreground">{isLoading ? "…" : name}</span>
      </div>

      {isError && (
        <div className="mb-6 rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
          Não foi possível carregar o cliente.
        </div>
      )}

      <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 md:flex-row md:items-center">
        <Avatar className="h-16 w-16 border border-border">
          <AvatarFallback className="bg-primary/15 text-lg font-semibold text-primary">
            {isLoading ? "…" : initials(name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold tracking-tight">
              {isLoading ? <Skeleton className="h-6 w-40" /> : name}
            </h2>
            {!isLoading && (
              <Badge
                className={`rounded-md border-0 text-[11px] font-medium ring-1 ring-inset ${statusBadge[status]}`}
              >
                {statusText[status] ?? status}
              </Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{p?.companyName ?? ""}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" className="h-9 rounded-lg border-border bg-background">
            <MessageCircle className="mr-1.5 h-4 w-4" /> Enviar WhatsApp
          </Button>
          <Button
            variant="outline"
            disabled={!customer}
            onClick={() => setEditOpen(true)}
            className="h-9 rounded-lg border-border bg-background"
          >
            <Edit3 className="mr-1.5 h-4 w-4" /> Editar
          </Button>
          <Button className="h-9 rounded-lg bg-primary hover:bg-primary/90">Nova ação</Button>
          <Button variant="ghost" size="icon" className="h-9 w-9">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              { l: "LTV", v: p ? fmtBRL(p.lifetimeValue) : "—" },
              { l: "Score", v: p?.score != null ? `${p.score} / 100` : "—" },
              { l: "Negócios", v: String(deals.length) },
            ].map((k) => (
              <div key={k.l} className="rounded-xl border border-border bg-card p-4">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{k.l}</p>
                <p className="mt-1.5 text-xl font-semibold tabular-nums">{k.v}</p>
              </div>
            ))}
          </div>

          <SectionCard title="Timeline de atividades" description="Interações e automações">
            <ol className="relative space-y-4 pl-6">
              <span className="absolute left-2 top-1 h-full w-px bg-border" />
              {tLoading && (
                <li className="relative">
                  <span className="absolute -left-[22px] top-1 grid h-4 w-4 place-items-center rounded-full bg-background ring-2 ring-border" />
                  <Skeleton className="h-3.5 w-56" />
                  <Skeleton className="mt-1 h-3 w-32" />
                </li>
              )}
              {!tLoading && timeline.length === 0 && (
                <li className="relative text-sm text-muted-foreground">
                  Sem atividades registradas ainda.
                </li>
              )}
              {!tLoading &&
                timeline.map((t) => (
                  <li key={t.id} className="relative">
                    <span className="absolute -left-[22px] top-1 grid h-4 w-4 place-items-center rounded-full bg-background ring-2 ring-border">
                      <CheckCircle2 className="h-3 w-3 text-success" />
                    </span>
                    <p className="text-sm text-foreground">{t.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {relTime(t.createdAt)} · {t.module ?? t.eventType}
                    </p>
                  </li>
                ))}
            </ol>
          </SectionCard>

          <SectionCard
            title="Negócios ativos"
            description={`${deals.length} oportunidades relacionadas`}
          >
            <ul className="divide-y divide-border">
              {deals.length === 0 && (
                <li className="py-6 text-center text-sm text-muted-foreground">
                  Nenhum negócio relacionado.
                </li>
              )}
              {deals.map((deal) => {
                const dp = deal.toJSON();
                const stage = dp.wonAt ? "Ganho" : dp.lostAt ? "Perdido" : "Em aberto";
                return (
                  <li
                    key={deal.id}
                    className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                  >
                    <div>
                      <p className="text-sm font-medium">{dp.title}</p>
                      <p className="text-xs text-muted-foreground">{stage}</p>
                    </div>
                    <span className="text-sm font-semibold tabular-nums">{fmtBRL(dp.amount)}</span>
                  </li>
                );
              })}
            </ul>
          </SectionCard>
        </div>

        <div className="space-y-4">
          <SectionCard title="Informações">
            <dl className="space-y-3 text-sm">
              {[
                { i: Mail, l: "E-mail", v: p?.email ?? "—" },
                { i: Phone, l: "Telefone", v: p?.phone ?? "—" },
                { i: Building2, l: "Empresa", v: p?.companyName ?? "—" },
                { i: MapPin, l: "Origem", v: p?.originChannel ?? "—" },
              ].map((it) => (
                <div key={it.l} className="flex items-start gap-3">
                  <it.i className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      {it.l}
                    </dt>
                    <dd className="truncate text-foreground">{it.v}</dd>
                  </div>
                </div>
              ))}
            </dl>
          </SectionCard>

          <SectionCard title="Notas rápidas">
            <p className="text-sm text-muted-foreground">{p?.notes || "Sem notas."}</p>
            <Separator className="my-4 bg-border" />
            <div className="flex flex-wrap gap-1.5">
              {(p?.tags ?? []).map((t) => (
                <Badge
                  key={t}
                  className="rounded-md border-0 bg-muted text-[10px] text-muted-foreground"
                >
                  #{t}
                </Badge>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>

      <CustomerFormDialog open={editOpen} onOpenChange={setEditOpen} customer={customer} />
    </AppLayout>
  );
}
