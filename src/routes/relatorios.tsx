import { createFileRoute, Link } from "@tanstack/react-router";
import { Download, Calendar, BarChart3, Users, RefreshCw, Database, Clock3, Info } from "lucide-react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { AppLayout } from "@/components/app-layout";
import { SectionCard } from "@/components/shared/section-card";
import { chartTooltipStyle } from "@/components/shared/chart-theme";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useReports } from "@/features/relatorios/hooks/use-reports";

export const Route = createFileRoute("/relatorios")({
  head: () => ({
    meta: [
      { title: "Relatórios — ConnectWeb" },
      { name: "description", content: "Relatórios avançados de performance e conversão." },
    ],
  }),
  component: RelatoriosPage,
});

const pieColors = ["var(--color-primary)", "var(--color-success)", "var(--color-warning)", "var(--color-muted-foreground)"];

const fmtBRL = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function RelatoriosPage() {
  const { data: m, isLoading, isFetching, isError, refetch } = useReports();
  const isEmpty = !m || (
    m.revenueTotal === 0 &&
    m.wonCount === 0 &&
    m.revenueTrend.every((point) => point.v === 0) &&
    m.funnel.every((step) => step.v === 0) &&
    m.sources.every((source) => source.v === 0)
  );

  if (isLoading) return <ReportsLoading />;

  return (
    <AppLayout
      title="Relatórios"
      subtitle="Análise consolidada de todos os módulos"
      actions={
        <>
          <Button variant="outline" className="h-9 rounded-lg border-border bg-card" disabled>
            <Calendar className="mr-1.5 h-4 w-4" /> Histórico + últimos 12 meses
          </Button>
          <Button
            className="h-9 rounded-lg bg-primary hover:bg-primary/90 print:hidden"
            disabled={isEmpty || isFetching}
            onClick={() => window.print()}
          >
            <Download className="mr-1.5 h-4 w-4" /> Imprimir / salvar PDF
          </Button>
        </>
      }
    >
      {isError ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card px-5 py-4">
          <div>
            <p className="text-sm font-medium">Não foi possível carregar os relatórios</p>
            <p className="mt-1 text-xs text-muted-foreground">Confira sua conexão e tente novamente. Nenhum número estimado foi exibido.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="h-8 rounded-md border-border bg-background text-xs">
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Tentar novamente
          </Button>
        </div>
      ) : isEmpty ? (
        <ReportsEmpty />
      ) : (
        <ReportsContent metrics={m!} />
      )}
    </AppLayout>
  );
}

function ReportsLoading() {
  return (
    <AppLayout title="Relatórios" subtitle="Análise consolidada de todos os módulos">
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="rounded-2xl border border-border bg-card p-5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-3 h-8 w-28" />
            <Skeleton className="mt-2 h-3 w-16" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Skeleton className="h-80 rounded-2xl xl:col-span-2" />
        <Skeleton className="h-80 rounded-2xl" />
      </div>
      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Skeleton className="h-72 rounded-2xl" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    </AppLayout>
  );
}

function ReportsEmpty() {
  return (
    <div className="grid min-h-[440px] place-items-center rounded-2xl border border-dashed border-border bg-card/50 px-6 py-12 text-center">
      <div className="max-w-md">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
          <BarChart3 className="h-6 w-6" />
        </div>
        <h2 className="mt-4 text-lg font-semibold">Seus relatórios aparecerão aqui</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Ainda não há movimentação suficiente nesta empresa. Cadastre clientes e registre negócios no CRM; os indicadores serão atualizados automaticamente.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Button asChild size="sm"><Link to="/clientes"><Users className="mr-1.5 h-4 w-4" /> Cadastrar clientes</Link></Button>
          <Button asChild size="sm" variant="outline"><Link to="/crm">Abrir CRM</Link></Button>
        </div>
      </div>
    </div>
  );
}

function ReportsContent({ metrics: m }: { metrics: NonNullable<ReturnType<typeof useReports>["data"]> }) {
  const trend = m.revenueTrend.map((t) => ({ m: t.m, v: Math.round(t.v / 100) }));
  const funnel = m.funnel;
  const pie = m.sources.map((s) => ({ n: s.n, v: s.v }));
  const leads = funnel.find((f) => f.s === "Leads")?.v ?? 0;
  const converted = funnel.find((f) => f.s === "Convertidos")?.v ?? 0;
  const convRate = leads > 0 ? Math.round((converted / leads) * 100) : 0;

  return (
    <>
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          { l: "Receita no CRM", v: fmtBRL(m.revenueTotal), d: "negócios ganhos · histórico" },
          { l: "Ticket médio", v: fmtBRL(m.avgTicket), d: "receita ÷ negócios ganhos" },
          { l: "Negócios ganhos", v: String(m.wonCount), d: "histórico do CRM" },
          { l: "Conversão de leads", v: `${convRate}%`, d: "convertidos ÷ leads" },
        ].map((k) => (
          <div key={k.l} className="rounded-2xl border border-border bg-card p-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">{k.l}</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{k.v}</p>
            <p className="mt-1 text-[11px] text-success">{k.d}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <SectionCard title="Evolução da receita registrada no CRM" className="xl:col-span-2" description="Negócios ganhos nos últimos 12 meses">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ left: -10, top: 5, right: 5, bottom: 0 }}>
                <defs>
                  <linearGradient id="ga" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--color-border)" />
                <XAxis dataKey="m" stroke="var(--color-muted-foreground)" tickLine={false} axisLine={false} fontSize={11} />
                <YAxis stroke="var(--color-muted-foreground)" tickLine={false} axisLine={false} fontSize={11} />
                <Tooltip contentStyle={chartTooltipStyle} />
                <Area type="monotone" dataKey="v" stroke="var(--color-primary)" fill="url(#ga)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard title="Origem dos leads" description="Distribuição por canal">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pie} dataKey="v" nameKey="n" innerRadius={55} outerRadius={90} paddingAngle={3} stroke="var(--color-card)">
                  {pie.map((_, i) => <Cell key={i} fill={pieColors[i]} />)}
                </Pie>
                <Tooltip contentStyle={chartTooltipStyle} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <SectionCard title="Funil de conversão">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={funnel} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid horizontal={false} stroke="var(--color-border)" />
                <XAxis type="number" hide />
                <YAxis dataKey="s" type="category" stroke="var(--color-muted-foreground)" tickLine={false} axisLine={false} fontSize={11} width={80} />
                <Tooltip contentStyle={chartTooltipStyle} />
                <Bar dataKey="v" fill="var(--color-primary)" radius={[0, 6, 6, 0]} barSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard title="Origem e atualização dos dados" description="Transparência dos indicadores">
          <div className="space-y-4 py-2 text-sm">
            <div className="flex gap-3">
              <Database className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div><p className="font-medium">Receita e ticket médio</p><p className="text-xs text-muted-foreground">Valores dos negócios marcados como ganhos no CRM. Não representam extrato bancário.</p></div>
            </div>
            <div className="flex gap-3">
              <Users className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div><p className="font-medium">Funil e origem</p><p className="text-xs text-muted-foreground">Leads, conversões e canais cadastrados nesta empresa.</p></div>
            </div>
            <div className="flex gap-3">
              <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div><p className="font-medium">Atualização automática</p><p className="text-xs text-muted-foreground">Consulta realizada em {new Date(m.generatedAt).toLocaleString("pt-BR")}.</p></div>
            </div>
            <div className="flex gap-2 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
              <Info className="h-4 w-4 shrink-0" /> A análise de retenção só será exibida quando houver compras recorrentes suficientes; nenhum dado de coorte é estimado.
            </div>
          </div>
        </SectionCard>
      </div>
    </>
  );
}
