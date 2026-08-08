import { useEffect, useState, type ReactNode } from "react";
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
  Trash2,
  Webhook,
  ShieldCheck,
  LogOut,
  HelpCircle,
  ShieldAlert,
  ExternalLink,
  Activity,
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
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { can, PERMISSIONS } from "@/core/permissions";
import { requestPasswordReset, useSession } from "@/core/auth";
import { useBillingOverview } from "@/core/billing";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { MonitoringSection } from "@/components/monitoring/monitoring-section";
import { PlanShowcase } from "@/components/billing/plan-showcase";
import { ApiKeysSection } from "@/features/configuracoes/components/api-keys-section";
import {
  updateProfileSchema,
  updateWorkspaceSchema,
  connectWhatsAppSchema,
  createWebhookSchema,
  useSettings,
  useUpdateProfile,
  useUpdateWorkspace,
  useConnectWhatsApp,
  useWebhooks,
  useCreateWebhook,
  useToggleWebhook,
  useRemoveWebhook,
  useUpdatePreferences,
  type UpdateProfileInput,
  type UpdateWorkspaceInput,
  type ConnectWhatsAppInput,
  type CreateWebhookInput,
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

type Section = "profile" | "workspace" | "monitoring" | "billing" | "notifications" | "security" | "integrations" | "api";

const menu: Array<{ id: Section; i: typeof User; l: string; d: string }> = [
  { id: "profile", i: User, l: "Perfil", d: "Dados pessoais e senha" },
  { id: "workspace", i: Building2, l: "Workspace", d: "Empresa e módulos" },
  { id: "monitoring", i: Activity, l: "Monitoramento", d: "Saúde do sistema" },
  { id: "billing", i: CreditCard, l: "Cobrança", d: "Plano e limites" },
  { id: "notifications", i: Bell, l: "Notificações", d: "Preferências locais" },
  { id: "security", i: Shield, l: "Segurança", d: "Senha e acesso" },
  { id: "integrations", i: Plug, l: "Integrações", d: "WhatsApp e provedores" },
  { id: "api", i: Key, l: "API Keys", d: "Chaves e webhooks" },
];

/**
 * Ajuda contextual colapsável para lojistas. Usa <details> nativo: acessível
 * por teclado e leitores de tela sem JS extra. Fechado por padrão para não
 * poluir a interface aprovada.
 */
function HelpDisclosure({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details
      open={defaultOpen}
      className="group mt-4 rounded-lg border border-border bg-muted/30 [&_summary::-webkit-details-marker]:hidden"
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
        <HelpCircle className="h-3.5 w-3.5 shrink-0 text-primary" />
        <span className="flex-1">{title}</span>
        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
      </summary>
      <div className="space-y-2 px-3 pb-3 pt-1 text-xs leading-relaxed text-muted-foreground">
        {children}
      </div>
    </details>
  );
}

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
                    aria-current={active ? "page" : undefined}
                    className={
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/40 " +
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
          {section === "monitoring" && <MonitoringSection />}
          {settings.data && section === "billing" && <BillingSection usage={settings.data.usage} />}
          {settings.data && section === "notifications" && <NotificationsSection values={settings.data.preferences} />}
          {settings.data && section === "security" && <SecuritySection email={settings.data.profile.email} />}
          {settings.data && section === "integrations" && <IntegrationsSection whatsapp={settings.data.whatsapp} />}
          {settings.data && section === "api" && <WebhooksSection />}
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
      <HelpDisclosure title="Por que não consigo mudar o e-mail por aqui?">
        <p>
          O e-mail é a chave de acesso da sua conta, por isso ele é gerenciado pelo login para sua
          segurança. Para trocar a senha, use a seção <span className="font-medium text-foreground">Segurança</span>.
          A foto de perfil será liberada quando o armazenamento de imagens estiver ativo.
        </p>
      </HelpDisclosure>
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
        {data.enabledModules.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {data.enabledModules.map((module) => <Badge key={module} variant="secondary">{module}</Badge>)}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhum módulo ativo nesta empresa ainda.</p>
        )}
        <Separator className="my-4" />
        <Link to="/configuracoes/papeis" className="text-sm font-medium text-primary hover:underline">
          Gerenciar papéis e permissões
        </Link>
        <HelpDisclosure title="O que são módulos e o identificador?">
          <p>
            <span className="font-medium text-foreground">Módulos</span> são as áreas liberadas para a
            sua empresa (CRM, WhatsApp, Automações e assim por diante). Eles definem o que aparece no
            menu e o que cada pessoa pode usar.
          </p>
          <p>
            O <span className="font-medium text-foreground">identificador</span> é o apelido único da
            empresa dentro do ConnectWeb; ele é fixo e usado internamente pelo sistema.
          </p>
        </HelpDisclosure>
      </SectionCard>
    </div>
  );
}

const resourceLabels: Record<string, string> = { customers: "Clientes", messages: "Mensagens", ai_credits: "Créditos de IA", storage_bytes: "Armazenamento", api_calls: "Chamadas de API" };

function formatUsage(resource: string, value: number) {
  if (resource === "storage_bytes") return `${(value / 1_073_741_824).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} GB`;
  return value.toLocaleString("pt-BR");
}

function formatLimit(resource: string, value: number) {
  return value < 0 ? "Ilimitado" : formatUsage(resource, value);
}

function BillingSection({ usage }: { usage: Array<{ resource: string; used: number; limit: number; period: "month" | "total" }> }) {
  const billing = useBillingOverview();
  const subscriptionProduct = billing.data?.products.find((product) => product.kind === "subscription");
  const packages = billing.data?.products
    .filter((product) => product.kind === "ai_addon")
    .map((product) => ({
      id: product.id as "ai_advantage" | "ai_turbo" | "ai_ultra",
      name: product.name,
      credits: product.aiCredits,
      priceCents: product.priceCents,
      highlight: product.id === "ai_turbo",
    }));
  return (
    <div className="space-y-4"><PlanShowcase
      plan={subscriptionProduct ? { name: subscriptionProduct.name, priceCents: subscriptionProduct.priceCents } : undefined}
      packages={packages?.length ? packages : undefined}
    /><SectionCard title="Uso do plano" description="Consumo medido pela plataforma">
      <div className="grid gap-5 sm:grid-cols-2">{usage.map((item) => { const percentage = item.limit > 0 ? Math.min(100, Math.round((item.used / item.limit) * 100)) : 0; return <div key={item.resource}><div className="mb-2 flex items-center justify-between gap-3"><div><p className="text-sm font-medium">{resourceLabels[item.resource] ?? item.resource}</p><p className="text-[11px] text-muted-foreground">{item.period === "month" ? "Neste mês" : "Total armazenado"}</p></div><span className="text-xs text-muted-foreground">{formatUsage(item.resource, item.used)} / {formatLimit(item.resource, item.limit)}</span></div><Progress value={percentage} className="h-2" /></div>; })}</div>
      {usage.length === 0 && <p className="text-sm text-muted-foreground">Nenhum limite foi configurado para este plano.</p>}
      <HelpDisclosure title="Como leio o consumo do meu plano?">
        <p>
          Cada barra mostra quanto você já usou em relação ao limite do plano — por exemplo,
          mensagens e créditos de IA no mês, ou armazenamento total. Quando a barra se aproxima de
          100%, vale a pena revisar o uso ou considerar um plano maior.
        </p>
        <p>Os números são medidos pela própria plataforma e refletem o uso real da sua empresa.</p>
      </HelpDisclosure>
    </SectionCard></div>
  );
}

function NotificationsSection({ values }: { values: { email: boolean; push: boolean; compact: boolean; analytics: boolean } }) {
  const session = useSession();
  const allowed = can(session, PERMISSIONS.CONFIGURACOES_MANAGE);
  const update = useUpdatePreferences();
  const toggle = (field: keyof typeof values) => {
    const next = { ...values, [field]: !values[field] };
    update.mutate(next, { onSuccess: () => toast.success("Preferências atualizadas."), onError: (error) => toast.error(error.message) });
  };
  const rows = [
    { key: "email" as const, title: "Notificações por e-mail", desc: "Enviamos resumos e alertas importantes para o e-mail da conta." },
    { key: "push" as const, title: "Notificações no navegador", desc: "Mostra avisos enquanto você usa o painel (o navegador pode pedir permissão)." },
    { key: "compact" as const, title: "Modo compacto", desc: "Reduz espaçamentos para caber mais informação na tela." },
    { key: "analytics" as const, title: "Ajudar a melhorar o produto", desc: "Compartilha estatísticas de uso anônimas com a nossa equipe." },
  ];
  return (
    <SectionCard title="Preferências" description="Valem para a empresa em todos os dispositivos">
      {rows.map((row, index) => <div key={row.key}><div className="flex items-center justify-between gap-4 py-3"><div><p className="text-sm font-medium">{row.title}</p><p className="text-xs text-muted-foreground">{row.desc}</p></div><Switch checked={values[row.key]} disabled={!allowed || update.isPending} onCheckedChange={() => toggle(row.key)} aria-label={row.title} /></div>{index < rows.length - 1 && <Separator />}</div>)}
      {!allowed && <p className="mt-3 text-xs text-muted-foreground">Somente administradores podem alterar as preferências da empresa.</p>}
      <HelpDisclosure title="Essas preferências valem para quem?">
        <p>
          As opções aqui são da <span className="font-medium text-foreground">empresa</span>: quando um
          administrador altera, o novo padrão passa a valer para todos os usuários e aparelhos ligados a
          esta empresa. Elas são salvas automaticamente ao ligar ou desligar cada opção.
        </p>
      </HelpDisclosure>
    </SectionCard>
  );
}

function SecuritySection({ email }: { email: string }) {
  const [sending, setSending] = useState(false);
  const [factor, setFactor] = useState<{ id: string; status: string } | null>(null);
  const [enrollment, setEnrollment] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [mfaBusy, setMfaBusy] = useState(false);
  const [loadingFactor, setLoadingFactor] = useState(true);
  const [closingSessions, setClosingSessions] = useState(false);
  useEffect(() => {
    let active = true;
    getSupabaseBrowserClient()
      .auth.mfa.listFactors()
      .then(({ data }) => {
        if (!active) return;
        const current = data?.totp?.find((item) => item.status === "verified") ?? data?.totp?.[0];
        setFactor(current ? { id: current.id, status: current.status } : null);
      })
      .catch(() => {
        if (active) setFactor(null);
      })
      .finally(() => {
        if (active) setLoadingFactor(false);
      });
    return () => {
      active = false;
    };
  }, []);
  const reset = async () => {
    setSending(true);
    try { await requestPasswordReset(email); toast.success("Enviamos as instruções para seu e-mail."); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível enviar."); }
    finally { setSending(false); }
  };
  const startMfa = async () => {
    setMfaBusy(true);
    try {
      const { data, error } = await getSupabaseBrowserClient().auth.mfa.enroll({ factorType: "totp", friendlyName: "ConnectWeb" });
      if (error) throw error;
      setEnrollment({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível iniciar o 2FA."); }
    finally { setMfaBusy(false); }
  };
  const verifyMfa = async () => {
    if (!enrollment || code.trim().length !== 6) return;
    setMfaBusy(true);
    try {
      const { error } = await getSupabaseBrowserClient().auth.mfa.challengeAndVerify({ factorId: enrollment.id, code: code.trim() });
      if (error) throw error;
      setFactor({ id: enrollment.id, status: "verified" });
      setEnrollment(null);
      setCode("");
      toast.success("Autenticação em dois fatores ativada.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Código inválido."); }
    finally { setMfaBusy(false); }
  };
  const disableMfa = async () => {
    if (!factor) return;
    setMfaBusy(true);
    try {
      const { error } = await getSupabaseBrowserClient().auth.mfa.unenroll({ factorId: factor.id });
      if (error) throw error;
      setFactor(null);
      toast.success("Autenticação em dois fatores desativada.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível desativar o 2FA."); }
    finally { setMfaBusy(false); }
  };
  const closeOtherSessions = async () => {
    setClosingSessions(true);
    try {
      const { error } = await getSupabaseBrowserClient().auth.signOut({ scope: "others" });
      if (error) toast.error(error.message);
      else toast.success("Outras sessões foram encerradas.");
    } finally {
      setClosingSessions(false);
    }
  };
  return (
    <div className="space-y-4">
    <SectionCard title="Segurança" description="Acesso à sua conta">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-start gap-3"><LockKeyhole className="mt-0.5 h-5 w-5 text-primary" /><div><p className="text-sm font-medium">Alterar senha</p><p className="text-xs text-muted-foreground">Receba um link seguro em {email}.</p></div></div>
        <Button variant="outline" onClick={reset} disabled={sending}>{sending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Enviar link</Button>
      </div>
    </SectionCard>
    <SectionCard title="Autenticação em dois fatores" description="Proteja a conta com um aplicativo autenticador">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 text-primary" /><div><div className="flex items-center gap-2"><p className="text-sm font-medium">Aplicativo autenticador</p><Badge variant={factor?.status === "verified" ? "default" : "secondary"}>{loadingFactor ? "Verificando…" : factor?.status === "verified" ? "Ativo" : "Desativado"}</Badge></div><p className="text-xs text-muted-foreground">Use Google Authenticator, Microsoft Authenticator ou similar.</p></div></div>
        {loadingFactor ? (
          <Button variant="outline" disabled><Loader2 className="mr-2 h-4 w-4 animate-spin" />Carregando</Button>
        ) : factor?.status === "verified" ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" disabled={mfaBusy}>{mfaBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Desativar</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2"><ShieldAlert className="h-4 w-4 text-warning" /> Desativar a verificação em duas etapas?</AlertDialogTitle>
                <AlertDialogDescription>
                  Sua conta passará a ser protegida somente pela senha. Sem o segundo fator, fica mais fácil para outra pessoa entrar caso descubra sua senha. Você pode reativar quando quiser.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Manter ativo</AlertDialogCancel>
                <AlertDialogAction onClick={disableMfa} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Desativar mesmo assim</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : (
          <Button variant="outline" disabled={mfaBusy || Boolean(enrollment)} onClick={startMfa}>{mfaBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Ativar 2FA</Button>
        )}
      </div>
      {enrollment && <div className="mt-5 rounded-xl border border-border p-4"><div className="grid gap-4 sm:grid-cols-[180px_1fr]"><img src={enrollment.qr} alt="QR code para configurar autenticação em dois fatores" className="h-44 w-44 rounded-lg bg-white p-2" /><div><p className="text-sm font-medium">1. Escaneie o QR code</p><p className="mt-1 text-xs text-muted-foreground">Abra seu app autenticador e aponte a câmera. Se preferir, digite a chave manualmente: <span className="break-all font-mono text-foreground">{enrollment.secret}</span></p><Label htmlFor="mfa-enroll-code" className="mt-4 block">2. Digite o código de 6 números</Label><div className="mt-1.5 flex gap-2"><Input id="mfa-enroll-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} onKeyDown={(event) => { if (event.key === "Enter") void verifyMfa(); }} className="max-w-44" /><Button onClick={verifyMfa} disabled={mfaBusy || code.length !== 6}>{mfaBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirmar</Button></div></div></div></div>}
      <HelpDisclosure title="Como funciona a verificação em duas etapas?">
        <p>
          Além da senha, o login passa a pedir um código que muda a cada 30 segundos, gerado por um
          aplicativo no seu celular (Google Authenticator, Microsoft Authenticator, entre outros).
        </p>
        <p>
          Assim, mesmo que alguém descubra sua senha, não consegue entrar sem o seu celular. Ao ativar,
          nas próximas vezes você digitará esse código na tela de verificação.
        </p>
      </HelpDisclosure>
    </SectionCard>
    <SectionCard title="Sessões" description="Controle onde sua conta permanece conectada"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div className="flex items-start gap-3"><LogOut className="mt-0.5 h-5 w-5 text-primary" /><div><p className="text-sm font-medium">Encerrar outras sessões</p><p className="text-xs text-muted-foreground">Desconecta sua conta em todos os outros aparelhos e navegadores, mantendo só este.</p></div></div><Button variant="outline" onClick={closeOtherSessions} disabled={closingSessions}>{closingSessions && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Encerrar outras</Button></div></SectionCard>
    </div>
  );
}

function IntegrationsSection({ whatsapp }: { whatsapp: { connected: boolean; provider: string | null; name: string | null; status: string | null; connectedAt: string | null } }) {
  const session = useSession();
  const allowed = can(session, PERMISSIONS.WHATSAPP_CONNECT);
  const connect = useConnectWhatsApp();
  const [showForm, setShowForm] = useState(false);
  const form = useForm<ConnectWhatsAppInput>({
    resolver: zodResolver(connectWhatsAppSchema),
    defaultValues: { accessToken: "", wabaId: "", phoneNumberId: "" },
  });
  const submit = form.handleSubmit(async (values) => {
    try {
      await connect.mutateAsync(values);
      form.reset();
      setShowForm(false);
      toast.success("WhatsApp conectado com sucesso.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível conectar.");
    }
  });
  return (
    <div className="space-y-4">
    <SectionCard title="Integrações" description="Conexões da empresa ativa">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-start gap-3"><MessageCircle className="mt-0.5 h-5 w-5 text-success" /><div><div className="flex items-center gap-2"><p className="text-sm font-medium">WhatsApp</p><Badge variant={whatsapp.connected ? "default" : "secondary"}>{whatsapp.connected ? "Conectado" : whatsapp.status ?? "Não conectado"}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{whatsapp.name || (whatsapp.provider ? `Provedor: ${whatsapp.provider}` : "Nenhuma conta oficial conectada.")}</p></div></div>
        <Button disabled={!allowed} variant="outline" onClick={() => setShowForm((current) => !current)}>{whatsapp.connected ? "Atualizar conexão" : "Conectar WhatsApp"}</Button>
      </div>
    </SectionCard>
    {showForm && (
      <SectionCard title="Conexão oficial Meta" description="Use os dados do WhatsApp Business Manager">
        <form onSubmit={submit} className="space-y-4">
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
            O token é enviado diretamente à função segura e armazenado na área protegida do servidor. Ele não fica salvo neste navegador.
          </div>
          <div>
            <Label htmlFor="wa-token">Token de acesso permanente</Label>
            <Input id="wa-token" type="password" autoComplete="off" className="mt-1.5" {...form.register("accessToken")} />
            <p className="mt-1 text-[11px] text-muted-foreground">Token permanente do usuário do sistema (não o token temporário de teste).</p>
            {form.formState.errors.accessToken && <p className="mt-1 text-xs text-destructive">{form.formState.errors.accessToken.message}</p>}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="wa-waba">ID da conta WhatsApp (WABA)</Label>
              <Input id="wa-waba" inputMode="numeric" className="mt-1.5" {...form.register("wabaId")} />
              <p className="mt-1 text-[11px] text-muted-foreground">Sequência de números da sua conta comercial.</p>
              {form.formState.errors.wabaId && <p className="mt-1 text-xs text-destructive">{form.formState.errors.wabaId.message}</p>}
            </div>
            <div>
              <Label htmlFor="wa-phone">ID do número de telefone</Label>
              <Input id="wa-phone" inputMode="numeric" className="mt-1.5" {...form.register("phoneNumberId")} />
              <p className="mt-1 text-[11px] text-muted-foreground">Identifica o número que envia as mensagens (não é o número em si).</p>
              {form.formState.errors.phoneNumberId && <p className="mt-1 text-xs text-destructive">{form.formState.errors.phoneNumberId.message}</p>}
            </div>
          </div>

          <HelpDisclosure title="Onde encontrar esses dados na Meta?">
            <p>
              Acesse o <span className="font-medium text-foreground">Meta Business Manager</span> com a conta dona do WhatsApp Business:
            </p>
            <ol className="ml-4 list-decimal space-y-1.5">
              <li>
                <span className="font-medium text-foreground">WABA ID</span> e{" "}
                <span className="font-medium text-foreground">Phone Number ID</span>: abra{" "}
                <span className="font-medium text-foreground">Configurações da conta → WhatsApp → Contas do WhatsApp</span>{" "}
                (ou o app em <span className="font-medium text-foreground">developers.facebook.com → seu app → WhatsApp → Configuração da API</span>). Os dois IDs aparecem no topo do painel do número.
              </li>
              <li>
                <span className="font-medium text-foreground">Token permanente</span>: em{" "}
                <span className="font-medium text-foreground">Configurações do negócio → Usuários → Usuários do sistema</span>, crie (ou selecione) um usuário do sistema, clique em{" "}
                <span className="font-medium text-foreground">Gerar token</span>, escolha o app e marque as permissões{" "}
                <span className="font-mono text-foreground">whatsapp_business_messaging</span> e{" "}
                <span className="font-mono text-foreground">whatsapp_business_management</span>. Copie o token gerado — ele só aparece uma vez.
              </li>
            </ol>
            <p className="flex items-center gap-1.5 pt-1">
              <ExternalLink className="h-3 w-3 shrink-0" />
              <a href="https://business.facebook.com/settings" target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline">
                Abrir o Meta Business Manager
              </a>
            </p>
            <p className="text-[11px]">Precisa que o número já esteja verificado e com a conta comercial aprovada na Meta.</p>
          </HelpDisclosure>

          <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Cancelar</Button><Button type="submit" disabled={connect.isPending}>{connect.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Validar e conectar</Button></div>
        </form>
      </SectionCard>
    )}
    </div>
  );
}

const webhookEvents = ["customer.created", "customer.updated", "deal.created", "deal.updated", "message.received", "automation.completed"];

function WebhooksSection() {
  const session = useSession();
  const allowed = can(session, PERMISSIONS.WEBHOOKS_MANAGE);
  const webhooks = useWebhooks();
  const create = useCreateWebhook();
  const toggle = useToggleWebhook();
  const remove = useRemoveWebhook();
  const form = useForm<CreateWebhookInput>({ resolver: zodResolver(createWebhookSchema), defaultValues: { url: "", events: [], secret: "" } });
  const selected = form.watch("events");
  const changeEvent = (event: string) => form.setValue("events", selected.includes(event) ? selected.filter((item) => item !== event) : [...selected, event], { shouldValidate: true, shouldDirty: true });
  const submit = form.handleSubmit(async (values) => {
    try { await create.mutateAsync(values); form.reset(); toast.success("Webhook criado."); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível criar o webhook."); }
  });
  return (
    <div className="space-y-4">
      <SectionCard title="Webhooks" description="Envie eventos do ConnectWeb para outros sistemas">
        {!allowed ? <p className="text-sm text-muted-foreground">Você não possui permissão para gerenciar webhooks.</p> : (
          <form onSubmit={submit} className="space-y-4">
            <div><Label>URL HTTPS de destino</Label><Input placeholder="https://seusistema.com/webhooks/connectweb" className="mt-1.5" {...form.register("url")} />{form.formState.errors.url && <p className="mt-1 text-xs text-destructive">{form.formState.errors.url.message}</p>}</div>
            <div><Label>Segredo para assinatura</Label><Input type="password" autoComplete="new-password" className="mt-1.5" {...form.register("secret")} /><p className="mt-1 text-[11px] text-muted-foreground">Use este segredo para validar que os eventos vieram do ConnectWeb.</p>{form.formState.errors.secret && <p className="mt-1 text-xs text-destructive">{form.formState.errors.secret.message}</p>}</div>
            <div><Label>Eventos</Label><div className="mt-2 grid gap-2 sm:grid-cols-2">{webhookEvents.map((event) => <label key={event} className="flex cursor-pointer items-center gap-2 rounded-lg border border-border p-2 text-sm"><input type="checkbox" checked={selected.includes(event)} onChange={() => changeEvent(event)} className="accent-primary" />{event}</label>)}</div>{form.formState.errors.events && <p className="mt-1 text-xs text-destructive">{form.formState.errors.events.message}</p>}</div>
            <div className="flex justify-end"><Button type="submit" disabled={create.isPending}>{create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Criar webhook</Button></div>
          </form>
        )}
        <HelpDisclosure title="O que é um webhook?">
          <p>
            É um aviso automático: sempre que algo acontece no ConnectWeb (um cliente novo, uma
            mensagem recebida, uma automação concluída), enviamos uma notificação para a URL que você
            cadastrar. Assim outro sistema seu — um ERP, uma planilha, um site — fica sabendo na hora.
          </p>
          <p>
            O <span className="font-medium text-foreground">segredo</span> serve para o seu sistema
            conferir que o aviso veio mesmo do ConnectWeb, e não de um impostor.
          </p>
        </HelpDisclosure>
      </SectionCard>
      <SectionCard title="Endpoints cadastrados" description="Ative, pause ou remova integrações">
        {webhooks.isLoading && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
        {webhooks.isError && <p className="text-sm text-destructive">Não foi possível carregar os webhooks.</p>}
        {webhooks.data?.length === 0 && <p className="text-sm text-muted-foreground">Nenhum webhook cadastrado.</p>}
        <div className="space-y-3">{webhooks.data?.map((item) => <div key={item.id} className="flex flex-col gap-3 rounded-xl border border-border p-3 sm:flex-row sm:items-center"><Webhook className="h-5 w-5 shrink-0 text-primary" /><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="truncate text-sm font-medium">{item.url}</p><Badge variant={item.enabled ? "default" : "secondary"} className="shrink-0">{item.enabled ? "Ativo" : "Pausado"}</Badge></div><p className="truncate text-xs text-muted-foreground">{item.events.join(" · ")}</p></div><Switch checked={item.enabled} disabled={!allowed || toggle.isPending} onCheckedChange={(enabled) => toggle.mutate({ id: item.id, enabled })} aria-label={item.enabled ? `Pausar webhook ${item.url}` : `Ativar webhook ${item.url}`} /><AlertDialog><AlertDialogTrigger asChild><Button size="icon" variant="ghost" disabled={!allowed || remove.isPending} aria-label={`Remover webhook ${item.url}`}><Trash2 className="h-4 w-4 text-destructive" /></Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle className="flex items-center gap-2"><ShieldAlert className="h-4 w-4 text-destructive" /> Remover webhook?</AlertDialogTitle><AlertDialogDescription>Os eventos deixarão de ser enviados para <span className="break-all font-medium text-foreground">{item.url}</span>. Esta ação não pode ser desfeita — para voltar a receber, você precisará cadastrar o endpoint de novo.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => remove.mutate(item.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Remover webhook</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></div>)}</div>
      </SectionCard>
      <ApiKeysSection />
    </div>
  );
}
