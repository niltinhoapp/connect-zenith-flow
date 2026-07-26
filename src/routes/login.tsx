import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { Mail, Lock, ArrowRight } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { loginSchema, type LoginInput, signIn } from "@/core/auth";
import { toastFirstError } from "@/lib/form";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Entrar — ConnectWeb Automations" },
      { name: "description", content: "Acesse sua conta ConnectWeb." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await signIn(values);
      await router.invalidate();
      await navigate({ to: "/" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível entrar.");
    }
  }, toastFirstError);

  return (
    <AuthShell
      title="Bem-vindo de volta"
      subtitle="Entre com seu e-mail corporativo para continuar."
      footer={
        <>
          Ainda não tem conta?{" "}
          <Link to="/cadastro" className="font-medium text-primary hover:underline">
            Criar conta
          </Link>
        </>
      }
    >
      <div className="space-y-3">
        <Button type="button" variant="outline" className="h-10 w-full rounded-lg border-border bg-card">
          <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24"><path fill="currentColor" d="M12 11v2h5.5c-.2 1.4-1.7 4-5.5 4-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.9 2.9 14.7 2 12 2 6.5 2 2 6.5 2 12s4.5 10 10 10c5.8 0 9.6-4.1 9.6-9.8 0-.7 0-1.2-.2-1.7H12z"/></svg>
          Continuar com Google
        </Button>
      </div>

      <div className="relative my-6 flex items-center gap-3 text-[10px] uppercase tracking-wider text-muted-foreground">
        <Separator className="flex-1 bg-border" />
        ou com e-mail
        <Separator className="flex-1 bg-border" />
      </div>

      <form className="space-y-4" onSubmit={onSubmit}>
        <div>
          <Label htmlFor="email" className="text-xs">E-mail</Label>
          <div className="relative mt-1.5">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input id="email" type="email" placeholder="voce@empresa.com" className="h-10 rounded-lg border-border bg-card pl-9" {...register("email")} />
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between">
            <Label htmlFor="pwd" className="text-xs">Senha</Label>
            <Link to="/recuperar-senha" className="text-xs text-primary hover:underline">Esqueci a senha</Link>
          </div>
          <div className="relative mt-1.5">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input id="pwd" type="password" placeholder="••••••••" className="h-10 rounded-lg border-border bg-card pl-9" {...register("password")} />
          </div>
        </div>

        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <Checkbox /> Manter conectado por 30 dias
        </label>

        <Button type="submit" disabled={isSubmitting} className="h-10 w-full rounded-lg bg-primary text-sm font-medium hover:bg-primary/90">
          Entrar <ArrowRight className="ml-1.5 h-4 w-4" />
        </Button>
      </form>
    </AuthShell>
  );
}
