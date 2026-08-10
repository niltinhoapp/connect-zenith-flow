import { useState, type ReactNode } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { CopilotLauncher } from "@/components/copilot/copilot-launcher";
import { CopilotFocusProvider } from "@/components/copilot/copilot-focus";
import { SubscriptionTrialBanner } from "@/components/billing/subscription-trial-banner";

/**
 * AppLayout — the authenticated workspace shell.
 *
 * Composes the extracted <Sidebar /> and <Header /> primitives and owns the
 * shared `collapsed` state that keeps both in sync. Rendered output is
 * identical to the original monolithic layout; only the internal structure was
 * split for reuse (see docs/ARCHITECTURE.md). Public import path is unchanged.
 */
export function AppLayout({
  children,
  title,
  subtitle,
  actions,
}: {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <CopilotFocusProvider>
      <div className="flex min-h-screen bg-background text-foreground">
        <Sidebar collapsed={collapsed} />

        <div className="flex min-w-0 flex-1 flex-col">
          <Header collapsed={collapsed} onToggleSidebar={() => setCollapsed((c) => !c)} />
          <SubscriptionTrialBanner />

          {(title || actions) && (
            <div className="border-b border-border/70 bg-background/60">
              <div className="flex flex-col gap-3 px-4 py-6 md:flex-row md:items-end md:justify-between md:px-8">
                <div className="min-w-0">
                  {title && (
                    <h1 className="truncate text-2xl font-semibold tracking-tight text-foreground">
                      {title}
                    </h1>
                  )}
                  {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
                </div>
                {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
              </div>
            </div>
          )}

          <main className="flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
        </div>

        {/* Copiloto global: botão flutuante "Ajuda + IA" (onboarding, ajuda e ações). */}
        <CopilotLauncher />
      </div>
    </CopilotFocusProvider>
  );
}
