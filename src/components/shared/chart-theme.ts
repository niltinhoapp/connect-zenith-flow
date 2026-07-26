/**
 * Shared Recharts theming.
 *
 * Centralises the chart styling that was previously duplicated inline across
 * the Dashboard and Relatórios pages. Every value references the design-system
 * CSS variables defined in `src/styles.css` — the theme is never redefined
 * here, only referenced, so the Design System remains the single source of
 * truth.
 */

/** Tooltip container style shared by every chart. */
export const chartTooltipStyle = {
  background: "var(--color-popover)",
  border: "1px solid var(--color-border)",
  borderRadius: 12,
  fontSize: 12,
} as const;

/** Default axis styling (tokenised, no visible axis line). */
export const chartAxisProps = {
  stroke: "var(--color-muted-foreground)",
  tickLine: false,
  axisLine: false,
  fontSize: 11,
} as const;

/** Grid stroke token. */
export const chartGridStroke = "var(--color-border)" as const;

/**
 * Semantic series palette, aligned with the `--chart-*` / status tokens.
 * Use by index for categorical charts (pies, multi-series bars).
 */
export const chartColors = [
  "var(--color-primary)",
  "var(--color-success)",
  "var(--color-warning)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
] as const;
