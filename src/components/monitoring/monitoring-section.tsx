/**
 * MonitoringSection — cockpit visual de saúde operacional (frente Claude).
 *
 * Linguagem de lojista: "o que aconteceu", "qual o impacto", "como resolver".
 * Consome useOperationalHealth (adaptador sobre hooks reais). Nunca expõe
 * tokens, IDs internos nem mensagens técnicas. Estados: carregando, vazio/
 * indisponível e pronto; cada subsistema degrada honestamente ("sem dados").
 */
import type { ReactNode } from "react";
import {
  MessageCircle,
  Workflow,
  Sparkles,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Clock,
  ArrowDownLeft,
  ArrowUpRight,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { SectionCard } from "@/components/shared/section-card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { relativeTime as relTime } from "@/lib/format";
import { useOperationalHealth } from "./use-operational-health";
import { aiAlertLevel, aiAlertMessage, whatsappGuidance } from "./health";

const TONE_BADGE: Record<string, string> = {
  ok: "bg-success/15 text-success",
  warn: "bg-warning/15 text-warning",
  danger: "bg-destructive/15 text-destructive",
  muted: "bg-muted text-muted-foreground",
};

function Tile({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-muted-foreground" aria-hidden="true">{icon}</span>
        <h4 className="text-sm font-semibold">{title}</h4>
      </div>
      {children}
    </div>
  );
}

function StatusBadge({ tone, children }: { tone: string; children: ReactNode }) {
  return (
    <Badge className={cn("shrink-0 rounded-md border-0 text-[11px] font-medium", TONE_BADGE[tone])}>
      {children}
    </Badge>
  );
}

/** Aviso "como resolver" — o que fazer, sem jargão. */
function ResolveHint({ tone, children }: { tone: "warn" | "danger"; children: ReactNode }) {
  return (
    <p
      className={cn(
        "mt-2 flex items-start gap-1.5 rounded-lg px-2.5 py-1.5 text-xs",
        tone === "danger" ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning",
      )}
    >
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

function timeOrDash(iso: string | null): string {
  return iso ? relTime(iso) : "—";
}

export function MonitoringSection() {
  const { state, health } = useOperationalHealth();

  if (state === "loading") {
    return (
      <SectionCard title="Saúde do sistema" description="Como está o funcionamento agora">
        <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Verificando o sistema…
        </div>
      </SectionCard>
    );
  }

  if (state !== "ready" || !health) {
    return (
      <SectionCard title="Saúde do sistema" description="Como está o funcionamento agora">
        <p className="py-6 text-sm text-muted-foreground">
          {state === "forbidden"
            ? "Você não tem permissão para ver o monitoramento. Fale com um administrador."
            : "Não há dados de monitoramento disponíveis para esta empresa no momento."}
        </p>
      </SectionCard>
    );
  }

  const wa = whatsappGuidance(health.whatsapp.status);
  const ai = health.ai;
  const alert = ai ? aiAlertLevel(ai.used, ai.limit) : null;
  const alertMsg = alert ? aiAlertMessage(alert.level) : null;

  return (
    <SectionCard
      title="Saúde do sistema"
      description="Como está o funcionamento agora, em linguagem simples"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {/* WhatsApp */}
        <Tile icon={<MessageCircle className="h-4 w-4" />} title="WhatsApp">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm text-muted-foreground">
              {health.whatsapp.name || "Conta oficial"}
            </span>
            <StatusBadge tone={wa.tone}>{wa.label}</StatusBadge>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <ArrowDownLeft className="h-3.5 w-3.5 text-success" aria-hidden="true" />
              <span>Recebido: <span className="text-foreground">{timeOrDash(health.whatsapp.lastInboundAt)}</span></span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <ArrowUpRight className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
              <span>Enviado: <span className="text-foreground">{timeOrDash(health.whatsapp.lastOutboundAt)}</span></span>
            </div>
          </div>
          {wa.help && (
            <ResolveHint tone={wa.tone === "danger" ? "danger" : "warn"}>
              {wa.help}{" "}
              <Link to="/configuracoes" className="font-medium underline">Abrir Integrações</Link>
            </ResolveHint>
          )}
        </Tile>

        {/* Automações */}
        <Tile icon={<Workflow className="h-4 w-4" />} title="Automações">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1 rounded-md bg-success/15 px-2 py-0.5 text-success">
              <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> {health.automations.active} ativas
            </span>
            <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-muted-foreground">
              {health.automations.paused} pausadas
            </span>
            <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-muted-foreground">
              {health.automations.failed === null ? "falhas: sem dados" : `${health.automations.failed} com falha`}
            </span>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            As automações rodam sozinhas. Pausadas não disparam; reative quando quiser em Automações.
          </p>
        </Tile>

        {/* IA — franquia mensal */}
        <Tile icon={<Sparkles className="h-4 w-4" />} title="Créditos de IA (mês)">
          {ai ? (
            <>
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  {ai.used.toLocaleString("pt-BR")} / {ai.limit.toLocaleString("pt-BR")} créditos
                </span>
                <span className={cn("tabular-nums", alert && alert.level !== "ok" ? "text-warning" : "text-muted-foreground")}>
                  {alert?.pct ?? 0}%
                </span>
              </div>
              <Progress value={Math.min(100, alert?.pct ?? 0)} className="h-2" />
              <p className="mt-2 text-[11px] text-muted-foreground">
                Saldo adicional de créditos:{" "}
                {ai.extraCredits === null ? "sem dados" : ai.extraCredits.toLocaleString("pt-BR")}
              </p>
              {alertMsg && (
                <ResolveHint tone={alert?.level === "over100" ? "danger" : "warn"}>{alertMsg}</ResolveHint>
              )}
            </>
          ) : (
            <p className="text-xs text-muted-foreground">
              Recursos de IA não estão ativos para esta empresa. O WhatsApp manual, o CRM e as
              automações sem IA continuam funcionando normalmente.
            </p>
          )}
        </Tile>

        {/* Processamentos */}
        <Tile icon={<Activity className="h-4 w-4" />} title="Processamentos">
          {health.processing.pending === null && health.processing.errored === null ? (
            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>Sem dados ainda — este indicador será ligado quando a fila de processamentos estiver disponível.</span>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-muted-foreground">
                {health.processing.pending ?? 0} na fila
              </span>
              <span className="inline-flex items-center gap-1 rounded-md bg-destructive/15 px-2 py-0.5 text-destructive">
                {health.processing.errored ?? 0} com erro
              </span>
            </div>
          )}
        </Tile>
      </div>
    </SectionCard>
  );
}
