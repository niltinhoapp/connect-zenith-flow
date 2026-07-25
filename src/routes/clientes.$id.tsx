import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Mail, Phone, MapPin, Building2, MessageCircle, Edit3, MoreHorizontal, CheckCircle2, Circle } from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { SectionCard } from "@/components/premium";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";

export const Route = createFileRoute("/clientes/$id")({
  head: () => ({
    meta: [
      { title: "Perfil do cliente — ConnectWeb" },
      { name: "description", content: "Visão 360º do cliente: negócios, atividades e histórico." },
    ],
  }),
  component: ClienteDetalhe,
});

const timeline = [
  { d: "Hoje · 14:22", act: "Reunião de discovery realizada", who: "Rafael Alves", type: "done" },
  { d: "Ontem · 09:14", act: "Proposta comercial enviada por e-mail", who: "Mariana Costa", type: "done" },
  { d: "3 dias atrás", act: "Automação 'Boas-vindas' concluída", who: "Sistema", type: "done" },
  { d: "5 dias atrás", act: "Ligação de qualificação", who: "Diego Ramos", type: "done" },
  { d: "Amanhã · 10:00", act: "Follow-up agendado", who: "Rafael Alves", type: "todo" },
];

function ClienteDetalhe() {
  return (
    <AppLayout>
      <div className="mb-6 flex items-center gap-2 text-xs text-muted-foreground">
        <Link to="/clientes" className="inline-flex items-center gap-1 hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Clientes
        </Link>
        <span>/</span>
        <span className="text-foreground">Mariana Costa</span>
      </div>

      <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 md:flex-row md:items-center">
        <Avatar className="h-16 w-16 border border-border">
          <AvatarFallback className="bg-primary/15 text-lg font-semibold text-primary">MC</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold tracking-tight">Mariana Costa</h2>
            <Badge className="rounded-md border-0 bg-success/10 text-[11px] font-medium text-success ring-1 ring-inset ring-success/25">
              Ativo
            </Badge>
            <Badge className="rounded-md border-0 bg-primary/10 text-[11px] font-medium text-primary">Pro</Badge>
            <Badge className="rounded-md border-0 bg-muted text-[11px] font-medium text-muted-foreground">Enterprise</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Head of Operations · Nexus Ltda.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" className="h-9 rounded-lg border-border bg-background">
            <MessageCircle className="mr-1.5 h-4 w-4" /> Enviar WhatsApp
          </Button>
          <Button variant="outline" className="h-9 rounded-lg border-border bg-background">
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
              { l: "MRR", v: "R$ 2.400" },
              { l: "LTV estimado", v: "R$ 48.900" },
              { l: "Health score", v: "92 / 100" },
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
              {timeline.map((t, i) => (
                <li key={i} className="relative">
                  <span className="absolute -left-[22px] top-1 grid h-4 w-4 place-items-center rounded-full bg-background ring-2 ring-border">
                    {t.type === "done" ? (
                      <CheckCircle2 className="h-3 w-3 text-success" />
                    ) : (
                      <Circle className="h-3 w-3 text-primary" />
                    )}
                  </span>
                  <p className="text-sm text-foreground">{t.act}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.d} · {t.who}
                  </p>
                </li>
              ))}
            </ol>
          </SectionCard>

          <SectionCard title="Negócios ativos" description="4 oportunidades relacionadas">
            <ul className="divide-y divide-border">
              {[
                { t: "Contrato anual Pro", v: "R$ 48.000", s: "Proposta" },
                { t: "Add-on WhatsApp", v: "R$ 9.800", s: "Negociação" },
                { t: "Migração módulo IA", v: "R$ 24.000", s: "Qualificação" },
              ].map((d) => (
                <li key={d.t} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                  <div>
                    <p className="text-sm font-medium">{d.t}</p>
                    <p className="text-xs text-muted-foreground">{d.s}</p>
                  </div>
                  <span className="text-sm font-semibold tabular-nums">{d.v}</span>
                </li>
              ))}
            </ul>
          </SectionCard>
        </div>

        <div className="space-y-4">
          <SectionCard title="Informações">
            <dl className="space-y-3 text-sm">
              {[
                { i: Mail, l: "E-mail", v: "mariana@nexus.com.br" },
                { i: Phone, l: "Telefone", v: "+55 11 98123-4455" },
                { i: Building2, l: "Empresa", v: "Nexus Ltda." },
                { i: MapPin, l: "Localização", v: "São Paulo, BR" },
              ].map((it) => (
                <div key={it.l} className="flex items-start gap-3">
                  <it.i className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">{it.l}</dt>
                    <dd className="truncate text-foreground">{it.v}</dd>
                  </div>
                </div>
              ))}
            </dl>
          </SectionCard>

          <SectionCard title="Notas rápidas">
            <p className="text-sm text-muted-foreground">
              Cliente estratégico do segmento retail. Interesse em módulo de IA para roteamento automático.
              Próxima renovação em 12/03.
            </p>
            <Separator className="my-4 bg-border" />
            <div className="flex flex-wrap gap-1.5">
              {["retail", "renovação-Q1", "vip", "roteamento-ia"].map((t) => (
                <Badge key={t} className="rounded-md border-0 bg-muted text-[10px] text-muted-foreground">
                  #{t}
                </Badge>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>
    </AppLayout>
  );
}
