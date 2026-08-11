import { createFileRoute, Link } from "@tanstack/react-router";
import { Mail, ArrowLeft, ArrowRight } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { recoverSchema, type RecoverInput, requestPasswordReset } from "@/core/auth";
import { toastFirstError } from "@/lib/form";

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
