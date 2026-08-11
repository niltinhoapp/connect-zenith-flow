import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Mail, ArrowLeft, ArrowRight, LoaderCircle, LockKeyhole } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  recoverSchema,
  resetPasswordSchema,
  type RecoverInput,
  type ResetPasswordInput,
  requestPasswordReset,
  updatePassword,
} from "@/core/auth";
import { toastFirstError } from "@/lib/form";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export const Route = createFileRoute("/recuperar-senha")({
  head: () => ({
    meta: [
      { title: "Recuperar senha — ConnectWeb Automations" },
      { name: "description", content: "Redefina sua senha ConnectWeb." },
    ],
  }),
  component: ResetPage,
});

function ResetPage() {
  const [recoveryState, setRecoveryState] = useState<"request" | "loading" | "ready" | "expired">(
    "loading",
  );

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    const url = new URL(window.location.href);
    const hash = new URLSearchParams(url.hash.slice(1));
    const code = url.searchParams.get("code");
    const isRecoveryLink =
      url.searchParams.get("type") === "recovery" ||
      hash.get("type") === "recovery" ||
      Boolean(code);
    let active = true;

    const finishRecovery = async () => {
      try {
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        }

        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!active) return;

        if (session && isRecoveryLink) {
          window.history.replaceState({}, document.title, "/recuperar-senha");
          setRecoveryState("ready");
        } else {
          setRecoveryState(isRecoveryLink ? "expired" : "request");
        }
      } catch {
        if (active) setRecoveryState("expired");
      }
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (active && event === "PASSWORD_RECOVERY") {
        window.history.replaceState({}, document.title, "/recuperar-senha");
        setRecoveryState("ready");
      }
    });

    void finishRecovery();
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  if (recoveryState === "loading") {
    return (
      <AuthShell title="Validando link" subtitle="Estamos verificando seu acesso seguro.">
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <LoaderCircle
            className="h-6 w-6 animate-spin"
            aria-label="Validando link de recuperação"
          />
        </div>
      </AuthShell>
    );
  }

  if (recoveryState === "ready") return <NewPasswordForm />;

  if (recoveryState === "expired") {
    return (
      <AuthShell
        title="Link inválido ou expirado"
        subtitle="Solicite um novo link para redefinir sua senha."
        footer={
          <Link to="/login" className="text-primary hover:underline">
            Voltar para login
          </Link>
        }
      >
        <Button
          type="button"
          className="h-10 w-full rounded-lg"
          onClick={() => setRecoveryState("request")}
        >
          Solicitar novo link
        </Button>
      </AuthShell>
    );
  }

  return <RequestResetForm />;
}

function RequestResetForm() {
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<RecoverInput>({ resolver: zodResolver(recoverSchema) });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await requestPasswordReset(values.email);
      toast.success("Se o e-mail existir, enviamos um link de recuperação.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível enviar o link.");
    }
  }, toastFirstError);

  return (
    <AuthShell
      title="Recuperar acesso"
      subtitle="Enviaremos um link seguro para o seu e-mail."
      footer={
        <Link
          to="/login"
          className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar para login
        </Link>
      }
    >
      <form className="space-y-4" onSubmit={onSubmit}>
        <div>
          <Label className="text-xs">E-mail</Label>
          <div className="relative mt-1.5">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="email"
              placeholder="voce@empresa.com"
              className="h-10 rounded-lg border-border bg-card pl-9"
              {...register("email")}
            />
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            Use o mesmo e-mail cadastrado na sua conta.
          </p>
        </div>

        <Button
          type="submit"
          disabled={isSubmitting}
          className="h-10 w-full rounded-lg bg-primary text-sm font-medium hover:bg-primary/90"
        >
          Enviar link de recuperação <ArrowRight className="ml-1.5 h-4 w-4" />
        </Button>
      </form>
    </AuthShell>
  );
}

function NewPasswordForm() {
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<ResetPasswordInput>({ resolver: zodResolver(resetPasswordSchema) });

  const onSubmit = handleSubmit(async ({ password }) => {
    try {
      await updatePassword(password);
      toast.success("Senha atualizada. Entre novamente com sua nova senha.");
      await getSupabaseBrowserClient().auth.signOut();
      window.setTimeout(() => window.location.assign("/login"), 1200);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível atualizar a senha.");
    }
  }, toastFirstError);

  return (
    <AuthShell title="Defina sua nova senha" subtitle="Use pelo menos 8 caracteres.">
      <form className="space-y-4" onSubmit={onSubmit}>
        <div>
          <Label htmlFor="new-password" className="text-xs">
            Nova senha
          </Label>
          <div className="relative mt-1.5">
            <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              className="h-10 rounded-lg border-border bg-card pl-9"
              {...register("password")}
            />
          </div>
        </div>
        <div>
          <Label htmlFor="confirm-password" className="text-xs">
            Confirmar nova senha
          </Label>
          <div className="relative mt-1.5">
            <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              className="h-10 rounded-lg border-border bg-card pl-9"
              {...register("confirmPassword")}
            />
          </div>
        </div>
        <Button
          type="submit"
          disabled={isSubmitting}
          className="h-10 w-full rounded-lg bg-primary text-sm font-medium hover:bg-primary/90"
        >
          {isSubmitting ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
          Salvar nova senha
        </Button>
      </form>
    </AuthShell>
  );
}
