/**
 * OnboardingChecklist — checklist de ativação DATA-DRIVEN (frente Claude).
 *
 * A conclusão de cada passo é derivada dos dados reais já disponíveis, via hooks
 * existentes (somente leitura — nada de Core/serviços é alterado):
 *  - perfil e empresa:  useSettings()  (profile.fullName / workspace.name)
 *  - WhatsApp conectado: useSettings()  (whatsapp.connected)
 *  - primeiro cliente:   useCustomers() (total > 0)
 *  - primeira automação: useAutomations() (length > 0)
 *  - primeiro relatório: useSettings()  (algum uso medido > 0)
 *
 * Nada é marcado manualmente: um passo só aparece "Concluído" quando os dados
 * confirmam. Passos de módulos desabilitados aparecem como "Indisponível".
 * Este componente é montado apenas quando o painel está aberto na aba
 * "Primeiros passos", então as consultas só rodam quando são úteis.
 */
import { ArrowRight, CheckCircle2, Circle, Loader2, MinusCircle, ChevronDown, ListChecks } from "lucide-react";
import { useSession } from "@/core/auth";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useSettings } from "@/features/configuracoes";
import { useCustomers } from "@/features/clientes/hooks/use-customers";
import { useAutomations } from "@/features/automacoes/hooks/use-automacoes";
import { ONBOARDING_STEPS, useChecklistCollapsed, type OnboardingStep } from "./onboarding";

type Status = "done" | "pending" | "unavailable" | "loading";

const STATUS_META: Record<Status, { label: string; badge: string }> = {
  done: { label: "Concluído", badge: "bg-success/15 text-success ring-1 ring-inset ring-success/25" },
  pending: { label: "Pendente", badge: "bg-muted text-muted-foreground" },
  unavailable: { label: "Indisponível", badge: "bg-muted text-muted-foreground" },
  loading: { label: "Verificando…", badge: "bg-muted text-muted-foreground" },
};

function StatusIcon({ status }: { status: Status }) {
  if (status === "loading") return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden />;
  if (status === "done") return <CheckCircle2 className="h-5 w-5 text-success" aria-hidden />;
  if (status === "unavailable") return <MinusCircle className="h-5 w-5 text-muted-foreground/60" aria-hidden />;
  return <Circle className="h-5 w-5 text-muted-foreground" aria-hidden />;
}

export function OnboardingChecklist({ onNavigate }: { onNavigate: (to: string) => void }) {
  const session = useSession();
  const org = session?.activeOrganization?.organizationId ?? null;
  const enabledModules = session?.enabledModules ?? [];
  const settings = useSettings();
  const customers = useCustomers();
  const automations = useAutomations();
  const { collapsed, toggle } = useChecklistCollapsed(org);

  const statusFor = (step: OnboardingStep): Status => {
    if (step.module && !enabledModules.includes(step.module)) return "unavailable";
    switch (step.id) {
      case "profile":
        if (settings.isLoading) return "loading";
        return (settings.data?.profile.fullName?.trim().length ?? 0) >= 2 ? "done" : "pending";
      case "empresa":
        if (settings.isLoading) return "loading";
        return (settings.data?.workspace.name?.trim().length ?? 0) >= 2 ? "done" : "pending";
      case "cliente":
        if (customers.isLoading) return "loading";
        return (customers.data?.total ?? 0) > 0 ? "done" : "pending";
      case "whatsapp":
        if (settings.isLoading) return "loading";
        return settings.data?.whatsapp.connected ? "done" : "pending";
      case "automacao":
        if (automations.isLoading) return "loading";
        return (automations.data?.length ?? 0) > 0 ? "done" : "pending";
      case "relatorio":
        if (settings.isLoading) return "loading";
        return settings.data?.usage.some((u) => u.used > 0) ? "done" : "pending";
      default:
        return "pending";
    }
  };

  const items = ONBOARDING_STEPS.map((step) => ({ step, status: statusFor(step) }));
  const applicable = items.filter((i) => i.status !== "unavailable");
  const doneCount = applicable.filter((i) => i.status === "done").length;
  const total = applicable.length;
  const percent = total ? Math.round((doneCount / total) * 100) : 0;
  const allDone = total > 0 && doneCount === total;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Primeiros passos</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs tabular-nums text-muted-foreground">{doneCount}/{total}</span>
            <button
              onClick={toggle}
              aria-expanded={!collapsed}
              aria-controls="onboarding-steps"
              className="rounded-md p-1 text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <ChevronDown className={cn("h-4 w-4 transition-transform", collapsed && "-rotate-90")} />
              <span className="sr-only">{collapsed ? "Mostrar passos" : "Recolher passos"}</span>
            </button>
          </div>
        </div>
        <Progress value={percent} className="mt-2 h-2" />
      </div>

      {allDone && !collapsed && (
        <div className="rounded-lg border border-success/25 bg-success/10 p-3 text-xs text-success">
          🎉 Tudo pronto! Seu ConnectWeb está configurado e pronto para usar.
        </div>
      )}

      {collapsed ? (
        <Button variant="ghost" size="sm" className="h-8 w-full gap-1 text-xs text-primary" onClick={toggle}>
          Retomar checklist <ArrowRight className="h-3 w-3" />
        </Button>
      ) : (
        <ul id="onboarding-steps" className="space-y-2">
          {items.map(({ step, status }) => (
            <li key={step.id} className="rounded-xl border border-border bg-card p-3">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 shrink-0">
                  <StatusIcon status={status} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className={cn("text-sm font-medium", status === "done" && "text-muted-foreground line-through", status === "unavailable" && "text-muted-foreground")}>
                      {step.title}
                    </p>
                    <Badge className={cn("shrink-0 rounded-md border-0 text-[10px]", STATUS_META[status].badge)}>
                      {STATUS_META[status].label}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{step.benefit}</p>
                  {status === "unavailable" ? (
                    <p className="mt-1 text-[11px] text-muted-foreground">Ative este módulo com o administrador para liberar o passo.</p>
                  ) : status !== "done" ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-1 h-7 gap-1 px-2 text-[11px] text-primary outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                      onClick={() => onNavigate(step.to)}
                    >
                      {step.cta} <ArrowRight className="h-3 w-3" />
                    </Button>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
