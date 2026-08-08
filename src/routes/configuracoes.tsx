import { useEffect, useState } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import {
  User,
  Building2,
  CreditCard,
  Bell,
  Shield,
  Plug,
  Key,
  ChevronRight,
  Check,
  Loader2,
  MessageCircle,
  LockKeyhole,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { AppLayout } from "@/components/app-layout";
import { SectionCard } from "@/components/shared/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { can, PERMISSIONS } from "@/core/permissions";
import { requestPasswordReset, useSession } from "@/core/auth";
import { plans, defaultPlanId, type PlanId } from "@/config/plans";
import {
  updateProfileSchema,
  updateWorkspaceSchema,
  useSettings,
  useUpdateProfile,
  useUpdateWorkspace,
  type UpdateProfileInput,
  type UpdateWorkspaceInput,
} from "@/features/configuracoes";

export const Route = createFileRoute("/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações — ConnectWeb" },
      { name: "description", content: "Preferências, conta, cobrança e integrações." },
    ],
  }),
  component: ConfigPage,
});

type Section = "profile" | "workspace" | "billing" | "notifications" | "security" | "integrations" | "api";

const menu: Array<{ id: Section; i: typeof User; l: string; d: string }> = [
  { id: "profile", i: User, l: "Perfil", d: "Dados pessoais e senha" },
  { id: "workspace", i: Building2, l: "Workspace", d: "Empresa e módulos" },
  { id: "billing", i: CreditCard, l: "Cobrança", d: "Plano e limites" },
  { id: "notifications", i: Bell, l: "Notificações", d: "Preferências locais" },
  { id: "security", i: Shield, l: "Segurança", d: "Senha e acesso" },
  { id: "integrations", i: Plug, l: "Integrações", d: "WhatsApp e provedores" },
  { id: "api", i: Key, l: "API Keys", d: "Chaves e webhooks" },
];

function ConfigPage() {
  const [section, setSection] = useState<Section>("profile");
  const settings = useSettings();

  return (
    <AppLayout title="Configurações" subtitle="Gerencie sua conta, empresa e integrações">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_1fr]">
        <aside className="h-fit rounded-2xl border border-border bg-card p-2">
          <ul className="space-y-0.5">
            {menu.map((item) => {
              const active = section === item.id;
              return (
                <li key={item.id}>
                  <button
                    onClick={() => setSection(item.id)}
                    className={
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors " +
                      (active
                        ? "bg-primary/10 text-foreground ring-1 ring-inset ring-primary/25"
                        : "text-muted-foreground hover:bg-accent/40 hover:text-foreground")
                    }
                  >
                    <item.i className={"h-4 w-4 " + (active ? "text-primary" : "text-muted-foreground")} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{item.l}</p>
                      <p className="truncate text-[11px] text-muted-foreground">{item.d}</p>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60" />
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        <div>
          {settings.isLoading && (
            <div className="flex min-h-64 items-center justify-center rounded-2xl border border-border bg-card">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          )}
          {settings.isError && (
            <div className="rounded-2xl border border-border bg-card p-6 text-center">
              <p className="text-sm text-muted-foreground">Não foi possível carregar as configurações.</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => settings.refetch()}>
                Tentar novamente
              </Button>
            </div>
          )}
          {settings.data && section === "profile" && <ProfileSection data={settings.data.profile} />}
          {settings.data && section === "workspace" && <WorkspaceSection data={settings.data.workspace} />}
          {settings.data && section === "billing" && <BillingSection planId={settings.data.workspace.planId} />}
          {settings.data && section === "notifications" && <NotificationsSection org={settings.data.workspace.id} />}
          {settings.data && section === "security" && <SecuritySection email={settings.data.profile.email} />}
          {settings.data && section === "integrations" && <IntegrationsSection whatsapp={settings.data.whatsapp} />}
          {settings.data && section === "api" && <UnavailableSection title="API Keys e webhooks" />}
        </div>
      </div>
    </AppLayout>
  );
}

function ProfileSection({ data }: { data: { fullName: string; email: string; avatarUrl: string | null } }) {
  const update = useUpdateProfile();
  const router = useRouter();
  const form = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: { fullName: data.fullName },
  });
  useEffect(() => form.reset({ fullName: data.fullName }), [data.fullName, form]);
  const initials = data.fullName.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "U";

  const submit = form.handleSubmit(async (values) => {
    try {
      await update.mutateAsync(values);
      await router.invalidate();
      toast.success("Perfil atualizado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar.");
    }
  });

  return (
    <SectionCard title="Perfil" description="Suas informações pessoais">
      <div className="flex items-center gap-4">
        <Avatar className="h-16 w-16 border border-border">
          <AvatarFallback className="bg-primary/15 text-lg font-semibold text-primary">{initials}</AvatarFallback>
        </Avatar>
        <div>
          <p className="text-sm font-medium">{data.fullName || "Seu perfil"}</p>
          <p className="text-xs text-muted-foreground">A foto personalizada será habilitada com o Storage.</p>
        </div>
      </div>
      <Separator className="my-6 bg-border" />
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label className="text-xs">Nome completo</Label>
            <Input className="mt-1.5 h-10 rounded-lg border-border bg-background" {...form.register("fullName")} />
            {form.formState.errors.fullName && <p className="mt-1 text-xs text-destructive">{form.formState.errors.fullName.message}</p>}
          </div>
          <div>
            <Label className="text-xs">E-mail</Label>
            <Input value={data.email} disabled className="mt-1.5 h-10 rounded-lg border-border bg-muted" />
            <p className="mt-1 text-[11px] text-muted-foreground">O e-mail da conta é protegido pelo login.</p>
          </div>
        </div>
        <div className="flex justify-end">
          <Button type="submit" disabled={update.isPending || !form.formState.isDirty}>
            {update.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Salvar perfil
          </Button>
        </div>
      </form>
    </SectionCard>
  );
}

function WorkspaceSection({ data }: { data: { id: string; name: string; slug: string; enabledModules: string[] } }) {
  const session = useSession();
  const allowed = can(session, PERMISSIONS.ORG_MANAGE);
  const update = useUpdateWorkspace();
  const router = useRouter();
  const form = useForm<UpdateWorkspaceInput>({
    resolver: zodResolver(updateWorkspaceSchema),
    defaultValues: { name: data.name },
  });
  useEffect(() => form.reset({ name: data.name }), [data.name, form]);
  const submit = form.handleSubmit(async (values) => {
    try {
      await update.mutateAsync(values);
      await router.invalidate();
      toast.success("Empresa atualizada.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar.");
    }
  });

  return (
    <div className="space-y-4">
      <SectionCard title="Workspace" description="Dados da empresa ativa">
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label className="text-xs">Nome da empresa</Label>
              <Input disabled={!allowed} className="mt-1.5 h-10 rounded-lg border-border bg-background" {...form.register("name")} />
            </div>
            <div>
              <Label className="text-xs">Identificador</Label>
              <Input value={data.slug} disabled className="mt-1.5 h-10 rounded-lg border-border bg-muted" />
            </div>
          </div>
          {!allowed && <p className="text-xs text-muted-foreground">Somente proprietários e administradores podem alterar a empresa.</p>}
          <div className="flex justify-end">
            <Button type="submit" disabled={!allowed || update.isPending || !form.formState.isDirty}>
              {update.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Salvar empresa
            </Button>
          </div>
        </form>
      </SectionCard>
      <SectionCard title="Módulos ativos" description="Recursos disponíveis para esta empresa">
        <div className="flex flex-wrap gap-2">
          {data.enabledModules.map((module) => <Badge key={module} variant="secondary">{module}</Badge>)}
        </div>
        <Separator className="my-4" />
        <Link to="/configuracoes/papeis" className="text-sm font-medium text-primary hover:underline">
          Gerenciar papéis e permissões
        </Link>
      </SectionCard>
    </div>
  );
}

function BillingSection({ planId }: { planId: string }) {
  const plan = plans[(planId in plans ? planId : defaultPlanId) as PlanId];
  const price = plan.priceMonthly === null ? "Fale conosco" : plan.priceMonthly === 0 ? "Grátis" : (plan.priceMonthly / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) + "/mês";
  return (
    <SectionCard title="Plano atual" description="Informações reais da sua empresa">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <div className="flex items-center gap-2"><Badge className="border-0 bg-primary/15 text-primary">{plan.name}</Badge><span className="text-sm text-muted-foreground">{price}</span></div>
          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
            {plan.highlights.map((item) => <li key={item} className="flex items-center gap-2"><Check className="h-4 w-4 text-success" />{item}</li>)}
          </ul>
        </div>
        <Button disabled variant="outline">Gestão de assinatura em breve</Button>
      </div>
    </SectionCard>
  );
}

function NotificationsSection({ org }: { org: string }) {
  const key = `cw.preferences.${org}`;
  const [values, setValues] = useState({ email: true, push: true, compact: false, analytics: true });
  useEffect(() => {
    try { const raw = localStorage.getItem(key); if (raw) setValues(JSON.parse(raw)); } catch { /* preferências opcionais */ }
  }, [key]);
  const toggle = (field: keyof typeof values) => {
    const next = { ...values, [field]: !values[field] };
    setValues(next);
    try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* armazenamento indisponível */ }
  };
  const rows = [
    { key: "email" as const, title: "Notificações por e-mail", desc: "Resumos e alertas importantes" },
    { key: "push" as const, title: "Notificações no navegador", desc: "Alertas durante o uso do painel" },
    { key: "compact" as const, title: "Modo compacto", desc: "Preferência preparada para a interface" },
    { key: "analytics" as const, title: "Analytics de uso", desc: "Ajuda a melhorar o produto" },
  ];
  return (
    <SectionCard title="Preferências" description="Salvas neste navegador para esta empresa">
      {rows.map((row, index) => <div key={row.key}><div className="flex items-center justify-between py-3"><div><p className="text-sm font-medium">{row.title}</p><p className="text-xs text-muted-foreground">{row.desc}</p></div><Switch checked={values[row.key]} onCheckedChange={() => toggle(row.key)} /></div>{index < rows.length - 1 && <Separator />}</div>)}
    </SectionCard>
  );
}

function SecuritySection({ email }: { email: string }) {
  const [sending, setSending] = useState(false);
  const reset = async () => {
    setSending(true);
    try { await requestPasswordReset(email); toast.success("Enviamos as instruções para seu e-mail."); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível enviar."); }
    finally { setSending(false); }
  };
  return (
    <SectionCard title="Segurança" description="Acesso à sua conta">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-start gap-3"><LockKeyhole className="mt-0.5 h-5 w-5 text-primary" /><div><p className="text-sm font-medium">Alterar senha</p><p className="text-xs text-muted-foreground">Receba um link seguro em {email}.</p></div></div>
        <Button variant="outline" onClick={reset} disabled={sending}>{sending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Enviar link</Button>
      </div>
      <Separator className="my-5" />
      <p className="text-xs text-muted-foreground">Autenticação em dois fatores e gestão de sessões ainda não estão habilitadas.</p>
    </SectionCard>
  );
}

function IntegrationsSection({ whatsapp }: { whatsapp: { connected: boolean; provider: string | null; name: string | null; status: string | null; connectedAt: string | null } }) {
  return (
    <SectionCard title="Integrações" description="Conexões da empresa ativa">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-start gap-3"><MessageCircle className="mt-0.5 h-5 w-5 text-success" /><div><div className="flex items-center gap-2"><p className="text-sm font-medium">WhatsApp</p><Badge variant={whatsapp.connected ? "default" : "secondary"}>{whatsapp.connected ? "Conectado" : whatsapp.status ?? "Não conectado"}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{whatsapp.name || (whatsapp.provider ? `Provedor: ${whatsapp.provider}` : "Nenhuma conta oficial conectada.")}</p></div></div>
        <Button disabled={!whatsapp.connected} variant="outline">{whatsapp.connected ? "Gerenciar conexão" : "Conexão guiada em breve"}</Button>
      </div>
    </SectionCard>
  );
}

function UnavailableSection({ title }: { title: string }) {
  return <SectionCard title={title} description="Recurso preparado para uma próxima etapa"><p className="text-sm text-muted-foreground">Esta área ainda não está disponível. Nenhuma chave ou webhook fictício será exibido.</p></SectionCard>;
}
