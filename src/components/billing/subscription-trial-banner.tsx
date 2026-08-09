import { Link } from "@tanstack/react-router";
import { Clock3, CreditCard, TriangleAlert } from "lucide-react";
import { useBillingAccess } from "@/core/billing";
import { Button } from "@/components/ui/button";

export function SubscriptionTrialBanner() {
  const access = useBillingAccess();
  if (!access.data || access.data.status === "active") return null;

  const trial = access.data.status === "trialing";
  return (
    <div
      className={
        trial
          ? "border-b border-primary/20 bg-primary/5"
          : "border-b border-warning/30 bg-warning/10"
      }
    >
      <div className="flex flex-col gap-2 px-4 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between md:px-8">
        <div className="flex items-start gap-2">
          {trial ? (
            <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          ) : (
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          )}
          <p>
            {trial
              ? `Período gratuito: ${access.data.trialDaysRemaining} ${access.data.trialDaysRemaining === 1 ? "dia restante" : "dias restantes"}. Explore todos os recursos.`
              : "Seu período gratuito terminou. Seus dados continuam seguros; assine para retomar as operações."}
          </p>
        </div>
        <Button size="sm" asChild className="shrink-0 self-start sm:self-auto">
          <Link to="/configuracoes">
            <CreditCard className="mr-1.5 h-4 w-4" />
            Assinar por R$ 549,79/mês
          </Link>
        </Button>
      </div>
    </div>
  );
}
