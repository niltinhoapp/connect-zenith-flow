import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/**
 * KpiCard — metric tile with delta/trend badge.
 * Moved from the former `components/premium.tsx`. Markup unchanged.
 */
export function KpiCard({
  label,
  value,
  delta,
  trend = "up",
  icon,
  className,
}: {
  label: string;
  value: string;
  delta?: string;
  trend?: "up" | "down" | "flat";
  icon?: ReactNode;
  className?: string;
}) {
  const trendColor =
    trend === "up"
      ? "text-success bg-success/10 ring-success/20"
      : trend === "down"
        ? "text-destructive bg-destructive/10 ring-destructive/20"
        : "text-muted-foreground bg-muted ring-border";
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/30",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        {icon && (
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary ring-1 ring-inset ring-primary/20">
            {icon}
          </div>
        )}
      </div>
      <p className="mt-4 text-3xl font-semibold tracking-tight text-foreground tabular-nums">
        {value}
      </p>
      {delta && (
        <div className="mt-3 flex items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset",
              trendColor,
            )}
          >
            {delta}
          </span>
          <span className="text-[11px] text-muted-foreground">vs. semana anterior</span>
        </div>
      )}
      <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary/5 opacity-0 blur-2xl transition-opacity group-hover:opacity-100" />
    </div>
  );
}
