import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession, type AuthSession } from "@/core/auth";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { queryKeys, mutationDefaults } from "@/lib/query";
import type { Paginated } from "@/core/domain";
import {
  InboxApplicationService,
  MessagingApplicationService,
  ConversationSupabaseRepository,
  MessageSupabaseRepository,
  type InboxCounters,
  type Conversation,
  type Message,
  type ConversationFilter,
} from "@/features/whatsapp";

function ctxOf(session: AuthSession) {
  return {
    organizationId: session.activeOrganization!.organizationId,
    actorId: session.user.id,
    enabledModules: session.enabledModules,
  };
}

function makeInbox(session: AuthSession): InboxApplicationService {
  const db = getSupabaseBrowserClient();
  return new InboxApplicationService(
    db,
    new ConversationSupabaseRepository(db),
    new MessageSupabaseRepository(db),
    ctxOf(session),
  );
}

function makeMessaging(session: AuthSession): MessagingApplicationService {
  const db = getSupabaseBrowserClient();
  return new MessagingApplicationService(db, new MessageSupabaseRepository(db), ctxOf(session));
}

export function useConversations(filter?: ConversationFilter) {
  const session = useSession();
  const org = session?.activeOrganization?.organizationId ?? null;
  return useQuery<Paginated<Conversation>>({
    queryKey: queryKeys.whatsapp.conversations(org ?? "none", filter),
    enabled: Boolean(org),
    retry: 2,
    refetchInterval: 15_000, // inbox quase-tempo-real (polling; Realtime em fase futura)
    queryFn: () => makeInbox(session!).listConversations(filter),
  });
}

export function useConversation(id: string | null) {
  const session = useSession();
  const org = session?.activeOrganization?.organizationId ?? null;
  return useQuery<Conversation>({
    queryKey: queryKeys.whatsapp.conversation(org ?? "none", id ?? "none"),
    enabled: Boolean(org && id),
    queryFn: () => makeInbox(session!).getConversation(id!),
  });
}

export function useMessages(conversationId: string | null) {
  const session = useSession();
  const org = session?.activeOrganization?.organizationId ?? null;
  return useQuery<Paginated<Message>>({
    queryKey: queryKeys.whatsapp.messages(org ?? "none", conversationId ?? "none"),
    enabled: Boolean(org && conversationId),
    retry: 2,
    refetchInterval: 8_000,
    queryFn: () => makeInbox(session!).listMessages(conversationId!),
  });
}

export function useInboxCounters() {
  const session = useSession();
  const org = session?.activeOrganization?.organizationId ?? null;
  return useQuery<InboxCounters>({
    queryKey: queryKeys.whatsapp.counters(org ?? "none"),
    enabled: Boolean(org),
    refetchInterval: 15_000,
    queryFn: () => makeInbox(session!).counters(),
  });
}

export function useSendMessage(conversationId: string | null) {
  const session = useSession();
  const org = session?.activeOrganization?.organizationId ?? null;
  const qc = useQueryClient();
  return useMutation({
    ...mutationDefaults,
    mutationFn: (body: string) => makeMessaging(session!).sendText(conversationId!, body),
    onSuccess: () => {
      if (!org || !conversationId) return;
      qc.invalidateQueries({ queryKey: queryKeys.whatsapp.messages(org, conversationId) });
      qc.invalidateQueries({ queryKey: queryKeys.whatsapp.conversations(org) });
    },
  });
}

export function useSendTemplate(conversationId: string | null) {
  const session = useSession();
  const org = session?.activeOrganization?.organizationId ?? null;
  const qc = useQueryClient();
  return useMutation({
    ...mutationDefaults,
    mutationFn: (templateId: string) =>
      makeMessaging(session!).sendTemplate(conversationId!, templateId),
    onSuccess: () => {
      if (!org || !conversationId) return;
      qc.invalidateQueries({ queryKey: queryKeys.whatsapp.messages(org, conversationId) });
      qc.invalidateQueries({ queryKey: queryKeys.whatsapp.conversations(org) });
    },
  });
}

export function useAssignConversation() {
  const session = useSession();
  const org = session?.activeOrganization?.organizationId ?? null;
  const qc = useQueryClient();
  return useMutation({
    ...mutationDefaults,
    mutationFn: (vars: { conversationId: string; assigneeId: string | null }) =>
      makeMessaging(session!).assign(vars.conversationId, vars.assigneeId),
    onSuccess: () => {
      if (org) qc.invalidateQueries({ queryKey: queryKeys.whatsapp.all(org) });
    },
  });
}

export function useMarkConversationRead() {
  const session = useSession();
  const org = session?.activeOrganization?.organizationId ?? null;
  const qc = useQueryClient();
  return useMutation({
    ...mutationDefaults,
    mutationFn: (conversationId: string) => makeMessaging(session!).markRead(conversationId),
    onSuccess: () => {
      if (org) {
        qc.invalidateQueries({ queryKey: queryKeys.whatsapp.conversations(org) });
        qc.invalidateQueries({ queryKey: queryKeys.whatsapp.counters(org) });
      }
    },
  });
}
