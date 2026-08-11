import { createFileRoute, Link } from "@tanstack/react-router";
import { Mail, Lock, User, Building2, ArrowRight, Check } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signupSchema, type SignupInput, signUpWithOrganization } from "@/core/auth";
import { toastFirstError } from "@/lib/form";

export const Route = createFileRoute("/cadastro")({
  head: () => ({
    meta: [
      { title: "Criar conta — ConnectWeb Automations" },
      { name: "description", content: "Crie sua conta ConnectWeb e comece em minutos." },
    ],
  }),
  component: CadastroPage,
});

function CadastroPage() {
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<SignupInput>({ resolver: zodResolver(signupSchema) });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await signUpWithOrganization(values);
      toast.success("Conta e workspace criados! Bem-vindo.");
      // O provisionamento altera sessão e organização ativa. Uma navegação
      // completa faz o SSR reconstruir esse contexto a partir dos cookies.
      window.location.assign("/");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível criar a conta.");
    }
  }, toastFirstError);

  return (
    <AuthShell
      title="Crie sua conta"
      subtitle="14 dias grátis. Sem cartão de crédito."
      footer={
        <>
          Já tem conta?{" "}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Entrar
          </Link>
        </>
      }
    >
      <form className="space-y-4" onSubmit={onSubmit}>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Nome</Label>
            <div className="relative mt-1.5">
              <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Rafael"
                className="h-10 rounded-lg border-border bg-card pl-9"
                {...register("firstName")}
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Sobrenome</Label>
            <Input
              placeholder="Alves"
              className="mt-1.5 h-10 rounded-lg border-border bg-card"
              {...register("lastName")}
            />
          </div>
        </div>

        <div>
          <Label className="text-xs">Empresa</Label>
          <div className="relative mt-1.5">
            <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Nome da empresa"
              className="h-10 rounded-lg border-border bg-card pl-9"
              {...register("companyName")}
            />
          </div>
        </div>

        <div>
          <Label className="text-xs">E-mail corporativo</Label>
          <div className="relative mt-1.5">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="email"
              placeholder="voce@empresa.com"
              className="h-10 rounded-lg border-border bg-card pl-9"
              {...register("email")}
            />
          </div>
        </div>

        <div>
          <Label className="text-xs">Senha</Label>
          <div className="relative mt-1.5">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="password"
              placeholder="Mínimo 8 caracteres"
              className="h-10 rounded-lg border-border bg-card pl-9"
              {...register("password")}
            />
          </div>
          <ul className="mt-2 space-y-1 text-[11px] text-muted-foreground">
            {["8+ caracteres", "Letra maiúscula", "Número ou símbolo"].map((r) => (
              <li key={r} className="flex items-center gap-1.5">
                <Check className="h-3 w-3 text-success" /> {r}
              </li>
            ))}
          </ul>
        </div>

        <Button
          type="submit"
          disabled={isSubmitting}
          className="h-10 w-full rounded-lg bg-primary text-sm font-medium hover:bg-primary/90"
        >
          Criar conta grátis <ArrowRight className="ml-1.5 h-4 w-4" />
        </Button>

        <p className="text-center text-[11px] text-muted-foreground">
          Ao continuar você concorda com nossos{" "}
          <a className="text-primary hover:underline" href="#">
            Termos
          </a>{" "}
          e{" "}
          <a className="text-primary hover:underline" href="#">
            Política de Privacidade
          </a>
          .
        </p>
      </form>
    </AuthShell>
  );
}
