import {
  CalendarClock,
  CheckCircle2,
  ExternalLink,
  ReceiptText,
  TriangleAlert,
} from "lucide-react";
import type { BillingOverview, BillingPurchaseStatus, SubscriptionStatus } from "@/core/billing";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SectionCard } from "@/components/shared/section-card";
import { formatBRL, formatCredits } from "./commercial";

const subscriptionLabels: Record<SubscriptionStatus, string> = {
  incomplete: "Aguardando ativação",
  trialing: "Período de teste",
  trial_expired: "Período gratuito encerrado",
  active: "Ativa",
  past_due: "Pagamento atrasado",
  unpaid: "Pagamento pendente",
  paused: "Pausada",
  canceled: "Cancelada",
};

const purchaseLabels: Record<BillingPurchaseStatus, string> = {
  pending: "Aguardando pagamento",
  paid: "Pago",
  failed: "Falhou",
  canceled: "Cancelado",
  refunded: "Reembolsado",
};

export function BillingAccountSummary({
  overview,
  loading,
}: {
  overview?: BillingOverview;
  loading: boolean;
}) {
  if (loading) return <Skeleton className="h-40 rounded-2xl" />;
  const subscription = overview?.subscription;
  const purchases = overview?.purchases ?? [];

  return (
    <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
      <SectionCard title="Situação da assinatura" description="Plano mensal da empresa">
        {subscription ? (
          <div className="space-y-3">
            <Badge variant={subscription.status === "active" ? "default" : "secondary"}>
              {subscriptionLabels[subscription.status]}
            </Badge>
            {subscription.currentPeriodEnd && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <CalendarClock className="h-4 w-4" /> Próxima renovação em{" "}
                {formatDate(subscription.currentPeriodEnd)}
              </p>
            )}
            {subscription.cancelAtPeriodEnd && (
              <p className="text-xs text-warning-foreground">
                Cancelamento programado para o fim do período atual.
              </p>
            )}
          </div>
        ) : (
          <div className="flex items-start gap-3 text-sm text-muted-foreground">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <p>
              A assinatura ainda não foi vinculada ao provedor de pagamentos. O plano configurado na
              empresa continua visível, mas não indicamos uma cobrança ativa.
            </p>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Compras recentes" description="Últimos pacotes adicionais de IA">
        {purchases.length ? (
          <div className="divide-y divide-border">
            {purchases.slice(0, 5).map((purchase) => (
              <div
                key={purchase.id}
                className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-start gap-3">
                  {purchase.status === "paid" ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                  ) : (
                    <ReceiptText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{purchase.productName}</p>
                    <p className="text-xs text-muted-foreground">
                      +{formatCredits(purchase.credits)} créditos ·{" "}
                      {formatBRL(purchase.amountCents)} · {formatDate(purchase.createdAt)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 pl-7 sm:pl-0">
                  <Badge variant="outline">{purchaseLabels[purchase.status]}</Badge>
                  {purchase.status === "pending" && purchase.invoiceUrl && (
                    <Button variant="ghost" size="sm" asChild>
                      <a href={purchase.invoiceUrl} target="_blank" rel="noreferrer">
                        Pagar <ExternalLink className="ml-1 h-3.5 w-3.5" />
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Nenhuma compra adicional realizada até agora.
          </p>
        )}
      </SectionCard>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(value));
}
