import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowUpRight,
  Users,
  MessageCircle,
  Workflow,
  DollarSign,
  Zap,
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
import { Progress } from "@/components/ui/progress";

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

const revenueData = [
  { d: "Seg", v: 12400, l: 8200 },
  { d: "Ter", v: 14800, l: 9100 },
  { d: "Qua", v: 13200, l: 8600 },
  { d: "Qui", v: 17600, l: 10400 },
  { d: "Sex", v: 21200, l: 12800 },
  { d: "Sáb", v: 18400, l: 11200 },
  { d: "Dom", v: 24800, l: 14600 },
];

const channelData = [
  { c: "WhatsApp", v: 4820 },
  { c: "E-mail", v: 2140 },
  { c: "Web", v: 1680 },
  { c: "API", v: 940 },
  { c: "SMS", v: 520 },
];

const activity = [
  { name: "Mariana Costa", act: "Fechou negócio", value: "R$ 24.800", ago: "há 4min", color: "bg-success" },
  { name: "Automação #14", act: "Enviou 128 mensagens", value: "WhatsApp", ago: "há 12min", color: "bg-primary" },
  { name: "IA Copilot", act: "Qualificou 8 leads", value: "8 leads", ago: "há 22min", color: "bg-warning" },
  { name: "Diego Ramos", act: "Novo cliente", value: "Nexus Ltda.", ago: "há 41min", color: "bg-success" },
  { name: "Automação #07", act: "Falha em etapa", value: "Retry x2", ago: "há 1h", color: "bg-destructive" },
];

function DashboardPage() {
  return (
    <AppLayout
      title="Dashboard"
      subtitle="Bem-vindo de volta, Rafael. Aqui está o resumo do seu workspace."
      actions={
        <>
          <Button variant="outline" className="h-9 rounded-lg border-border bg-card">
            Últimos 7 dias
          </Button>
          <Button className="h-9 rounded-lg bg-primary hover:bg-primary/90">
            <Sparkles className="mr-1.5 h-4 w-4" /> Insights IA
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Receita (7d)" value="R$ 128.4k" delta="+12,4%" trend="up" icon={<DollarSign className="h-4 w-4" />} />
        <KpiCard label="Novos clientes" value="342" delta="+8,1%" trend="up" icon={<Users className="h-4 w-4" />} />
        <KpiCard label="Mensagens WhatsApp" value="12.842" delta="+21,7%" trend="up" icon={<MessageCircle className="h-4 w-4" />} />
        <KpiCard label="Automações ativas" value="47" delta="-2" trend="down" icon={<Workflow className="h-4 w-4" />} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <SectionCard
          className="xl:col-span-2"
          title="Receita & Leads"
          description="Comparativo dos últimos 7 dias"
          action={
            <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground">
              Exportar <ArrowUpRight className="ml-1 h-3 w-3" />
            </Button>
          }
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
                <XAxis dataKey="d" stroke="var(--color-muted-foreground)" tickLine={false} axisLine={false} fontSize={11} />
                <YAxis stroke="var(--color-muted-foreground)" tickLine={false} axisLine={false} fontSize={11} />
                <Tooltip contentStyle={chartTooltipStyle} />
                <Area type="monotone" dataKey="v" stroke="var(--color-primary)" fill="url(#g1)" strokeWidth={2} />
                <Area type="monotone" dataKey="l" stroke="var(--color-success)" fill="url(#g2)" strokeWidth={2} />
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
                <YAxis dataKey="c" type="category" stroke="var(--color-muted-foreground)" tickLine={false} axisLine={false} fontSize={11} width={70} />
                <Tooltip contentStyle={chartTooltipStyle} />
                <Bar dataKey="v" fill="var(--color-primary)" radius={[0, 6, 6, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <SectionCard title="Atividade recente" description="Últimas ações do workspace" className="xl:col-span-2">
          <ul className="divide-y divide-border">
            {activity.map((a, i) => (
              <li key={i} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <span className={`h-2 w-2 shrink-0 rounded-full ${a.color} shadow-[0_0_8px_currentColor]`} />
                <Avatar className="h-8 w-8 border border-border">
                  <AvatarFallback className="bg-muted text-[11px] font-semibold">
                    {a.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-foreground">
                    <span className="font-medium">{a.name}</span>{" "}
                    <span className="text-muted-foreground">— {a.act}</span>
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{a.value}</p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{a.ago}</span>
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard title="Metas do mês" description="Progresso do time comercial">
          <div className="space-y-5">
            {[
              { l: "Receita", v: 72, s: "R$ 728k / R$ 1M" },
              { l: "Novos clientes", v: 88, s: "422 / 480" },
              { l: "Automações", v: 46, s: "23 / 50" },
              { l: "SLA WhatsApp", v: 94, s: "94% em <2min" },
            ].map((m) => (
              <div key={m.l}>
                <div className="mb-2 flex items-center justify-between text-xs">
                  <span className="font-medium text-foreground">{m.l}</span>
                  <span className="text-muted-foreground tabular-nums">{m.s}</span>
                </div>
                <Progress value={m.v} className="h-1.5 bg-muted" />
              </div>
            ))}
          </div>
          <div className="mt-6 rounded-xl border border-primary/25 bg-primary/5 p-4">
            <div className="flex items-start gap-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary ring-1 ring-inset ring-primary/25">
                <Zap className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium">Você está +12% acima da meta semanal</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Sugestão IA: ativar rotina de reengajamento em leads frios.
                </p>
              </div>
            </div>
          </div>
        </SectionCard>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        {[
          { i: CheckCircle2, l: "Taxa de conversão", v: "24,8%", d: "+3,2 pp" },
          { i: Clock, l: "Tempo médio de resposta", v: "1m 42s", d: "-18s" },
          { i: Sparkles, l: "Créditos IA restantes", v: "142.320", d: "Plano Pro" },
        ].map((k) => (
          <div key={k.l} className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/20">
              <k.i className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs text-muted-foreground">{k.l}</p>
              <p className="truncate text-lg font-semibold tabular-nums">{k.v}</p>
            </div>
            <Badge variant="secondary" className="rounded-md border-0 bg-muted text-[11px] text-muted-foreground">
              {k.d}
            </Badge>
          </div>
        ))}
      </div>
    </AppLayout>
  );
}
