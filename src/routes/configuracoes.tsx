import { createFileRoute } from "@tanstack/react-router";
import { User, Building2, CreditCard, Bell, Shield, Plug, Key, ChevronRight, Check } from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { SectionCard } from "@/components/premium";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export const Route = createFileRoute("/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações — ConnectWeb" },
      { name: "description", content: "Preferências, conta, cobrança e integrações." },
    ],
  }),
  component: ConfigPage,
});

const menu = [
  { i: User, l: "Perfil", d: "Dados pessoais e senha", active: true },
  { i: Building2, l: "Workspace", d: "Nome, logo e domínio" },
  { i: CreditCard, l: "Cobrança", d: "Plano e faturas" },
  { i: Bell, l: "Notificações", d: "E-mail e push" },
  { i: Shield, l: "Segurança", d: "2FA e sessões" },
  { i: Plug, l: "Integrações", d: "APIs e apps conectados" },
  { i: Key, l: "API Keys", d: "Chaves e webhooks" },
];

function ConfigPage() {
  return (
    <AppLayout
      title="Configurações"
      subtitle="Gerencie sua conta, workspace e integrações"
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_1fr]">
        <aside className="rounded-2xl border border-border bg-card p-2">
          <ul className="space-y-0.5">
            {menu.map((m) => (
              <li key={m.l}>
                <button
                  className={
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors " +
                    (m.active
                      ? "bg-primary/10 text-foreground ring-1 ring-inset ring-primary/25"
                      : "text-muted-foreground hover:bg-accent/40 hover:text-foreground")
                  }
                >
                  <m.i className={"h-4 w-4 " + (m.active ? "text-primary" : "text-muted-foreground")} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{m.l}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{m.d}</p>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60" />
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <div className="space-y-4">
          <SectionCard title="Perfil" description="Suas informações pessoais">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16 border border-border">
                <AvatarFallback className="bg-primary/15 text-lg font-semibold text-primary">RA</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="text-sm font-medium">Foto de perfil</p>
                <p className="text-xs text-muted-foreground">PNG ou JPG até 2MB</p>
              </div>
              <Button variant="outline" className="rounded-lg border-border bg-background">Trocar foto</Button>
            </div>

            <Separator className="my-6 bg-border" />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label className="text-xs">Nome completo</Label>
                <Input defaultValue="Rafael Alves" className="mt-1.5 h-10 rounded-lg border-border bg-background" />
              </div>
              <div>
                <Label className="text-xs">E-mail</Label>
                <Input defaultValue="rafael@connectweb.com" className="mt-1.5 h-10 rounded-lg border-border bg-background" />
              </div>
              <div>
                <Label className="text-xs">Cargo</Label>
                <Input defaultValue="Head of Product" className="mt-1.5 h-10 rounded-lg border-border bg-background" />
              </div>
              <div>
                <Label className="text-xs">Fuso horário</Label>
                <Input defaultValue="America/São Paulo (GMT-3)" className="mt-1.5 h-10 rounded-lg border-border bg-background" />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <Button variant="ghost" className="rounded-lg">Cancelar</Button>
              <Button className="rounded-lg bg-primary hover:bg-primary/90">Salvar alterações</Button>
            </div>
          </SectionCard>

          <SectionCard title="Preferências" description="Notificações e comportamento">
            {[
              { t: "Notificações por e-mail", d: "Receba resumos diários e alertas críticos", v: true },
              { t: "Notificações push", d: "Alertas em tempo real no navegador", v: true },
              { t: "Modo compacto", d: "Reduz o espaçamento entre elementos", v: false },
              { t: "Analytics de uso", d: "Ajuda a melhorar o produto (anônimo)", v: true },
            ].map((p, i, arr) => (
              <div key={p.t}>
                <div className="flex items-center justify-between py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{p.t}</p>
                    <p className="text-xs text-muted-foreground">{p.d}</p>
                  </div>
                  <Switch defaultChecked={p.v} />
                </div>
                {i < arr.length - 1 && <Separator className="bg-border" />}
              </div>
            ))}
          </SectionCard>

          <SectionCard title="Plano atual" description="Pro · Cobrado mensalmente">
            <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
              <div>
                <div className="flex items-center gap-2">
                  <Badge className="rounded-md border-0 bg-primary/15 text-xs font-semibold text-primary">Pro</Badge>
                  <span className="text-sm text-muted-foreground">R$ 349 / mês</span>
                </div>
                <ul className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                  {["Automações ilimitadas", "10 usuários", "150k créditos IA/mês", "Suporte prioritário"].map((f) => (
                    <li key={f} className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-success" /> {f}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="rounded-lg border-border bg-background">Ver faturas</Button>
                <Button className="rounded-lg bg-primary hover:bg-primary/90">Upgrade Enterprise</Button>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>
    </AppLayout>
  );
}
