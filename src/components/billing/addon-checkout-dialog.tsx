import { useEffect, useState } from "react";
import { ExternalLink, LoaderCircle, ShieldCheck, TestTube2 } from "lucide-react";
import { toast } from "sonner";
import { useCreateAiAddonCheckout } from "@/core/billing";
import { useSession } from "@/core/auth";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { IaPackage } from "./commercial";
import { formatBRL, formatCredits } from "./commercial";
import { billingCustomerSchema, type BillingCustomerForm } from "./checkout-validation";

type Props = {
  package: IaPackage | null;
  onClose: () => void;
};

const emptyForm: BillingCustomerForm = { legalName: "", email: "", taxId: "", phone: "" };

export function AddonCheckoutDialog({ package: selected, onClose }: Props) {
  const session = useSession();
  const checkout = useCreateAiAddonCheckout();
  const [form, setForm] = useState<BillingCustomerForm>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [environment, setEnvironment] = useState<"sandbox" | "production" | null>(null);

  useEffect(() => {
    if (!selected) return;
    setForm({
      legalName: session?.activeOrganization?.organizationName ?? session?.profile.fullName ?? "",
      email: session?.profile.email ?? "",
      taxId: "",
      phone: "",
    });
    setErrors({});
    setPaymentUrl(null);
    setEnvironment(null);
    checkout.reset();
  }, [selected]); // eslint-disable-line react-hooks/exhaustive-deps

  const update = (field: keyof BillingCustomerForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: "" }));
  };

  const createPayment = async () => {
    if (!selected) return;
    const parsed = billingCustomerSchema.safeParse(form);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] = issue.message;
      setErrors(next);
      return;
    }
    try {
      const result = await checkout.mutateAsync({ productId: selected.id, customer: parsed.data });
      setPaymentUrl(result.url);
      setEnvironment(result.environment);
      toast.success("Cobrança de teste criada com segurança.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível criar a cobrança.");
    }
  };

  return (
    <Dialog
      open={Boolean(selected)}
      onOpenChange={(open) => {
        if (!open && !checkout.isPending) onClose();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Comprar {selected?.name}</DialogTitle>
          <DialogDescription>
            {selected
              ? `${formatCredits(selected.credits)} créditos adicionais por ${formatBRL(selected.priceCents)}.`
              : ""}
          </DialogDescription>
        </DialogHeader>

        {paymentUrl ? (
          <div className="space-y-4">
            <Alert>
              <ShieldCheck className="h-4 w-4" />
              <AlertDescription>
                A cobrança foi criada. Os créditos serão liberados automaticamente somente depois da
                confirmação do Asaas.
              </AlertDescription>
            </Alert>
            {environment === "sandbox" && (
              <p className="flex items-center gap-2 rounded-lg bg-warning/10 p-3 text-sm text-warning-foreground">
                <TestTube2 className="h-4 w-4" /> Ambiente de testes: nenhum valor real será
                cobrado.
              </p>
            )}
            <Button asChild className="w-full">
              <a href={paymentUrl} target="_blank" rel="noreferrer">
                Abrir pagamento seguro <ExternalLink className="ml-2 h-4 w-4" />
              </a>
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 py-2 sm:grid-cols-2">
            <Field
              id="billing-name"
              label="Nome ou razão social"
              value={form.legalName}
              error={errors.legalName}
              onChange={(value) => update("legalName", value)}
              className="sm:col-span-2"
            />
            <Field
              id="billing-email"
              label="E-mail financeiro"
              type="email"
              value={form.email}
              error={errors.email}
              onChange={(value) => update("email", value)}
              className="sm:col-span-2"
            />
            <Field
              id="billing-tax-id"
              label="CPF ou CNPJ"
              value={form.taxId}
              error={errors.taxId}
              onChange={(value) => update("taxId", value)}
            />
            <Field
              id="billing-phone"
              label="Telefone (opcional)"
              value={form.phone}
              error={errors.phone}
              onChange={(value) => update("phone", value)}
            />
            <p className="flex items-start gap-2 text-xs text-muted-foreground sm:col-span-2">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Os dados são usados somente
              para criar a cobrança da empresa no Asaas.
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={checkout.isPending}>
            Fechar
          </Button>
          {!paymentUrl && (
            <Button onClick={createPayment} disabled={checkout.isPending}>
              {checkout.isPending && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
              Gerar cobrança segura
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  id,
  label,
  value,
  error,
  onChange,
  type = "text",
  className,
}: {
  id: string;
  label: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
  type?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={Boolean(error)}
        className="mt-1.5"
      />
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}
