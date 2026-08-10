import { useEffect, useState } from "react";
import { ExternalLink, LoaderCircle, ShieldCheck, TestTube2 } from "lucide-react";
import { toast } from "sonner";
import { useCreateSubscriptionCheckout } from "@/core/billing";
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
import { formatBRL } from "./commercial";
import {
  subscriptionBillingCustomerSchema,
  type SubscriptionBillingCustomerForm,
} from "./checkout-validation";

export function SubscriptionCheckoutDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const session = useSession();
  const checkout = useCreateSubscriptionCheckout();
  const [form, setForm] = useState<SubscriptionBillingCustomerForm>({
    legalName: "",
    email: "",
    taxId: "",
    phone: "",
    postalCode: "",
    address: "",
    addressNumber: "",
    province: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{ url: string; sandbox: boolean } | null>(null);

  useEffect(() => {
    if (!open) return;
    setForm({
      legalName: session?.activeOrganization?.organizationName ?? session?.profile.fullName ?? "",
      email: session?.profile.email ?? "",
      taxId: "",
      phone: "",
      postalCode: "",
      address: "",
      addressNumber: "",
      province: "",
    });
    setErrors({});
    setResult(null);
    checkout.reset();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const update = (field: keyof SubscriptionBillingCustomerForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: "" }));
  };
  const submit = async () => {
    const parsed = subscriptionBillingCustomerSchema.safeParse(form);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] = issue.message;
      setErrors(next);
      return;
    }
    try {
      const response = await checkout.mutateAsync({ customer: parsed.data });
      setResult({ url: response.url, sandbox: response.environment === "sandbox" });
      toast.success("Checkout da assinatura criado.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível iniciar a assinatura.",
      );
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value && !checkout.isPending) onClose();
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Assinar ConnectWeb Completo</DialogTitle>
          <DialogDescription>
            {formatBRL(54_979)}/mês · todos os módulos incluídos.
          </DialogDescription>
        </DialogHeader>
        {result ? (
          <div className="space-y-4">
            <Alert>
              <ShieldCheck className="h-4 w-4" />
              <AlertDescription>
                O checkout foi criado. A assinatura só será ativada após a confirmação do Asaas.
              </AlertDescription>
            </Alert>
            {result.sandbox && (
              <p className="flex items-center gap-2 rounded-lg bg-warning/10 p-3 text-sm">
                <TestTube2 className="h-4 w-4" />
                Ambiente de testes: nenhuma cobrança real será feita.
              </p>
            )}
            <Button asChild className="w-full">
              <a href={result.url} target="_blank" rel="noreferrer">
                Abrir checkout seguro <ExternalLink className="ml-2 h-4 w-4" />
              </a>
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 py-2 sm:grid-cols-2">
            <Field
              id="subscription-name"
              label="Nome ou razão social"
              value={form.legalName}
              error={errors.legalName}
              onChange={(v) => update("legalName", v)}
              wide
            />
            <Field
              id="subscription-email"
              label="E-mail financeiro"
              type="email"
              value={form.email}
              error={errors.email}
              onChange={(v) => update("email", v)}
              wide
            />
            <Field
              id="subscription-tax"
              label="CPF ou CNPJ"
              value={form.taxId}
              error={errors.taxId}
              onChange={(v) => update("taxId", v)}
            />
            <Field
              id="subscription-phone"
              label="Telefone (opcional)"
              value={form.phone}
              error={errors.phone}
              onChange={(v) => update("phone", v)}
            />
            <Field
              id="subscription-postal-code"
              label="CEP"
              value={form.postalCode}
              error={errors.postalCode}
              onChange={(v) => update("postalCode", v)}
            />
            <Field
              id="subscription-province"
              label="Bairro"
              value={form.province}
              error={errors.province}
              onChange={(v) => update("province", v)}
            />
            <Field
              id="subscription-address"
              label="Endereço"
              value={form.address}
              error={errors.address}
              onChange={(v) => update("address", v)}
            />
            <Field
              id="subscription-address-number"
              label="Número"
              value={form.addressNumber}
              error={errors.addressNumber}
              onChange={(v) => update("addressNumber", v)}
            />
            <p className="flex items-start gap-2 text-xs text-muted-foreground sm:col-span-2">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Os dados do cartão serão informados somente na página segura do Asaas.
            </p>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={checkout.isPending}>
            Fechar
          </Button>
          {!result && (
            <Button onClick={submit} disabled={checkout.isPending}>
              {checkout.isPending && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
              Continuar para pagamento
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
  wide = false,
}: {
  id: string;
  label: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
  type?: string;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
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
