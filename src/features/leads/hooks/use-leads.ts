import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession, type AuthSession } from "@/core/auth";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { queryKeys, mutationDefaults } from "@/lib/query";
import type { Paginated } from "@/core/domain";
import {
  LeadApplicationService,
  LeadSupabaseRepository,
  type Lead,
  type LeadFilter,
  type CreateLeadInput,
} from "@/features/leads";

function makeService(session: AuthSession): LeadApplicationService {
  const repo = new LeadSupabaseRepository(getSupabaseBrowserClient());
  return new LeadApplicationService(repo, {
    organizationId: session.activeOrganization!.organizationId,
    actorId: session.user.id,
    enabledModules: session.enabledModules,
  });
}

export function useLeads(filter?: LeadFilter) {
  const session = useSession();
  const org = session?.activeOrganization?.organizationId ?? null;
  return useQuery<Paginated<Lead>>({
    queryKey: queryKeys.leads.list(org ?? "none", filter),
    enabled: Boolean(org),
    retry: 2,
    queryFn: () => makeService(session!).list(filter),
  });
}

export function useCreateLead() {
  const session = useSession();
  const org = session?.activeOrganization?.organizationId ?? null;
  const qc = useQueryClient();
  return useMutation({
    ...mutationDefaults,
    mutationFn: (input: Omit<CreateLeadInput, "organizationId">) => makeService(session!).create(input),
    onSuccess: () => {
      if (org) qc.invalidateQueries({ queryKey: queryKeys.leads.all(org) });
    },
  });
}

export function useQualifyLead() {
  const session = useSession();
  const org = session?.activeOrganization?.organizationId ?? null;
  const qc = useQueryClient();
  return useMutation({
    ...mutationDefaults,
    mutationFn: (id: string) => makeService(session!).qualify(id),
    onSuccess: () => {
      if (org) qc.invalidateQueries({ queryKey: queryKeys.leads.all(org) });
    },
  });
}

/** Converte Lead → Customer e invalida ambos os caches. */
export function useConvertLead() {
  const session = useSession();
  const org = session?.activeOrganization?.organizationId ?? null;
  const qc = useQueryClient();
  return useMutation({
    ...mutationDefaults,
    mutationFn: (id: string) => makeService(session!).convert(id),
    onSuccess: () => {
      if (!org) return;
      qc.invalidateQueries({ queryKey: queryKeys.leads.all(org) });
      qc.invalidateQueries({ queryKey: queryKeys.customers.all(org) });
    },
  });
}
