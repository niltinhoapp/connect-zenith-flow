import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/**
 * SectionCard — titled content panel used across the app.
 * Moved from the former `components/premium.tsx`. Markup unchanged.
 */
export function SectionCard({
  title,
  description,
  action,
  children,
  className,
  padded = true,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-2xl border border-border bg-card",
        className,
      )}
    >
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            {title && (
              <h3 className="truncate text-sm font-semibold text-foreground">{title}</h3>
            )}
            {description && (
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {description}
              </p>
            )}
          </div>
          {action}
        </header>
      )}
      <div className={cn(padded && "p-5")}>{children}</div>
    </section>
  );
}
