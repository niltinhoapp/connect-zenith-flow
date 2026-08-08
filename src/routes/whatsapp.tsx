import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Search,
  Send,
  Paperclip,
  MoreVertical,
  Check,
  CheckCheck,
  Clock,
  AlertCircle,
  UserPlus,
  MessageSquare,
  Loader2,
  FileText,
  Zap,
  StickyNote,
  KeyRound,
  CircleDot,
} from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useSetCopilotFocus, useRegisterDraftSink } from "@/components/copilot/copilot-focus";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useSession } from "@/core/auth";
import {
  useConversations,
  useMessages,
  useInboxCounters,
  useSendMessage,
  useSendTemplate,
  useAssignConversation,
  useMarkConversationRead,
  useConversationInsight,
  useConversationInsights,
  useAnalyzeConversation,
} from "@/features/whatsapp/hooks/use-inbox";
import {
  useSetConversationStatus,
  useSetConversationTags,
  useConversationNotes,
  useAddNote,
  useQuickReplies,
  useSendMedia,
  useMediaBatch,
} from "@/features/whatsapp/hooks/use-service-desk";
import { useTemplates } from "@/features/whatsapp/hooks/use-templates";
import type { ConversationProps, MediaView } from "@/features/whatsapp";
import {
  MessageMediaBubble,
  type MessageMedia,
} from "@/features/whatsapp/components/media/message-media";
import {
  AttachmentPreview,
  type AttachmentStatus,
  type DraftAttachment,
} from "@/features/whatsapp/components/media/attachment-preview";
import {
  ACCEPTED_MEDIA,
  detectKind,
  validateMediaFile,
} from "@/features/whatsapp/components/media/media-utils";
import {
  ConversationInsights,
  ConversationInsightBadges,
  ConversationInsightFilters,
  EMPTY_INSIGHT_FILTER,
  insightMatchesFilter,
  isPriorityConversation,
  priorityScore,
  type ConversationInsight,
  type ConversationInsightsState,
  type InsightFilter,
} from "@/features/whatsapp/components/insights";
import { can, PERMISSIONS } from "@/core/permissions";

const STATUS_LABEL: Record<string, string> = {
  open: "Aberta",
  pending: "Pendente",
  closed: "Resolvida",
};

export const Route = createFileRoute("/whatsapp")({
  validateSearch: (s: Record<string, unknown>): { conversation?: string } => ({
    conversation: typeof s.conversation === "string" ? s.conversation : undefined,
  }),
  head: () => ({
    meta: [
      { title: "WhatsApp — ConnectWeb" },
      { name: "description", content: "Central omnichannel de WhatsApp com automações e IA." },
    ],
  }),
  component: WhatsAppPage,
});

// ── Helpers ──────────────────────────────────────────────────────────────────
function initials(name: string | null, fallback: string): string {
  const src = name?.trim() || fallback;
  return src
    .split(/\s+/)
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
function hhmm(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}
function isWithinWindow(windowExpiresAt: string | null): boolean {
  return Boolean(windowExpiresAt && new Date(windowExpiresAt).getTime() > Date.now());
}

// ── Página ───────────────────────────────────────────────────────────────────
type StatusFilter = "open" | "pending" | "closed" | null;

const EMPTY_INSIGHTS: Record<string, ConversationInsight> = {};

function WhatsAppPage() {
  const { conversation: convParam } = Route.useSearch();
  const session = useSession();
  const setCopilotFocus = useSetCopilotFocus();
  const [selectedId, setSelectedId] = useState<string | null>(convParam ?? null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(null);
  const [insightFilter, setInsightFilter] = useState<InsightFilter>(EMPTY_INSIGHT_FILTER);

  // Deep-link: abrir uma conversa via ?conversation=<id> (ex.: vindo do painel IA).
  useEffect(() => { if (convParam) setSelectedId(convParam); }, [convParam]);

  const conversationsQuery = useConversations({
    ...(search ? { search } : {}),
    ...(statusFilter ? { status: statusFilter } : {}),
  });
  const countersQuery = useInboxCounters();
  const conversations = useMemo(
    () => (conversationsQuery.data?.items ?? []).map((c) => c.toJSON()),
    [conversationsQuery.data],
  );
  const selected = conversations.find((c) => c.id === selectedId) ?? null;

  // Insights por conversa (badges + filtros + fila priorizada). Só consulta com
  // o módulo de IA ativo — caso contrário a lista fica inalterada.
  const iaEnabled = (session?.enabledModules ?? []).includes("ia");
  const conversationIds = useMemo(() => conversations.map((c) => c.id), [conversations]);
  const insightsQuery = useConversationInsights(iaEnabled ? conversationIds : []);
  const insightsMap = insightsQuery.data ?? EMPTY_INSIGHTS;

  const visibleConversations = useMemo(() => {
    const list = conversations.filter((c) => {
      const insight = insightsMap[c.id];
      if (!insightMatchesFilter(insight, insightFilter)) return false;
      if (insightFilter.priorityOnly && !isPriorityConversation(insight, c.unreadCount > 0)) {
        return false;
      }
      return true;
    });
    if (!insightFilter.priorityOnly) return list;
    return [...list].sort(
      (a, b) =>
        priorityScore(insightsMap[b.id], b.unreadCount > 0) -
        priorityScore(insightsMap[a.id], a.unreadCount > 0),
    );
  }, [conversations, insightsMap, insightFilter]);

  // Publica o foco (conversa selecionada) para o Copiloto global. Só o ID vai
  // adiante — o resto é resolvido server-side.
  useEffect(() => {
    if (selected) {
      setCopilotFocus({ type: "conversation", id: selected.id, label: selected.contactName ?? selected.contactWaId });
    } else {
      setCopilotFocus(null);
    }
    return () => setCopilotFocus(null);
  }, [selected?.id, selected?.contactName, selected?.contactWaId, setCopilotFocus]);

  return (
    <AppLayout>
      <div className="grid h-[calc(100vh-8rem)] grid-cols-1 overflow-hidden rounded-2xl border border-border bg-card lg:grid-cols-[320px_1fr_300px]">
        <ConversationList
          conversations={visibleConversations}
          selectedId={selectedId}
          onSelect={setSelectedId}
          loading={conversationsQuery.isLoading}
          openCount={countersQuery.data?.open ?? 0}
          search={search}
          onSearch={setSearch}
          statusFilter={statusFilter}
          onStatusFilter={setStatusFilter}
          iaEnabled={iaEnabled}
          insightsMap={insightsMap}
          insightFilter={insightFilter}
          onInsightFilter={setInsightFilter}
        />
        {selected ? (
          <ConversationView key={selected.id} conversation={selected} />
        ) : (
          <EmptyThread />
        )}
        <ContactPanel conversation={selected} />
      </div>
    </AppLayout>
  );
}

// ── Lista de conversas ───────────────────────────────────────────────────────
function ConversationList(props: {
  conversations: ConversationProps[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  loading: boolean;
  openCount: number;
  search: string;
  onSearch: (v: string) => void;
  statusFilter: StatusFilter;
  onStatusFilter: (v: StatusFilter) => void;
  iaEnabled: boolean;
  insightsMap: Record<string, ConversationInsight>;
  insightFilter: InsightFilter;
  onInsightFilter: (filter: InsightFilter) => void;
}) {
  const { conversations, selectedId, onSelect, loading, openCount, search, onSearch } = props;
  const { statusFilter, onStatusFilter } = props;
  const { iaEnabled, insightsMap, insightFilter, onInsightFilter } = props;
  const insightFilterActive =
    insightFilter.priorityOnly ||
    Boolean(insightFilter.intent || insightFilter.temperature || insightFilter.urgency);
  const filters: { value: StatusFilter; label: string }[] = [
    { value: null, label: "Todas" },
    { value: "open", label: "Abertas" },
    { value: "pending", label: "Pendentes" },
    { value: "closed", label: "Resolvidas" },
  ];
  return (
    <aside className="flex min-h-0 flex-col border-r border-border">
      <div className="border-b border-border p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Conversas</h2>
          <div className="flex items-center gap-2">
            <Link
              to="/whatsapp/templates"
              className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
              title="Templates"
            >
              <FileText className="h-3.5 w-3.5" /> Templates
            </Link>
            <Badge className="rounded-md border-0 bg-primary/15 text-[10px] font-semibold text-primary">
              {openCount} abertas
            </Badge>
          </div>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Buscar conversa..."
            className="h-9 rounded-lg border-border bg-background pl-8 text-sm"
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {filters.map((f) => (
            <button
              key={f.label}
              onClick={() => onStatusFilter(f.value)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-[11px] transition-colors",
                statusFilter === f.value
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        {iaEnabled && (
          <ConversationInsightFilters value={insightFilter} onChange={onInsightFilter} />
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        )}
        {!loading && conversations.length === 0 && (
          <p className="px-4 py-10 text-center text-xs text-muted-foreground">
            {insightFilterActive
              ? "Nenhuma conversa com esses filtros. Ajuste ou limpe os filtros da IA."
              : "Nenhuma conversa ainda. Elas aparecem aqui quando um contato envia uma mensagem."}
          </p>
        )}
        {conversations.map((c) => (
          <button
            key={c.id}
            onClick={() => onSelect(c.id)}
            className={cn(
              "flex w-full items-center gap-3 border-b border-border/60 px-4 py-3 text-left transition-colors hover:bg-accent/40",
              c.id === selectedId && "bg-primary/5",
            )}
          >
            <Avatar className="h-10 w-10 shrink-0 border border-border">
              <AvatarFallback className="bg-muted text-xs font-semibold">
                {initials(c.contactName, c.contactWaId)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="min-w-0 flex-1 truncate text-sm font-medium">{c.contactName || c.contactWaId}</p>
                <ConversationInsightBadges insight={insightsMap[c.id] ?? null} />
                <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">
                  {hhmm(c.lastMessageAt)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-xs text-muted-foreground">
                  {c.lastMessagePreview || "—"}
                </p>
                {c.unreadCount > 0 && (
                  <span className="grid h-4 min-w-4 shrink-0 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                    {c.unreadCount}
                  </span>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
    </aside>
  );
}

// ── Thread + composer ────────────────────────────────────────────────────────
function ConversationView({ conversation }: { conversation: ConversationProps }) {
  const session = useSession();
  const meId = session?.user?.id ?? null;
  const messagesQuery = useMessages(conversation.id);
  const send = useSendMessage(conversation.id);
  const sendTemplate = useSendTemplate(conversation.id);
  const assign = useAssignConversation();
  const markRead = useMarkConversationRead();
  const setStatus = useSetConversationStatus();
  const quickReplies = useQuickReplies();
  const templatesQuery = useTemplates({ status: "approved" });
  const sendMedia = useSendMedia(conversation.id);
  const [draft, setDraft] = useState("");
  const registerDraftSink = useRegisterDraftSink();

  // O painel "Ajuda + IA" insere um rascunho da IA neste compositor (nunca envia).
  useEffect(() => {
    registerDraftSink((text) => setDraft(text));
    return () => registerDraftSink(null);
  }, [registerDraftSink]);

  // Insight da IA da conversa aberta (dados reais do Codex via hooks).
  const iaEnabled = (session?.enabledModules ?? []).includes("ia");
  const iaAllowed = can(session, PERMISSIONS.IA_USE);
  const insightQuery = useConversationInsight(iaEnabled ? conversation.id : null);
  const analyze = useAnalyzeConversation();
  const insight: ConversationInsight | null = insightQuery.data ?? null;
  const analyzeError =
    analyze.isError && analyze.error instanceof Error ? analyze.error.message : undefined;
  const insightState: ConversationInsightsState = !iaEnabled
    ? "unavailable"
    : analyze.isPending || insightQuery.isLoading
      ? "loading"
      : analyze.isError || insightQuery.isError
        ? "error"
        : insight
          ? "ready"
          : iaAllowed
            ? "empty"
            : "forbidden";
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const pendingFileRef = useRef<File | null>(null);

  // Anexo: preview local + envio REAL (upload Storage → RPC → worker → Meta).
  const [attachment, setAttachment] = useState<DraftAttachment | null>(null);
  const [attachmentStatus, setAttachmentStatus] = useState<AttachmentStatus>("idle");
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [localSent, setLocalSent] = useState<LocalMediaRow[]>([]);

  const pickFile = (file: File | null | undefined) => {
    if (!file) return;
    const check = validateMediaFile(file);
    if (!check.ok) {
      setFileError(check.error ?? "Arquivo inválido.");
      setAttachment(null);
      return;
    }
    setFileError(null);
    setAttachmentError(null);
    setAttachmentStatus("idle");
    pendingFileRef.current = file;
    setAttachment({
      id: crypto.randomUUID(),
      kind: detectKind(file.type)!,
      name: file.name,
      size: file.size,
      mime: file.type,
      url: URL.createObjectURL(file),
    });
  };

  const clearAttachment = () => {
    setAttachment(null);
    setAttachmentStatus("idle");
    setAttachmentError(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const sendAttachment = () => {
    const file = pendingFileRef.current;
    if (!attachment || !file || attachmentStatus === "sending") return;
    setAttachmentStatus("sending");
    setAttachmentError(null);
    const captionText = draft.trim();
    const snapshot = attachment;
    sendMedia.mutate(
      { file, caption: captionText || undefined },
      {
        onSuccess: () => {
          setAttachmentStatus("success");
          setLocalSent((rows) => [
            ...rows,
            {
              id: snapshot.id,
              caption: captionText || null,
              at: new Date().toISOString(),
              media: {
                kind: snapshot.kind,
                url: snapshot.url,
                name: snapshot.name,
                size: snapshot.size,
                mime: snapshot.mime,
              },
            },
          ]);
          setDraft("");
          window.setTimeout(clearAttachment, 600);
        },
        onError: (e) => {
          setAttachmentStatus("error");
          setAttachmentError(e instanceof Error ? e.message : "Falha ao enviar o anexo.");
        },
      },
    );
  };

  const messages = useMemo(
    () => (messagesQuery.data?.items ?? []).map((m) => m.toJSON()),
    [messagesQuery.data],
  );
  const withinWindow = isWithinWindow(conversation.windowExpiresAt);
  // Aviso administrativo só quando o ENVIO MAIS RECENTE falhou (evita alarme por
  // falha histórica; não expõe credenciais).
  const lastOutbound = [...messages].reverse().find((m) => m.direction === "outbound");
  const tokenFailed = lastOutbound?.status === "failed";
  const approvedTemplates = templatesQuery.data?.items ?? [];
  const replies = quickReplies.data ?? [];

  // Mídia real: resolve signed URLs das mensagens que têm mídia.
  const mediaIds = useMemo(
    () => messages.map((m) => m.mediaId).filter((id): id is string => Boolean(id)),
    [messages],
  );
  const mediaBatch = useMediaBatch(mediaIds);
  const mediaMap = mediaBatch.data ?? {};

  // Marca como lida ao abrir (se houver não-lidas).
  useEffect(() => {
    if (conversation.unreadCount > 0) markRead.mutate(conversation.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation.id]);

  // Item 9: quando a mídia outbound persistida aparece, remove o preview otimista.
  const outboundMediaCount = messages.filter((m) => m.direction === "outbound" && m.mediaId).length;
  const prevOutboundMediaRef = useRef(0);
  useEffect(() => {
    if (outboundMediaCount > prevOutboundMediaRef.current && localSent.length) setLocalSent([]);
    prevOutboundMediaRef.current = outboundMediaCount;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outboundMediaCount]);

  // Rola para o fim quando chegam mensagens.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length, localSent.length]);

  const submit = () => {
    if (attachment) {
      sendAttachment();
      return;
    }
    const body = draft.trim();
    if (!body || send.isPending || !withinWindow) return;
    send.mutate(body, { onSuccess: () => setDraft("") });
  };

  return (
    <section className="flex min-h-0 flex-col">
      <header className="flex items-center justify-between border-b border-border px-5 py-3">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10 border border-border">
            <AvatarFallback className="bg-primary/15 text-xs font-semibold text-primary">
              {initials(conversation.contactName, conversation.contactWaId)}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-semibold">
              {conversation.contactName || conversation.contactWaId}
            </p>
            <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  withinWindow ? "bg-success" : "bg-muted-foreground/50",
                )}
              />
              {withinWindow ? "Janela de 24h aberta" : "Fora da janela (só template)"}
            </p>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <MoreVertical className="h-4 w-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => assign.mutate({ conversationId: conversation.id, assigneeId: meId })}
            >
              <UserPlus className="mr-2 h-4 w-4" /> Atribuir a mim
            </DropdownMenuItem>
            {conversation.assignedTo && (
              <DropdownMenuItem
                onClick={() => assign.mutate({ conversationId: conversation.id, assigneeId: null })}
              >
                Remover atribuição
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-[10px] uppercase text-muted-foreground">
              Status
            </DropdownMenuLabel>
            {(["open", "pending", "closed"] as const).map((s) => (
              <DropdownMenuItem
                key={s}
                onClick={() => setStatus.mutate({ conversationId: conversation.id, status: s })}
              >
                <CircleDot
                  className={cn(
                    "mr-2 h-4 w-4",
                    conversation.status === s ? "text-primary" : "text-muted-foreground/40",
                  )}
                />
                {STATUS_LABEL[s]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {iaEnabled && (
        <div className="border-b border-border bg-background/40 px-4 py-2">
          <ConversationInsights
            insight={insight}
            state={insightState}
            errorMessage={analyzeError}
            onRefresh={iaAllowed ? () => analyze.mutate(conversation.id) : undefined}
            onUseSuggestion={(text) => setDraft(text)}
          />
        </div>
      )}

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-6 subtle-grid">
        {messagesQuery.isLoading && (
          <div className="flex justify-center py-6 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        )}
        {messages.map((m) => (
          <MessageBubble
            key={m.id}
            mine={m.direction === "outbound"}
            body={m.body}
            fallbackLabel={`[${m.type}]`}
            media={resolveMedia(m, mediaMap)}
            author={m.sentBy ? (m.sentBy === meId ? "Você" : "Atendente") : "Automação"}
            time={hhmm(m.createdAt)}
            status={m.status}
          />
        ))}
        {localSent.map((row) => (
          <MessageBubble
            key={row.id}
            mine
            body={row.caption}
            media={row.media}
            author="Você"
            time={hhmm(row.at)}
            status="sent"
          />
        ))}
      </div>

      <div className="border-t border-border bg-background/60 p-3">
        {tokenFailed && (
          <div className="mb-2 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-[11px] text-destructive">
            <KeyRound className="h-3.5 w-3.5 shrink-0" />
            <span>
              Falha de autenticação com a Meta — o token do WhatsApp pode ter expirado. Um
              administrador precisa reconectar a conta.
            </span>
          </div>
        )}
        {!withinWindow && (
          <p className="mb-2 px-1 text-[11px] text-warning">
            Fora da janela de 24h — a Meta só permite iniciar com um{" "}
            <strong>template aprovado</strong>.
          </p>
        )}

        {/* Respostas rápidas + templates */}
        <div className="mb-2 flex flex-wrap items-center gap-1.5 px-1">
          {withinWindow && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground">
                  <Zap className="h-3 w-3" /> Respostas rápidas
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="max-h-64 overflow-y-auto">
                {replies.length === 0 ? (
                  <DropdownMenuItem disabled>Nenhuma resposta rápida</DropdownMenuItem>
                ) : (
                  replies.map((r) => (
                    <DropdownMenuItem key={r.id} onClick={() => setDraft(r.body)}>
                      <span className="font-mono text-[10px] text-primary">{r.shortcut}</span>
                      <span className="ml-2 truncate">{r.title}</span>
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground">
                <FileText className="h-3 w-3" /> Template
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-64 overflow-y-auto">
              <DropdownMenuLabel className="text-[10px] uppercase text-muted-foreground">
                Templates aprovados
              </DropdownMenuLabel>
              {approvedTemplates.length === 0 ? (
                <DropdownMenuItem disabled>Nenhum template aprovado</DropdownMenuItem>
              ) : (
                approvedTemplates.map((t) => {
                  const tpl = t.toJSON();
                  return (
                    <DropdownMenuItem key={tpl.id} onClick={() => sendTemplate.mutate(tpl.id)}>
                      <span className="font-mono text-[11px]">{tpl.name}</span>
                      <span className="ml-2 text-[10px] text-muted-foreground">{tpl.language}</span>
                    </DropdownMenuItem>
                  );
                })
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {attachment && (
          <AttachmentPreview
            attachment={attachment}
            status={attachmentStatus}
            errorMessage={attachmentError}
            onRemove={clearAttachment}
          />
        )}
        {fileError && (
          <p className="mb-2 flex items-center gap-1.5 px-1 text-[11px] text-destructive">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {fileError}
          </p>
        )}

        <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2">
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPTED_MEDIA}
            className="hidden"
            onChange={(e) => pickFile(e.target.files?.[0])}
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => fileRef.current?.click()}
            disabled={!withinWindow || attachmentStatus === "sending"}
            title="Anexar imagem, PDF ou áudio"
          >
            <Paperclip className="h-4 w-4 text-muted-foreground" />
          </Button>
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder={
              attachment
                ? "Adicione uma legenda (opcional)..."
                : withinWindow
                  ? "Digite uma mensagem..."
                  : "Fora da janela — use um template"
            }
            disabled={!withinWindow}
            className="h-8 min-w-0 flex-1 border-0 bg-transparent p-0 text-sm focus-visible:ring-0 disabled:opacity-60"
          />
          <Button
            size="icon"
            onClick={submit}
            disabled={
              !withinWindow ||
              (!draft.trim() && !attachment) ||
              send.isPending ||
              attachmentStatus === "sending"
            }
            className="h-8 w-8 shrink-0 rounded-lg bg-primary hover:bg-primary/90"
          >
            {send.isPending || attachmentStatus === "sending" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        {(send.isError || sendTemplate.isError) && (
          <p className="mt-1 px-1 text-[11px] text-destructive">
            Falha ao enviar. Verifique a conexão/limite e tente novamente.
          </p>
        )}
      </div>
    </section>
  );
}

// ── Bolha (texto + mídia) ────────────────────────────────────────────────────
interface LocalMediaRow {
  id: string;
  caption: string | null;
  at: string;
  media: MessageMedia;
}

/**
 * Resolve a mídia REAL de uma mensagem: usa a signed URL vinda do `useMediaBatch`
 * (mediaMap). Enquanto o download/URL não está pronto, mostra estado de loading;
 * se não houver `mediaId`, não é mídia. Nunca usa URL permanente/token.
 */
function resolveMedia(
  m: { type: string; mediaId: string | null },
  mediaMap: Record<string, MediaView>,
): MessageMedia | null {
  if (!m.mediaId) return null;
  const found = mediaMap[m.mediaId];
  if (found) return found;
  const kind = m.type === "image" ? "image" : m.type === "audio" ? "audio" : "document";
  return { kind, url: "", name: `arquivo.${kind}`, state: "loading" };
}

function MessageBubble(props: {
  mine: boolean;
  body: string | null;
  fallbackLabel?: string;
  media?: MessageMedia | null;
  author: string;
  time: string;
  status: string;
}) {
  const { mine, body, fallbackLabel, media, author, time, status } = props;
  return (
    <div className={cn("flex", mine ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm sm:max-w-[75%] lg:max-w-[70%]",
          mine
            ? "rounded-br-md bg-primary text-primary-foreground"
            : "rounded-bl-md border border-border bg-card text-foreground",
        )}
      >
        {media && (
          <div className={cn(body ? "mb-2" : undefined)}>
            <MessageMediaBubble media={media} mine={mine} />
          </div>
        )}
        {(body || (!media && fallbackLabel)) && (
          <p className="whitespace-pre-wrap break-words">{body || fallbackLabel}</p>
        )}
        <div
          className={cn(
            "mt-1 flex items-center justify-end gap-1 text-[10px]",
            mine ? "text-primary-foreground/70" : "text-muted-foreground",
          )}
        >
          {mine && <span className="mr-1">{author}</span>}
          {time}
          {mine && <StatusTick status={status} />}
        </div>
      </div>
    </div>
  );
}

function StatusTick({ status }: { status: string }) {
  if (status === "pending") return <Clock className="h-3 w-3" />;
  if (status === "failed") return <AlertCircle className="h-3 w-3 text-destructive" />;
  if (status === "read") return <CheckCheck className="h-3 w-3" />;
  if (status === "delivered") return <CheckCheck className="h-3 w-3 opacity-70" />;
  return <Check className="h-3 w-3" />; // sent
}

function EmptyThread() {
  return (
    <section className="flex min-h-0 flex-col items-center justify-center gap-3 text-center subtle-grid">
      <div className="grid h-14 w-14 place-items-center rounded-2xl border border-border bg-card">
        <MessageSquare className="h-6 w-6 text-muted-foreground" />
      </div>
      <div>
        <p className="text-sm font-medium">Selecione uma conversa</p>
        <p className="text-xs text-muted-foreground">
          Escolha um contato à esquerda para ver as mensagens.
        </p>
      </div>
    </section>
  );
}

// ── Painel do contato ────────────────────────────────────────────────────────
function ContactPanel({ conversation }: { conversation: ConversationProps | null }) {
  const setTags = useSetConversationTags();
  const notesQuery = useConversationNotes(conversation?.id ?? null);
  const addNote = useAddNote(conversation?.id ?? null);
  const [tagInput, setTagInput] = useState("");
  const [noteInput, setNoteInput] = useState("");

  if (!conversation) return <aside className="hidden border-l border-border lg:block" />;
  const withinWindow = isWithinWindow(conversation.windowExpiresAt);
  const notes = notesQuery.data ?? [];

  const addTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (!t || conversation.tags.includes(t)) return;
    setTags.mutate({ conversationId: conversation.id, tags: [...conversation.tags, t] });
    setTagInput("");
  };
  const removeTag = (t: string) =>
    setTags.mutate({
      conversationId: conversation.id,
      tags: conversation.tags.filter((x) => x !== t),
    });
  const submitNote = () => {
    const b = noteInput.trim();
    if (!b) return;
    addNote.mutate(b, { onSuccess: () => setNoteInput("") });
  };

  return (
    <aside className="hidden min-h-0 flex-col border-l border-border lg:flex">
      <div className="flex flex-col items-center border-b border-border p-6 text-center">
        <Avatar className="h-16 w-16 border border-border">
          <AvatarFallback className="bg-primary/15 text-lg font-semibold text-primary">
            {initials(conversation.contactName, conversation.contactWaId)}
          </AvatarFallback>
        </Avatar>
        <p className="mt-3 text-sm font-semibold">
          {conversation.contactName || conversation.contactWaId}
        </p>
        <p className="text-xs text-muted-foreground">{conversation.contactWaId}</p>
        <div className="mt-3 flex flex-wrap justify-center gap-1.5">
          <Badge
            className={cn(
              "rounded-md border-0 text-[10px] ring-1 ring-inset",
              conversation.status === "open"
                ? "bg-success/10 text-success ring-success/25"
                : conversation.status === "pending"
                  ? "bg-warning/10 text-warning ring-warning/25"
                  : "bg-muted text-muted-foreground ring-border",
            )}
          >
            {STATUS_LABEL[conversation.status] ?? conversation.status}
          </Badge>
          <Badge
            className={cn(
              "rounded-md border-0 text-[10px] ring-1 ring-inset",
              withinWindow
                ? "bg-primary/10 text-primary ring-primary/25"
                : "bg-warning/10 text-warning ring-warning/25",
            )}
          >
            {withinWindow ? "Janela 24h" : "Fora da janela"}
          </Badge>
        </div>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto p-5">
        <dl className="space-y-2 text-xs">
          <Row label="Não lidas" value={String(conversation.unreadCount)} />
          <Row label="Atribuída" value={conversation.assignedTo ? "Sim" : "—"} />
          <Row label="Cliente (CRM)" value={conversation.customerId ? "Vinculado" : "—"} />
          <Row label="Última mensagem" value={hhmm(conversation.lastMessageAt) || "—"} />
        </dl>

        {/* Tags */}
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Tags
          </p>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {conversation.tags.length === 0 && (
              <span className="text-xs text-muted-foreground">Sem tags</span>
            )}
            {conversation.tags.map((t) => (
              <Badge
                key={t}
                className="cursor-pointer rounded-md border-0 bg-primary/10 text-[10px] text-primary"
                onClick={() => removeTag(t)}
                title="Remover"
              >
                {t} ✕
              </Badge>
            ))}
          </div>
          <Input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTag();
              }
            }}
            placeholder="Adicionar tag + Enter"
            className="h-8 text-xs"
          />
        </div>

        {/* Notas internas */}
        <div>
          <p className="mb-2 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            <StickyNote className="h-3 w-3" /> Notas internas
          </p>
          <div className="mb-2 space-y-1.5">
            {notes.length === 0 && (
              <span className="text-xs text-muted-foreground">Nenhuma nota</span>
            )}
            {notes.map((n) => (
              <div key={n.id} className="rounded-lg border border-border bg-card p-2 text-xs">
                <p className="whitespace-pre-wrap break-words">{n.body}</p>
                <p className="mt-1 text-[10px] text-muted-foreground">{hhmm(n.created_at)}</p>
              </div>
            ))}
          </div>
          <Textarea
            value={noteInput}
            onChange={(e) => setNoteInput(e.target.value)}
            placeholder="Nota visível só para a equipe..."
            className="min-h-16 text-xs"
          />
          <Button
            size="sm"
            variant="outline"
            className="mt-1.5 h-7 w-full text-xs"
            disabled={!noteInput.trim() || addNote.isPending}
            onClick={submitNote}
          >
            Adicionar nota
          </Button>
        </div>
      </div>
    </aside>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  );
}
