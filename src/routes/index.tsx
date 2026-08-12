import { createFileRoute } from "@tanstack/react-router";
import {
  Users,
  MessageCircle,
  Workflow,
  DollarSign,
  CheckCircle2,
  Clock,
  Sparkles,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppLayout } from "@/components/app-layout";
import { KpiCard } from "@/components/shared/kpi-card";
import { SectionCard } from "@/components/shared/section-card";
import { chartTooltipStyle } from "@/components/shared/chart-theme";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboard } from "@/features/dashboard/hooks/use-dashboard";
import { useSession } from "@/core/auth";
import { PriorityQueueCard } from "@/features/whatsapp/components/insights";
import {
  formatBRLCompact as fmtBRL,
  formatInt as fmtInt,
  relativeTime as relTime,
} from "@/lib/format";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — ConnectWeb Automations" },
      {
        name: "description",
        content: "Visão geral do desempenho do seu workspace: CRM, WhatsApp, automações e IA.",
      },
    ],
  }),
  component: DashboardPage,
});

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function weekdayPt(dateStr: string): string {
  return WEEKDAYS[new Date(dateStr).getDay()] ?? "";
}
function activityColor(eventType: string): string {
  if (eventType.includes("won")) return "bg-success";
  if (eventType.includes("lost") || eventType.includes("failed")) return "bg-destructive";
  if (eventType.includes("created") || eventType.includes("converted")) return "bg-primary";
  return "bg-warning";
}

function DashboardPage() {
  const { data: m, isLoading, isError, refetch } = useDashboard();
  const dash = (value: string) => (isLoading ? "—" : value);
  const session = useSession();
  const modules = session?.enabledModules ?? [];
  const cockpitEnabled = modules.includes("whatsapp") && modules.includes("ia");

  const revenueData = (m?.revenueSeries ?? []).map((p) => ({
    d: weekdayPt(p.date),
    v: Math.round(p.v / 100),
    l: p.l,
  }));
  const channelData = (m?.pipeline ?? []).map((p) => ({ c: p.stage, v: p.count }));
  const activity = m?.recentActivities ?? [];

  return (
    <AppLayout title="Dashboard" subtitle="Aqui está o resumo do seu workspace.">
      {isError && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card px-5 py-4">
          <p className="text-sm text-muted-foreground">Não foi possível carregar os indicadores.</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="h-8 rounded-md border-border bg-background text-xs"
          >
            Tentar novamente
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Receita (mês)"
          value={dash(fmtBRL(m?.revenue ?? 0))}
          icon={<DollarSign className="h-4 w-4" />}
        />
        <KpiCard
          label="Clientes ativos"
          value={dash(fmtInt(m?.activeCustomers ?? 0))}
          icon={<Users className="h-4 w-4" />}
        />
        <KpiCard
          label="Leads (30d)"
          value={dash(fmtInt(m?.leadsPeriod ?? 0))}
          icon={<MessageCircle className="h-4 w-4" />}
        />
        <KpiCard
          label="Negócios em aberto"
          value={dash(fmtInt(m?.openDeals ?? 0))}
          icon={<Workflow className="h-4 w-4" />}
        />
      </div>

      {cockpitEnabled && (
        <div className="mt-6">
          <PriorityQueueCard />
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <SectionCard
          className="xl:col-span-2"
          title="Receita & Leads"
          description="Comparativo dos últimos 7 dias"
        >
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueData} margin={{ left: -10, right: 0, top: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-success)" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="var(--color-success)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--color-border)" />
                <XAxis
                  dataKey="d"
                  stroke="var(--color-muted-foreground)"
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                />
                <YAxis
                  stroke="var(--color-muted-foreground)"
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                />
                <Tooltip contentStyle={chartTooltipStyle} />
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke="var(--color-primary)"
                  fill="url(#g1)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="l"
                  stroke="var(--color-success)"
                  fill="url(#g2)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard title="Canais de aquisição" description="Distribuição por canal">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={channelData} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid horizontal={false} stroke="var(--color-border)" />
                <XAxis type="number" hide />
                <YAxis
                  dataKey="c"
                  type="category"
                  stroke="var(--color-muted-foreground)"
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                  width={70}
                />
                <Tooltip contentStyle={chartTooltipStyle} />
                <Bar dataKey="v" fill="var(--color-primary)" radius={[0, 6, 6, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      </div>

      <div className="mt-6">
        <SectionCard title="Atividade recente" description="Últimas ações do workspace">
          <ul className="divide-y divide-border">
            {isLoading &&
              Array.from({ length: 5 }).map((_, i) => (
                <li key={`sk-${i}`} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-muted" />
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-48" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-3 w-10" />
                </li>
              ))}
            {!isLoading && activity.length === 0 && (
              <li className="py-8 text-center text-sm text-muted-foreground">
                Nenhuma atividade recente.
              </li>
            )}
            {!isLoading &&
              activity.map((a) => (
                <li key={a.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${activityColor(a.eventType)} shadow-[0_0_8px_currentColor]`}
                  />
                  <Avatar className="h-8 w-8 border border-border">
                    <AvatarFallback className="bg-muted text-[11px] font-semibold">
                      {a.title
                        .split(" ")
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join("")}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-foreground">
                      <span className="font-medium">{a.title}</span>{" "}
                      <span className="text-muted-foreground">— {a.eventType}</span>
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{a.module ?? ""}</p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {relTime(a.createdAt)}
                  </span>
                </li>
              ))}
          </ul>
        </SectionCard>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        {[
          {
            i: CheckCircle2,
            l: "Taxa de conversão",
            v: dash(`${m?.conversionRate ?? 0}%`),
            d: "30 dias",
          },
          { i: Clock, l: "Ticket médio", v: dash(fmtBRL(m?.avgTicket ?? 0)), d: "por negócio" },
          { i: Sparkles, l: "Negócios ganhos", v: dash(fmtInt(m?.wonCount ?? 0)), d: "no mês" },
        ].map((k) => (
          <div
            key={k.l}
            className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4"
          >
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/20">
              <k.i className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs text-muted-foreground">{k.l}</p>
              <p className="truncate text-lg font-semibold tabular-nums">{k.v}</p>
            </div>
            <Badge
              variant="secondary"
              className="rounded-md border-0 bg-muted text-[11px] text-muted-foreground"
            >
              {k.d}
            </Badge>
          </div>
        ))}
      </div>
    </AppLayout>
  );
}
