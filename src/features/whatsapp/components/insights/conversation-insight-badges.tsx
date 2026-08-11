/**
 * Indicadores discretos por conversa na lista da caixa de entrada.
 * Mostra, sem poluir: cliente quente (chama), categoria (venda/suporte/…) e
 * urgência alta. Retorna nada quando não há análise — estado seguro enquanto o
 * backend não fornece o insight.
 */
import { Flame, CircleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ConversationInsight, ConversationIntent } from "./types";
import { INTENT_LABEL } from "./insight-labels";

/** Categorias com badge própria (a intenção "other" não recebe etiqueta). */
const INTENT_BADGE: Partial<Record<ConversationIntent, string>> = {
  sale: "bg-success/15 text-success",
  support: "bg-secondary text-secondary-foreground",
  billing: "bg-warning/15 text-warning",
  post_sale: "bg-primary/15 text-primary",
};

export function ConversationInsightBadges({
  insight,
  className,
}: {
  insight: ConversationInsight | null;
  className?: string;
}) {
  if (!insight) return null;

  const showCategory = insight.intent !== "other" && insight.intent in INTENT_BADGE;
  const isHot = insight.temperature === "hot";
  const isUrgent = insight.urgency === "high";
  if (!showCategory && !isHot && !isUrgent) return null;

  return (
    <span className={cn("flex shrink-0 items-center gap-1", className)}>
      {isHot && (
        <span className="inline-flex" title="Cliente quente" aria-label="Cliente quente" role="img">
          <Flame className="h-3.5 w-3.5 text-warning" aria-hidden="true" />
        </span>
      )}
      {showCategory && (
        <span
          className={cn(
            "rounded px-1.5 py-0.5 text-[10px] font-medium leading-none",
            INTENT_BADGE[insight.intent],
          )}
        >
          {INTENT_LABEL[insight.intent]}
        </span>
      )}
      {isUrgent && (
        <span className="inline-flex" title="Urgência alta" aria-label="Urgência alta" role="img">
          <CircleAlert className="h-3.5 w-3.5 text-destructive" aria-hidden="true" />
        </span>
      )}
    </span>
  );
}
