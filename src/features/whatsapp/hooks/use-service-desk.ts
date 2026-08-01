import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession, type AuthSession } from "@/core/auth";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { queryKeys, mutationDefaults } from "@/lib/query";
import {
  MessagingApplicationService,
  MessageSupabaseRepository,
  type ConversationNote,
  type QuickReply,
} from "@/features/whatsapp";

function makeService(session: AuthSession): MessagingApplicationService {
  const db = getSupabaseBrowserClient();
  return new MessagingApplicationService(db, new MessageSupabaseRepository(db), {
    organizationId: session.activeOrganization!.organizationId,
    actorId: session.user.id,
    enabledModules: session.enabledModules,
  });
}

function useOrg() {
  const session = useSession();
  return { session, org: session?.activeOrganization?.organizationId ?? null };
}

export function useSendMedia(conversationId: string | null) {
  const { session, org } = useOrg();
  const qc = useQueryClient();
  return useMutation({
    ...mutationDefaults,
    mutationFn: (v: { file: File; caption?: string }) =>
      makeService(session!).sendMedia(conversationId!, v.file, v.caption),
    onSuccess: () => {
      if (!org || !conversationId) return;
      qc.invalidateQueries({ queryKey: queryKeys.whatsapp.messages(org, conversationId) });
      qc.invalidateQueries({ queryKey: queryKeys.whatsapp.conversations(org) });
    },
  });
}

export function useSetConversationStatus() {
  const { session, org } = useOrg();
  const qc = useQueryClient();
  return useMutation({
    ...mutationDefaults,
    mutationFn: (v: { conversationId: string; status: "open" | "pending" | "closed" }) =>
      makeService(session!).setStatus(v.conversationId, v.status),
    onSuccess: () => org && qc.invalidateQueries({ queryKey: queryKeys.whatsapp.all(org) }),
  });
}

export function useSetConversationTags() {
  const { session, org } = useOrg();
  const qc = useQueryClient();
  return useMutation({
    ...mutationDefaults,
    mutationFn: (v: { conversationId: string; tags: string[] }) =>
      makeService(session!).setTags(v.conversationId, v.tags),
    onSuccess: () => org && qc.invalidateQueries({ queryKey: queryKeys.whatsapp.all(org) }),
  });
}

export function useConversationNotes(conversationId: string | null) {
  const { session, org } = useOrg();
  return useQuery<ConversationNote[]>({
    queryKey: [...queryKeys.whatsapp.all(org ?? "none"), "notes", conversationId ?? "none"],
    enabled: Boolean(org && conversationId),
    queryFn: () => makeService(session!).listNotes(conversationId!),
  });
}

export function useAddNote(conversationId: string | null) {
  const { session, org } = useOrg();
  const qc = useQueryClient();
  return useMutation({
    ...mutationDefaults,
    mutationFn: (body: string) => makeService(session!).addNote(conversationId!, body),
    onSuccess: () =>
      org &&
      qc.invalidateQueries({
        queryKey: [...queryKeys.whatsapp.all(org), "notes", conversationId ?? "none"],
      }),
  });
}

export function useQuickReplies() {
  const { session, org } = useOrg();
  return useQuery<QuickReply[]>({
    queryKey: [...queryKeys.whatsapp.all(org ?? "none"), "quick-replies"],
    enabled: Boolean(org),
    queryFn: () => makeService(session!).listQuickReplies(),
  });
}

export function useCreateQuickReply() {
  const { session, org } = useOrg();
  const qc = useQueryClient();
  return useMutation({
    ...mutationDefaults,
    mutationFn: (input: { shortcut: string; title: string; body: string }) =>
      makeService(session!).createQuickReply(input),
    onSuccess: () =>
      org && qc.invalidateQueries({ queryKey: [...queryKeys.whatsapp.all(org), "quick-replies"] }),
  });
}

export function useDeleteQuickReply() {
  const { session, org } = useOrg();
  const qc = useQueryClient();
  return useMutation({
    ...mutationDefaults,
    mutationFn: (id: string) => makeService(session!).deleteQuickReply(id),
    onSuccess: () =>
      org && qc.invalidateQueries({ queryKey: [...queryKeys.whatsapp.all(org), "quick-replies"] }),
  });
}
