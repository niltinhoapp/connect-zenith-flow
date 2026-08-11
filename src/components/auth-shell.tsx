import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Sparkles, Zap, Shield, LineChart } from "lucide-react";
import { BrandMark } from "@/components/layout/brand-mark";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
      {/* Left panel — form */}
      <div className="flex flex-col px-6 py-8 md:px-12 md:py-10">
        <Link to="/" className="inline-flex items-center gap-2.5">
          <BrandMark />
          <div>
            <p className="text-sm font-semibold leading-none">ConnectWeb</p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">Automations</p>
          </div>
        </Link>

        <div className="flex flex-1 items-center">
          <div className="mx-auto w-full max-w-sm">
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>
            <div className="mt-8">{children}</div>
          </div>
        </div>

        {footer && <p className="text-center text-xs text-muted-foreground">{footer}</p>}
      </div>

      {/* Right panel — brand */}
      <div className="relative hidden overflow-hidden border-l border-border bg-gradient-to-br from-primary/10 via-background to-background lg:block">
        <div className="absolute inset-0 subtle-grid opacity-40" />
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />

        <div className="relative flex h-full flex-col justify-between p-12">
          <div className="inline-flex w-max items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs backdrop-blur-md">
            <Sparkles className="h-3 w-3 text-primary" />
            <span className="text-muted-foreground">
              Novidade: <span className="text-foreground">Copilot IA nativo</span>
            </span>
          </div>

          <div className="max-w-md">
            <h2 className="text-3xl font-semibold leading-tight tracking-tight">
              Automatize seu negócio com a elegância de um produto premium.
            </h2>
            <p className="mt-4 text-sm text-muted-foreground">
              CRM, WhatsApp, automações e IA — tudo em uma única plataforma feita para times de alta
              performance.
            </p>

            <div className="mt-8 grid grid-cols-1 gap-3">
              {[
                { i: Zap, t: "Fluxos visuais em minutos" },
                { i: LineChart, t: "Insights automáticos com IA" },
                { i: Shield, t: "Segurança e privacidade em primeiro lugar" },
              ].map((f) => (
                <div
                  key={f.t}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card/50 p-3 backdrop-blur-md"
                >
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary ring-1 ring-inset ring-primary/25">
                    <f.i className="h-4 w-4" />
                  </div>
                  <p className="text-sm">{f.t}</p>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} ConnectWeb Automations. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </div>
  );
}
