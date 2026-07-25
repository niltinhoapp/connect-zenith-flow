import { createFileRoute } from "@tanstack/react-router";
import { Download, Calendar } from "lucide-react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Line, LineChart,
} from "recharts";
import { AppLayout } from "@/components/app-layout";
import { SectionCard } from "@/components/premium";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/relatorios")({
  head: () => ({
    meta: [
      { title: "Relatórios — ConnectWeb" },
      { name: "description", content: "Relatórios avançados de performance e conversão." },
    ],
  }),
  component: RelatoriosPage,
});

const trend = Array.from({ length: 12 }, (_, i) => ({
  m: ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"][i],
  v: 4000 + Math.round(Math.sin(i / 2) * 1500) + i * 220,
}));

const funnel = [
  { s: "Visitantes", v: 100 },
  { s: "Leads", v: 62 },
  { s: "MQL", v: 41 },
  { s: "SQL", v: 24 },
  { s: "Clientes", v: 12 },
];

const pie = [
  { n: "WhatsApp", v: 48 },
  { n: "E-mail", v: 24 },
  { n: "Web", v: 18 },
  { n: "Outros", v: 10 },
];
const pieColors = ["var(--color-primary)", "var(--color-success)", "var(--color-warning)", "var(--color-muted-foreground)"];

const cohort = Array.from({ length: 6 }, (_, i) => ({
  w: `S${i + 1}`,
  a: 100,
  b: 100 - i * 8,
  c: 100 - i * 14,
}));

function RelatoriosPage() {
  return (
    <AppLayout
      title="Relatórios"
      subtitle="Análise consolidada de todos os módulos"
      actions={
        <>
          <Button variant="outline" className="h-9 rounded-lg border-border bg-card">
            <Calendar className="mr-1.5 h-4 w-4" /> Últimos 90 dias
          </Button>
          <Button className="h-9 rounded-lg bg-primary hover:bg-primary/90">
            <Download className="mr-1.5 h-4 w-4" /> Exportar PDF
          </Button>
        </>
      }
    >
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          { l: "Receita total", v: "R$ 1,24M", d: "+18,2%" },
          { l: "Ticket médio", v: "R$ 2.148", d: "+4,6%" },
          { l: "Retenção", v: "94,1%", d: "+1,2pp" },
          { l: "Churn", v: "1,8%", d: "-0,3pp" },
        ].map((k) => (
          <div key={k.l} className="rounded-2xl border border-border bg-card p-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">{k.l}</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{k.v}</p>
            <p className="mt-1 text-[11px] text-success">{k.d}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <SectionCard title="Evolução de receita" className="xl:col-span-2" description="Últimos 12 meses">
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
                <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 12, fontSize: 12 }} />
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
                <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 12, fontSize: 12 }} />
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
                <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 12, fontSize: 12 }} />
                <Bar dataKey="v" fill="var(--color-primary)" radius={[0, 6, 6, 0]} barSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard title="Retenção por coorte">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={cohort} margin={{ left: -10, top: 5, right: 5, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--color-border)" />
                <XAxis dataKey="w" stroke="var(--color-muted-foreground)" tickLine={false} axisLine={false} fontSize={11} />
                <YAxis stroke="var(--color-muted-foreground)" tickLine={false} axisLine={false} fontSize={11} />
                <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 12, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
                <Line type="monotone" dataKey="a" stroke="var(--color-primary)" strokeWidth={2} dot={false} name="Coorte A" />
                <Line type="monotone" dataKey="b" stroke="var(--color-success)" strokeWidth={2} dot={false} name="Coorte B" />
                <Line type="monotone" dataKey="c" stroke="var(--color-warning)" strokeWidth={2} dot={false} name="Coorte C" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      </div>
    </AppLayout>
  );
}
