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
} from "@/features/whatsapp/hooks/use-inbox";
import {
  useSetConversationStatus,
  useSetConversationTags,
  useConversationNotes,
  useAddNote,
  useQuickReplies,
} from "@/features/whatsapp/hooks/use-service-desk";
import { useTemplates } from "@/features/whatsapp/hooks/use-templates";
import type { ConversationProps } from "@/features/whatsapp";
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


const STATUS_LABEL: Record<string, string> = {
  open: "Aberta",
  pending: "Pendente",
  closed: "Resolvida",
};

export const Route = createFileRoute("/whatsapp")({
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
function WhatsAppPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const conversationsQuery = useConversations(search ? { search } : undefined);
  const countersQuery = useInboxCounters();
  const conversations = useMemo(
    () => (conversationsQuery.data?.items ?? []).map((c) => c.toJSON()),
    [conversationsQuery.data],
  );
  const selected = conversations.find((c) => c.id === selectedId) ?? null;

  return (
    <AppLayout>
      <div className="grid h-[calc(100vh-8rem)] grid-cols-1 overflow-hidden rounded-2xl border border-border bg-card lg:grid-cols-[320px_1fr_300px]">
        <ConversationList
          conversations={conversations}
          selectedId={selectedId}
          onSelect={setSelectedId}
          loading={conversationsQuery.isLoading}
          openCount={countersQuery.data?.open ?? 0}
          search={search}
          onSearch={setSearch}
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
}) {
  const { conversations, selectedId, onSelect, loading, openCount, search, onSearch } = props;
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
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        )}
        {!loading && conversations.length === 0 && (
          <p className="px-4 py-10 text-center text-xs text-muted-foreground">
            Nenhuma conversa ainda. Elas aparecem aqui quando um contato envia uma mensagem.
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
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm font-medium">{c.contactName || c.contactWaId}</p>
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
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Anexo (protótipo visual — nenhum upload/storage é realizado).
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
    if (!attachment || attachmentStatus === "sending") return;
    setAttachmentStatus("sending");
    setAttachmentError(null);
    window.setTimeout(() => {
      setAttachmentStatus("success");
      setLocalSent((rows) => [
        ...rows,
        {
          id: attachment.id,
          caption: draft.trim() || null,
          at: new Date().toISOString(),
          media: {
            kind: attachment.kind,
            url: attachment.url,
            name: attachment.name,
            size: attachment.size,
            mime: attachment.mime,
          },
        },
      ]);
      setDraft("");
      window.setTimeout(clearAttachment, 600);
    }, 900);
  };


  const messages = useMemo(
    () => (messagesQuery.data?.items ?? []).map((m) => m.toJSON()),
    [messagesQuery.data],
  );
  const withinWindow = isWithinWindow(conversation.windowExpiresAt);
  // Detecta token expirado (falha de envio) → aviso administrativo (sem expor credenciais).
  const tokenFailed = messages.some((m) => m.direction === "outbound" && m.status === "failed");
  const approvedTemplates = templatesQuery.data?.items ?? [];
  const replies = quickReplies.data ?? [];

  // Marca como lida ao abrir (se houver não-lidas).
  useEffect(() => {
    if (conversation.unreadCount > 0) markRead.mutate(conversation.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation.id]);

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
            media={mediaFromMessage(m)}
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

        <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" disabled title="Mídia (em breve)">
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
              withinWindow ? "Digite uma mensagem..." : "Fora da janela — use um template"
            }
            disabled={!withinWindow}
            className="h-8 border-0 bg-transparent p-0 text-sm focus-visible:ring-0 disabled:opacity-60"
          />
          <Button
            size="icon"
            onClick={submit}
            disabled={!withinWindow || !draft.trim() || send.isPending}
            className="h-8 w-8 rounded-lg bg-primary hover:bg-primary/90"
          >
            {send.isPending ? (
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
