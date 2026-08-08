/**
 * Filtros da caixa de entrada por insight de IA (frente Claude — experiência).
 * Um atalho "Prioritários" (fila quente/urgente/sem resposta) + um popover com
 * filtros por intenção, temperatura e urgência. Acessível e discreto.
 */
import { Flame, SlidersHorizontal } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { InsightFilter } from "./priority";
import { activeDimensionCount, hasAnyFilter, EMPTY_INSIGHT_FILTER } from "./priority";

const INTENTS = [
  { value: "sale", label: "Venda" },
  { value: "support", label: "Suporte" },
  { value: "billing", label: "Cobrança" },
  { value: "post_sale", label: "Pós-venda" },
  { value: "other", label: "Geral" },
] as const;

const TEMPERATURES = [
  { value: "hot", label: "Quente" },
  { value: "warm", label: "Morno" },
  { value: "cold", label: "Frio" },
] as const;

const URGENCIES = [
  { value: "high", label: "Alta" },
  { value: "medium", label: "Média" },
  { value: "low", label: "Baixa" },
] as const;

function ChipGroup({
  title,
  options,
  value,
  onSelect,
}: {
  title: string;
  options: readonly { value: string; label: string }[];
  value: string | null;
  onSelect: (value: string | null) => void;
}) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">{title}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => {
          const active = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              onClick={() => onSelect(active ? null : option.value)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-[11px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/40",
                active
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ConversationInsightFilters({
  value,
  onChange,
}: {
  value: InsightFilter;
  onChange: (filter: InsightFilter) => void;
}) {
  const dimCount = activeDimensionCount(value);

  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        aria-pressed={value.priorityOnly}
        onClick={() => onChange({ ...value, priorityOnly: !value.priorityOnly })}
        className={cn(
          "flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/40",
          value.priorityOnly
            ? "border-warning/40 bg-warning/10 text-warning"
            : "border-border bg-card text-muted-foreground hover:text-foreground",
        )}
      >
        <Flame className="h-3 w-3" aria-hidden="true" />
        Prioritários
      </button>

      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/40",
              dimCount > 0
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border bg-card text-muted-foreground hover:text-foreground",
            )}
            aria-label="Filtros da IA por intenção, temperatura e urgência"
          >
            <SlidersHorizontal className="h-3 w-3" aria-hidden="true" />
            Filtros IA
            {dimCount > 0 && (
              <span className="ml-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[9px] font-semibold text-primary-foreground">
                {dimCount}
              </span>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 space-y-3">
          <ChipGroup
            title="Intenção"
            options={INTENTS}
            value={value.intent}
            onSelect={(v) => onChange({ ...value, intent: v as InsightFilter["intent"] })}
          />
          <ChipGroup
            title="Temperatura"
            options={TEMPERATURES}
            value={value.temperature}
            onSelect={(v) => onChange({ ...value, temperature: v as InsightFilter["temperature"] })}
          />
          <ChipGroup
            title="Urgência"
            options={URGENCIES}
            value={value.urgency}
            onSelect={(v) => onChange({ ...value, urgency: v as InsightFilter["urgency"] })}
          />
          {hasAnyFilter(value) && (
            <button
              type="button"
              onClick={() => onChange(EMPTY_INSIGHT_FILTER)}
              className="w-full rounded-lg border border-border px-2 py-1.5 text-[11px] text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              Limpar filtros
            </button>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
