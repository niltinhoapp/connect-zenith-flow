import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export const Route = createFileRoute("/verificar-2fa")({
  head: () => ({ meta: [{ title: "Verificação em duas etapas — ConnectWeb" }] }),
  component: VerifyMfaPage,
});

function VerifyMfaPage() {
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getSupabaseBrowserClient()
      .auth.mfa.listFactors()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) toast.error(error.message);
        const factor = data?.totp?.find((item) => item.status === "verified");
        setFactorId(factor?.id ?? null);
      })
      .catch(() => {
        if (active) setFactorId(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const verify = async () => {
    if (!factorId || code.length !== 6) return;
    setBusy(true);
    const { error } = await getSupabaseBrowserClient().auth.mfa.challengeAndVerify({ factorId, code });
    setBusy(false);
    if (error) {
      toast.error("Código inválido. Confira o aplicativo e tente novamente.");
      return;
    }
    window.location.assign("/");
  };

  if (!loading && !factorId) {
    return (
      <AuthShell title="Confirme que é você" subtitle="Não encontramos um aplicativo autenticador ativo nesta conta.">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Talvez a verificação em duas etapas não esteja concluída. Entre novamente para tentar de novo
            ou revise a configuração em Segurança.
          </p>
          <Link
            to="/login"
            className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Voltar para o login
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Confirme que é você" subtitle="Digite o código do seu aplicativo autenticador.">
      <div className="space-y-4">
        <div>
          <Label htmlFor="mfa-code" className="text-xs">Código de 6 números</Label>
          <div className="relative mt-1.5">
            <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input id="mfa-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} autoFocus value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} onKeyDown={(event) => { if (event.key === "Enter") void verify(); }} className="h-11 pl-9 text-center text-lg tracking-[0.3em]" />
          </div>
        </div>
        <Button className="h-10 w-full" disabled={busy || !factorId || code.length !== 6} onClick={verify}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Verificar e entrar</Button>
      </div>
    </AuthShell>
  );
}
