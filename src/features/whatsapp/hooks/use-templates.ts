import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession, type AuthSession } from "@/core/auth";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { queryKeys, mutationDefaults } from "@/lib/query";
import type { Paginated } from "@/core/domain";
import {
  TemplateApplicationService,
  TemplateSupabaseRepository,
  type WhatsAppTemplate,
  type TemplateFilter,
  type CreateTemplateInput,
} from "@/features/whatsapp";

function makeService(session: AuthSession): TemplateApplicationService {
  const db = getSupabaseBrowserClient();
  return new TemplateApplicationService(new TemplateSupabaseRepository(db), {
    organizationId: session.activeOrganization!.organizationId,
    actorId: session.user.id,
    enabledModules: session.enabledModules,
  });
}

export function useTemplates(filter?: TemplateFilter) {
  const session = useSession();
  const org = session?.activeOrganization?.organizationId ?? null;
  return useQuery<Paginated<WhatsAppTemplate>>({
    queryKey: queryKeys.whatsapp.templates(org ?? "none", filter),
    enabled: Boolean(org),
    retry: 2,
    queryFn: () => makeService(session!).list(filter),
  });
}

export function useCreateTemplate() {
  const session = useSession();
  const org = session?.activeOrganization?.organizationId ?? null;
  const qc = useQueryClient();
  return useMutation({
    ...mutationDefaults,
    mutationFn: (input: Omit<CreateTemplateInput, "organizationId">) =>
      makeService(session!).create(input),
    onSuccess: () => {
      if (org) qc.invalidateQueries({ queryKey: queryKeys.whatsapp.templates(org) });
    },
  });
}

export function useDeleteTemplate() {
  const session = useSession();
  const org = session?.activeOrganization?.organizationId ?? null;
  const qc = useQueryClient();
  return useMutation({
    ...mutationDefaults,
    mutationFn: (id: string) => makeService(session!).remove(id),
    onSuccess: () => {
      if (org) qc.invalidateQueries({ queryKey: queryKeys.whatsapp.templates(org) });
    },
  });
}
