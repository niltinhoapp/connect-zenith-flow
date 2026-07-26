import { cn } from "@/lib/utils";

/**
 * BrandMark — the ConnectWeb logo glyph (glowing primary tile).
 *
 * Extracted from the sidebar header and the auth shell, which previously
 * duplicated this exact markup. The label lockup stays with each consumer so
 * their existing typography is preserved untouched.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "grid h-9 w-9 place-items-center rounded-lg bg-primary/15 ring-1 ring-primary/30",
        className,
      )}
    >
      <div className="h-3.5 w-3.5 rounded-sm bg-primary shadow-[0_0_12px_theme(colors.primary)]" />
    </div>
  );
}
