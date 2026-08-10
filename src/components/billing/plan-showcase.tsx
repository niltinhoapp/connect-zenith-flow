/**
 * PlanShowcase — apresentação comercial do plano e dos pacotes de IA (Claude).
 *
 * Mostra o plano único ConnectWeb Completo e os pacotes adicionais de créditos
 * de IA. A ação "Comprar" NÃO realiza cobrança enquanto o contrato real do
 * Codex não estiver ligado: sem `onPurchasePackage`, abre um aviso claro de que
 * nada foi cobrado. `onPurchasePackage` é o ponto de integração tipado.
 */
import { useState } from "react";
import { Check, Sparkles, Info } from "lucide-react";
import { SectionCard } from "@/components/shared/section-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import {
  CONNECTWEB_PLAN,
  IA_PACKAGES,
  formatBRL,
  formatCredits,
  type IaPackage,
} from "./commercial";

const PLAN_POINTS = [
  "Todos os módulos e fluxos incluídos: CRM, WhatsApp, Automações, Relatórios e IA.",
  "Desativar um módulo não reduz a mensalidade — você mantém tudo à disposição.",
  "Sem créditos de IA, o WhatsApp manual, o CRM e as automações sem IA seguem funcionando.",
];

export interface PlanShowcaseProps {
  plan?: { name: string; priceCents: number };
  packages?: IaPackage[];
  /** Ponto de integração do Codex: liga a compra real do pacote. */
  onPurchasePackage?: (pkg: IaPackage) => void;
  onSubscribe?: () => void;
  canPurchaseAddons?: boolean;
  subscriptionActive?: boolean;
  subscriptionOfferAvailable?: boolean;
}

export function PlanShowcase({
  plan = CONNECTWEB_PLAN,
  packages = IA_PACKAGES,
  onPurchasePackage,
  onSubscribe,
  canPurchaseAddons = false,
  subscriptionActive = false,
  subscriptionOfferAvailable = true,
}: PlanShowcaseProps) {
  const [pending, setPending] = useState<IaPackage | null>(null);

  const buy = (pkg: IaPackage) => {
    if (onPurchasePackage) onPurchasePackage(pkg);
    else setPending(pkg);
  };

  return (
    <div className="space-y-4">
      {!subscriptionActive && subscriptionOfferAvailable && (
      <SectionCard title="Seu plano" description="Plano único, tudo incluído">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="border-0 bg-primary/15 text-primary">{plan.name}</Badge>
              <span className="text-sm text-muted-foreground">
                <span className="text-base font-semibold text-foreground">
                  {formatBRL(plan.priceCents)}
                </span>
                /mês
              </span>
            </div>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              {PLAN_POINTS.map((point) => (
                <li key={point} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>
          {!subscriptionActive && onSubscribe && (
            <Button onClick={onSubscribe} className="shrink-0">
              Assinar agora
            </Button>
          )}
        </div>

        <div className="mt-4 flex items-start gap-2 rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
          <span>
            As mensagens e conversas do WhatsApp são cobradas pela Meta diretamente da sua conta e{" "}
            <span className="font-medium text-foreground">não estão incluídas</span> na mensalidade
            da ConnectWeb.
          </span>
        </div>
      </SectionCard>
      )}

      <SectionCard
        title="Pacotes adicionais de IA"
        description="A franquia mensal é renovada todo mês. Precisa de mais? Some créditos avulsos."
      >
        <div className="grid gap-3 sm:grid-cols-3">
          {packages.map((pkg) => (
            <div
              key={pkg.id}
              className={cn(
                "flex flex-col rounded-xl border bg-card p-4",
                pkg.highlight
                  ? "border-primary/40 ring-1 ring-inset ring-primary/20"
                  : "border-border",
              )}
            >
              <div className="flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
                <p className="text-sm font-semibold">{pkg.name}</p>
                {pkg.highlight && (
                  <Badge className="ml-auto border-0 bg-primary/15 text-[10px] text-primary">
                    Mais popular
                  </Badge>
                )}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                +{formatCredits(pkg.credits)} créditos de IA
              </p>
              <p className="mt-1 text-lg font-semibold">{formatBRL(pkg.priceCents)}</p>
              <Button
                className="mt-3 w-full"
                variant={pkg.highlight ? "default" : "outline"}
                onClick={() => buy(pkg)}
                disabled={!canPurchaseAddons}
              >
                Comprar
              </Button>
            </div>
          ))}
        </div>
        {!canPurchaseAddons && (
          <p className="mt-3 text-[11px] text-muted-foreground">
            Ative a assinatura principal para comprar créditos adicionais.
          </p>
        )}
        {!onPurchasePackage && (
          <p className="mt-3 text-[11px] text-muted-foreground">
            A finalização da compra será ativada em breve. Nenhuma cobrança é feita ao clicar em
            “Comprar” por enquanto.
          </p>
        )}
      </SectionCard>

      <AlertDialog
        open={!!pending}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> Compra em breve
            </AlertDialogTitle>
            <AlertDialogDescription>
              A compra do pacote{" "}
              <span className="font-medium text-foreground">{pending?.name}</span> (
              {pending ? formatCredits(pending.credits) : ""} créditos de IA por{" "}
              {pending ? formatBRL(pending.priceCents) : ""}) estará disponível em breve.{" "}
              <span className="font-medium text-foreground">Nenhuma cobrança foi feita.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Entendi</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
