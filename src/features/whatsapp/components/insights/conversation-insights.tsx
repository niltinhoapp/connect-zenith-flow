/**
 * Card "Insight da IA" da conversa aberta (frente Claude — experiência).
 *
 * Recolhível e acessível. Consome `ConversationInsightsProps` e trata todos os
 * estados com segurança. Nunca envia nada: "Usar sugestão" apenas preenche o
 * campo de resposta para o atendente revisar. Sem porcentagens inventadas nem
 * dados de demonstração — quando não há análise, mostra um estado honesto.
 */
import { useState, type ReactNode } from "react";
import {
  Sparkles,
  ChevronDown,
  RefreshCw,
  PenLine,
  Clock,
  Flame,
  CircleAlert,
  AlertTriangle,
  Loader2,
  Lightbulb,
  Lock,
  Info,
  MessageSquareText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ConversationInsightsProps } from "./types";
import {
  INTENT_LABEL,
  TEMPERATURE_LABEL,
  TEMPERATURE_HINT,
  URGENCY_LABEL,
  SENTIMENT_LABEL,
  headlineFor,
  formatAnalysisTime,
} from "./insight-labels";

/** Etiqueta textual (nunca só cor) usada dentro do card. */
function Tag({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium",
        className,
      )}
    >
      {children}
    </span>
  );
}

const STATE_MESSAGE: Record<string, { icon: typeof Info; title: string; hint: string }> = {
  empty: {
    icon: Info,
    title: "Ainda não há uma análise para esta conversa",
    hint: "Gere uma análise para receber um resumo e uma recomendação de resposta.",
  },
  error: {
    icon: AlertTriangle,
    title: "Não foi possível gerar a análise agora",
    hint: "Tente novamente em instantes.",
  },
  forbidden: {
    icon: Lock,
    title: "Você não tem acesso à análise da IA",
    hint: "Peça a um administrador para liberar o recurso no seu perfil.",
  },
  unavailable: {
    icon: Info,
    title: "A análise por IA ainda não está ativa",
    hint: "Este recurso não está habilitado para a sua empresa.",
  },
};

export function ConversationInsights({
  insight,
  state,
  onRefresh,
  onUseSuggestion,
  errorMessage,
  defaultOpen,
  className,
}: ConversationInsightsProps) {
  const isReady = state === "ready" && insight !== null;
  const [open, setOpen] = useState(defaultOpen ?? state === "ready");

  const analysisTime = isReady ? formatAnalysisTime(insight.generatedAt) : null;

  return (
    <details
      open={open}
      onToggle={(event) => setOpen((event.currentTarget as HTMLDetailsElement).open)}
      className={cn(
        "group rounded-xl border border-border bg-card [&_summary::-webkit-details-marker]:hidden",
        className,
      )}
    >
      <summary
        className="flex cursor-pointer list-none items-center gap-2 rounded-xl px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        aria-label={open ? "Recolher insight da IA" : "Expandir insight da IA"}
      >
        <Sparkles className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
        <span className="text-sm font-semibold">Insight da IA</span>
        {isReady && (
          <span className="truncate text-xs text-muted-foreground">· {headlineFor(insight)}</span>
        )}
        {isReady && insight.stale && (
          <Tag className="ml-auto bg-warning/15 text-warning">
            <AlertTriangle className="h-3 w-3" aria-hidden="true" /> Desatualizado
          </Tag>
        )}
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180",
            isReady && insight.stale ? "" : "ml-auto",
          )}
          aria-hidden="true"
        />
      </summary>

      <div className="border-t border-border px-3 py-3">
        {state === "loading" && (
          <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Analisando esta conversa…
          </div>
        )}

        {(state === "empty" ||
          state === "error" ||
          state === "forbidden" ||
          state === "unavailable") &&
          (() => {
            const meta = STATE_MESSAGE[state];
            const Icon = meta.icon;
            const hint = state === "error" && errorMessage ? errorMessage : meta.hint;
            const canRetry = (state === "empty" || state === "error") && Boolean(onRefresh);
            return (
              <div className="space-y-2 py-1">
                <div className="flex items-start gap-2">
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-medium">{meta.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
                  </div>
                </div>
                {canRetry && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 text-xs"
                    onClick={() => onRefresh?.()}
                  >
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                    {state === "error" ? "Tentar de novo" : "Analisar conversa"}
                  </Button>
                )}
              </div>
            );
          })()}

        {isReady && (
          <div className="space-y-3">
            {/* Etiquetas — sempre com texto, não apenas cor */}
            <div className="flex flex-wrap gap-1.5">
              <Tag className="bg-warning/15 text-warning">
                <Flame className="h-3 w-3" aria-hidden="true" />
                {TEMPERATURE_LABEL[insight.temperature]} · {TEMPERATURE_HINT[insight.temperature]}
              </Tag>
              <Tag className="bg-secondary text-secondary-foreground">
                {INTENT_LABEL[insight.intent]}
              </Tag>
              {insight.urgency === "high" && (
                <Tag className="bg-destructive/15 text-destructive">
                  <CircleAlert className="h-3 w-3" aria-hidden="true" />
                  {URGENCY_LABEL[insight.urgency]}
                </Tag>
              )}
              <Tag className="bg-muted text-muted-foreground">
                {SENTIMENT_LABEL[insight.sentiment]}
              </Tag>
            </div>

            {insight.stale && (
              <p className="flex items-start gap-1.5 rounded-lg bg-warning/10 px-2.5 py-1.5 text-xs text-warning">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                Esta análise pode estar desatualizada — a conversa mudou desde então.
              </p>
            )}

            {/* Resumo curto */}
            <p className="text-sm text-foreground">{insight.summary}</p>

            {/* Próxima melhor ação — orientação ao atendente */}
            <div className="rounded-lg border border-primary/25 bg-primary/5 p-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                <Lightbulb className="h-3.5 w-3.5" aria-hidden="true" />
                Próxima ação recomendada
              </p>
              <p className="mt-1 text-sm text-foreground">{insight.nextBestAction}</p>
            </div>

            {/* Resposta sugerida — pronta para inserir no campo (nunca envia) */}
            {insight.suggestedReply && insight.suggestedReply.trim().length > 0 && (
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <MessageSquareText className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                  Resposta sugerida
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
                  {insight.suggestedReply}
                </p>
                {onUseSuggestion && (
                  <div className="mt-2">
                    <Button
                      size="sm"
                      className="h-8 gap-1.5 text-xs"
                      onClick={() => onUseSuggestion(insight.suggestedReply!)}
                      aria-label="Usar resposta sugerida: preencher o campo de mensagem"
                    >
                      <PenLine className="h-3.5 w-3.5" aria-hidden="true" />
                      Usar resposta
                    </Button>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Preenche o campo de mensagem. Você revisa antes de enviar — nada é enviado
                      automaticamente.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Por que a IA sugeriu isso */}
            {insight.reasons.length > 0 && (
              <div>
                <p className="text-xs font-medium text-foreground">Por que a IA sugeriu isso</p>
                <ul className="mt-1 space-y-1">
                  {insight.reasons.slice(0, 4).map((reason, index) => (
                    <li key={index} className="flex gap-2 text-xs text-muted-foreground">
                      <span
                        className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60"
                        aria-hidden="true"
                      />
                      <span>{reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Rodapé: horário + atualizar */}
            <div className="flex items-center justify-between gap-2 pt-1">
              {analysisTime ? (
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Clock className="h-3 w-3" aria-hidden="true" />
                  Última análise às {analysisTime}
                </span>
              ) : (
                <span />
              )}
              {onRefresh && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                  onClick={() => onRefresh()}
                  aria-label="Atualizar análise da IA"
                >
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                  Atualizar análise
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </details>
  );
}
