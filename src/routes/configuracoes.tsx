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
  Trash2,
  Webhook,
  ShieldCheck,
  LogOut,
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
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
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
  const [factor, setFactor] = useState<{ id: string; status: string } | null>(null);
  const [enrollment, setEnrollment] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [mfaBusy, setMfaBusy] = useState(false);
  useEffect(() => {
    getSupabaseBrowserClient().auth.mfa.listFactors().then(({ data }) => {
      const current = data?.totp?.find((item) => item.status === "verified") ?? data?.totp?.[0];
      setFactor(current ? { id: current.id, status: current.status } : null);
    });
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
    const { error } = await getSupabaseBrowserClient().auth.signOut({ scope: "others" });
    if (error) toast.error(error.message); else toast.success("Outras sessões foram encerradas.");
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
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 text-primary" /><div><div className="flex items-center gap-2"><p className="text-sm font-medium">Aplicativo autenticador</p><Badge variant={factor?.status === "verified" ? "default" : "secondary"}>{factor?.status === "verified" ? "Ativo" : "Desativado"}</Badge></div><p className="text-xs text-muted-foreground">Use Google Authenticator, Microsoft Authenticator ou similar.</p></div></div>{factor?.status === "verified" ? <Button variant="outline" disabled={mfaBusy} onClick={disableMfa}>Desativar</Button> : <Button variant="outline" disabled={mfaBusy || Boolean(enrollment)} onClick={startMfa}>Ativar 2FA</Button>}</div>
      {enrollment && <div className="mt-5 rounded-xl border border-border p-4"><div className="grid gap-4 sm:grid-cols-[180px_1fr]"><img src={enrollment.qr} alt="QR code para configurar autenticação em dois fatores" className="h-44 w-44 rounded-lg bg-white p-2" /><div><p className="text-sm font-medium">1. Escaneie o QR code</p><p className="mt-1 text-xs text-muted-foreground">Se preferir, use a chave: <span className="break-all font-mono text-foreground">{enrollment.secret}</span></p><Label className="mt-4 block">2. Digite o código de 6 números</Label><div className="mt-1.5 flex gap-2"><Input inputMode="numeric" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} className="max-w-44" /><Button onClick={verifyMfa} disabled={mfaBusy || code.length !== 6}>{mfaBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirmar</Button></div></div></div></div>}
    </SectionCard>
    <SectionCard title="Sessões" description="Controle onde sua conta permanece conectada"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div className="flex items-start gap-3"><LogOut className="mt-0.5 h-5 w-5 text-primary" /><div><p className="text-sm font-medium">Encerrar outras sessões</p><p className="text-xs text-muted-foreground">Mantém somente este navegador conectado.</p></div></div><Button variant="outline" onClick={closeOtherSessions}>Encerrar outras</Button></div></SectionCard>
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
          <div><Label>Token de acesso permanente</Label><Input type="password" autoComplete="off" className="mt-1.5" {...form.register("accessToken")} />{form.formState.errors.accessToken && <p className="mt-1 text-xs text-destructive">{form.formState.errors.accessToken.message}</p>}</div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><Label>ID da conta WhatsApp (WABA)</Label><Input className="mt-1.5" {...form.register("wabaId")} />{form.formState.errors.wabaId && <p className="mt-1 text-xs text-destructive">{form.formState.errors.wabaId.message}</p>}</div>
            <div><Label>ID do número de telefone</Label><Input className="mt-1.5" {...form.register("phoneNumberId")} />{form.formState.errors.phoneNumberId && <p className="mt-1 text-xs text-destructive">{form.formState.errors.phoneNumberId.message}</p>}</div>
          </div>
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
      </SectionCard>
      <SectionCard title="Endpoints cadastrados" description="Ative, pause ou remova integrações">
        {webhooks.isLoading && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
        {webhooks.isError && <p className="text-sm text-destructive">Não foi possível carregar os webhooks.</p>}
        {webhooks.data?.length === 0 && <p className="text-sm text-muted-foreground">Nenhum webhook cadastrado.</p>}
        <div className="space-y-3">{webhooks.data?.map((item) => <div key={item.id} className="flex flex-col gap-3 rounded-xl border border-border p-3 sm:flex-row sm:items-center"><Webhook className="h-5 w-5 text-primary" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{item.url}</p><p className="text-xs text-muted-foreground">{item.events.join(" · ")}</p></div><Switch checked={item.enabled} disabled={!allowed || toggle.isPending} onCheckedChange={(enabled) => toggle.mutate({ id: item.id, enabled })} /><Button size="icon" variant="ghost" disabled={!allowed || remove.isPending} onClick={() => remove.mutate(item.id)} aria-label="Remover webhook"><Trash2 className="h-4 w-4 text-destructive" /></Button></div>)}</div>
      </SectionCard>
      <SectionCard title="API Keys" description="Acesso programático"><p className="text-sm text-muted-foreground">Chaves de API ainda não estão habilitadas. Webhooks já funcionam sem expor credenciais da sua conta.</p></SectionCard>
    </div>
  );
}
