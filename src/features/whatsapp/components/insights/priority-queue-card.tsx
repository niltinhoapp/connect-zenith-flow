/**
 * PriorityQueueCard — cockpit de atendimento no Dashboard (frente Claude).
 *
 * Mostra as conversas prioritárias (quentes ou urgentes ainda SEM resposta),
 * reaproveitando os dados reais de Insights (somente leitura) e os helpers de
 * priorização. Cada item leva direto à conversa na Central. Sem dados falsos:
 * quando não há fila, mostra um estado vazio honesto.
 *
 * Deve ser montado apenas quando os módulos WhatsApp + IA estão ativos (o
 * Dashboard faz esse gate), para não disparar consultas desnecessárias.
 */
import { Link } from "@tanstack/react-router";
import { Flame, ArrowRight, Inbox } from "lucide-react";
import { SectionCard } from "@/components/shared/section-card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useConversations, useConversationInsights } from "@/features/whatsapp/hooks/use-inbox";
import { ConversationInsightBadges } from "./conversation-insight-badges";
import { isPriorityConversation, priorityScore } from "./priority";

function initials(name: string | null, fallback: string): string {
  const src = name?.trim() || fallback;
  return src
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function PriorityQueueCard({ limit = 5 }: { limit?: number }) {
  const conversationsQuery = useConversations({ status: "open" });
  const conversations = (conversationsQuery.data?.items ?? []).map((c) => c.toJSON());
  const ids = conversations.map((c) => c.id);
  const insightsQuery = useConversationInsights(ids);
  const insightsMap = insightsQuery.data ?? {};

  const loading = conversationsQuery.isLoading || insightsQuery.isLoading;

  const priority = conversations
    .filter((c) => isPriorityConversation(insightsMap[c.id], c.unreadCount > 0))
    .sort(
      (a, b) =>
        priorityScore(insightsMap[b.id], b.unreadCount > 0) -
        priorityScore(insightsMap[a.id], a.unreadCount > 0),
    )
    .slice(0, limit);

  return (
    <SectionCard
      title="Atendimento prioritário"
      description="Conversas quentes ou urgentes ainda sem resposta"
      action={
        <Link
          to="/whatsapp"
          className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-primary outline-none transition-colors hover:underline focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          Ver na Central <ArrowRight className="h-3 w-3" />
        </Link>
      }
    >
      {loading ? (
        <ul className="space-y-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <li key={index} className="flex items-center gap-3 py-1.5">
              <Skeleton className="h-9 w-9 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-3 w-44" />
              </div>
            </li>
          ))}
        </ul>
      ) : priority.length === 0 ? (
        <div className="flex items-center gap-3 py-2 text-sm text-muted-foreground">
          <Inbox className="h-5 w-5 shrink-0 text-success" aria-hidden="true" />
          Nenhuma conversa prioritária agora. As quentes e urgentes sem resposta aparecem aqui.
        </div>
      ) : (
        <ul className="space-y-1">
          {priority.map((c) => (
            <li key={c.id}>
              <Link
                to="/whatsapp"
                search={{ conversation: c.id }}
                className="flex items-center gap-3 rounded-lg px-2 py-2 outline-none transition-colors hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <Avatar className="h-9 w-9 shrink-0 border border-border">
                  <AvatarFallback className="bg-muted text-[11px] font-semibold">
                    {initials(c.contactName, c.contactWaId)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      {c.contactName || c.contactWaId}
                    </span>
                    <ConversationInsightBadges insight={insightsMap[c.id] ?? null} />
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {c.lastMessagePreview || "—"}
                  </p>
                </div>
                {c.unreadCount > 0 && (
                  <span
                    className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground"
                    aria-label={`${c.unreadCount} mensagens não lidas`}
                  >
                    {c.unreadCount}
                  </span>
                )}
                <Flame className="h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
