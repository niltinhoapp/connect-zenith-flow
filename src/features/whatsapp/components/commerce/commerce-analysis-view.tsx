/**
 * CommerceAnalysisView — cockpit visual do "atendente comercial" (frente Claude).
 *
 * Transforma o CommerceAnalysis (do Codex) num fluxo estruturado — não um
 * chatbot: mostra a etapa do pedido, o que o cliente quer, entrega, pagamento,
 * troco, o que ainda falta e a resposta sugerida. "Usar resposta" só preenche o
 * campo de mensagem; nunca envia. Confirmação e execução seguem com o atendente.
 *
 * Consome o contrato real; não inventa dados. Nunca expõe IDs/tokens.
 */
import {
  ShoppingBag,
  Truck,
  Store,
  MapPin,
  CreditCard,
  AlertTriangle,
  PenLine,
  UserCog,
  CheckCircle2,
  Database,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { CommerceAnalysis, CommerceStage } from "@/features/whatsapp/domain";

const money = (cents: number | null): string =>
  cents === null
    ? "—"
    : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

const INTENT_LABEL: Record<CommerceAnalysis["intent"], string> = {
  order: "Fazendo um pedido",
  catalog: "Quer ver o catálogo",
  question: "Tirando uma dúvida",
  support: "Precisa de suporte",
  other: "Conversa geral",
};

const PAYMENT_LABEL: Record<string, string> = { pix: "Pix", card: "Cartão", cash: "Dinheiro" };

const CONFIDENCE_LABEL: Record<CommerceAnalysis["confidence"], string> = {
  high: "Alta confiança",
  medium: "Confiança média",
  low: "Baixa confiança",
};

/** Etapas lineares do pedido (handoff é tratado à parte). */
const STAGE_STEPS: { id: CommerceStage; label: string }[] = [
  { id: "discovery", label: "Início" },
  { id: "collecting_items", label: "Itens" },
  { id: "collecting_fulfillment", label: "Entrega" },
  { id: "collecting_address", label: "Endereço" },
  { id: "collecting_payment", label: "Pagamento" },
  { id: "awaiting_confirmation", label: "Confirmar" },
  { id: "confirmed", label: "Concluído" },
];

function StageStepper({ stage }: { stage: CommerceStage }) {
  const current = STAGE_STEPS.findIndex((s) => s.id === stage);
  // "handoff" não é uma etapa linear; mantém o passo anterior destacado.
  const activeIndex = current === -1 ? STAGE_STEPS.length - 1 : current;
  return (
    <ol className="flex flex-wrap items-center gap-x-1 gap-y-1.5" aria-label="Etapa do pedido">
      {STAGE_STEPS.map((step, index) => {
        const done = index < activeIndex;
        const active = index === activeIndex;
        return (
          <li key={step.id} className="flex items-center gap-1">
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-medium",
                active
                  ? "bg-primary text-primary-foreground"
                  : done
                    ? "bg-primary/15 text-primary"
                    : "bg-muted text-muted-foreground",
              )}
              aria-current={active ? "step" : undefined}
            >
              {step.label}
            </span>
            {index < STAGE_STEPS.length - 1 && (
              <span className="text-muted-foreground/40" aria-hidden="true">›</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function CommerceAnalysisView({
  analysis,
  onUseReply,
  onRegisterCrm,
  registeringCrm = false,
}: {
  analysis: CommerceAnalysis;
  onUseReply?: (text: string) => void;
  onRegisterCrm?: () => void;
  registeringCrm?: boolean;
}) {
  const a = analysis;

  return (
    <div className="space-y-3">
      {/* Fluxo: em que etapa o atendimento está */}
      <StageStepper stage={a.stage} />

      {/* Intenção + confiança */}
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge className="border-0 bg-primary/15 text-[11px] text-primary">{INTENT_LABEL[a.intent]}</Badge>
        <Badge className="border-0 bg-muted text-[11px] text-muted-foreground">{CONFIDENCE_LABEL[a.confidence]}</Badge>
      </div>

      {a.needsHuman && (
        <p className="flex items-start gap-1.5 rounded-lg bg-warning/10 px-2.5 py-1.5 text-xs text-warning">
          <UserCog className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Este atendimento precisa da sua atenção antes de seguir.
        </p>
      )}

      {/* Pedido */}
      <div className="rounded-lg border border-border bg-card p-2.5">
        <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-foreground">
          <ShoppingBag className="h-3.5 w-3.5 text-primary" aria-hidden="true" /> Pedido
        </p>
        {a.items.length > 0 ? (
          <ul className="space-y-0.5 text-xs text-foreground">
            {a.items.map((item, index) => (
              <li key={index} className="flex gap-1.5">
                <span className="tabular-nums text-muted-foreground">{item.quantity ?? "?"}×</span>
                <span>{item.description}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">Nenhum item confirmado ainda.</p>
        )}
      </div>

      {/* Entrega + pagamento */}
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-2.5 text-xs">
          <p className="mb-1 flex items-center gap-1.5 font-medium text-foreground">
            {a.fulfillment === "pickup" ? (
              <Store className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
            ) : (
              <Truck className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
            )}
            {a.fulfillment === "delivery" ? "Entrega" : a.fulfillment === "pickup" ? "Retirada" : "Entrega/retirada"}
          </p>
          {a.fulfillment === null && <p className="text-muted-foreground">A definir com o cliente.</p>}
          {a.address && (
            <p className="flex items-start gap-1 text-muted-foreground">
              <MapPin className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
              {a.address}
            </p>
          )}
        </div>
        <div className="rounded-lg border border-border bg-card p-2.5 text-xs">
          <p className="mb-1 flex items-center gap-1.5 font-medium text-foreground">
            <CreditCard className="h-3.5 w-3.5 text-primary" aria-hidden="true" /> Pagamento
          </p>
          <p className="text-muted-foreground">
            {a.paymentMethod ? PAYMENT_LABEL[a.paymentMethod] : "A definir"}
            {a.orderTotalCents !== null && <> · Total {money(a.orderTotalCents)}</>}
          </p>
          {a.changeCents !== null && (
            <p className="text-muted-foreground">Troco: {money(a.changeCents)}</p>
          )}
        </div>
      </div>

      {/* O que ainda falta */}
      {a.missingFields.length > 0 ? (
        <div>
          <p className="mb-1 text-[11px] font-medium text-foreground">Ainda falta</p>
          <div className="flex flex-wrap gap-1.5">
            {a.missingFields.map((field, index) => (
              <span key={index} className="rounded-md bg-warning/15 px-2 py-0.5 text-[11px] text-warning">
                {field}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <p className="flex items-center gap-1.5 text-xs text-success">
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> Dados essenciais completos.
        </p>
      )}

      {/* Avisos da IA */}
      {a.warnings.length > 0 && (
        <ul className="space-y-1">
          {a.warnings.map((warning, index) => (
            <li key={index} className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-warning" aria-hidden="true" />
              {warning}
            </li>
          ))}
        </ul>
      )}

      {/* Próxima ação: resposta sugerida (preenche, nunca envia) */}
      {a.suggestedReply && (
        <div className="rounded-lg border border-primary/25 bg-primary/5 p-2.5">
          <p className="mb-1 text-[11px] font-semibold text-primary">Próxima resposta sugerida</p>
          <p className="whitespace-pre-wrap text-xs text-foreground">{a.suggestedReply}</p>
          {onUseReply && (
            <div className="mt-2">
              <Button
                size="sm"
                className="h-7 gap-1 text-[11px]"
                onClick={() => onUseReply(a.suggestedReply)}
                aria-label="Usar resposta sugerida: preencher o campo de mensagem"
              >
                <PenLine className="h-3 w-3" aria-hidden="true" /> Usar resposta
              </Button>
              <p className="mt-1 text-[10px] text-muted-foreground">
                Preenche o campo de mensagem. Você revisa e confirma com o cliente antes de enviar —
                nada é enviado automaticamente.
              </p>
            </div>
          )}
        </div>
      )}

      {onRegisterCrm && (
        <div className="rounded-lg border border-border bg-card p-2.5">
          <Button size="sm" className="h-8 gap-1.5 text-xs" disabled={registeringCrm} onClick={onRegisterCrm}>
            {registeringCrm ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Database className="h-3.5 w-3.5" />}
            {registeringCrm ? "Registrando…" : "Registrar no CRM"}
          </Button>
          <p className="mt-1 text-[10px] text-muted-foreground">Você verá uma prévia e precisará confirmar antes de qualquer gravação.</p>
        </div>
      )}
    </div>
  );
}
