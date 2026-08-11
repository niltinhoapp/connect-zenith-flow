import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession, type AuthSession } from "@/core/auth";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { queryKeys, mutationDefaults } from "@/lib/query";
import type { Paginated } from "@/core/domain";
import {
  DealApplicationService,
  DealSupabaseRepository,
  type Deal,
  type DealFilter,
  type CreateDealInput,
  type StageType,
} from "@/features/crm";

function makeService(session: AuthSession): DealApplicationService {
  const repo = new DealSupabaseRepository(getSupabaseBrowserClient());
  return new DealApplicationService(repo, {
    organizationId: session.activeOrganization!.organizationId,
    actorId: session.user.id,
    enabledModules: session.enabledModules,
  });
}

export function useDeals(filter?: DealFilter) {
  const session = useSession();
  const org = session?.activeOrganization?.organizationId ?? null;
  return useQuery<Paginated<Deal>>({
    queryKey: queryKeys.deals.list(org ?? "none", filter),
    enabled: Boolean(org),
    retry: 2,
    queryFn: () => makeService(session!).list(filter),
  });
}

export function useCreateDeal() {
  const session = useSession();
  const org = session?.activeOrganization?.organizationId ?? null;
  const qc = useQueryClient();
  return useMutation({
    ...mutationDefaults,
    mutationFn: (input: Omit<CreateDealInput, "organizationId">) =>
      makeService(session!).create(input),
    onSuccess: () => {
      if (org) qc.invalidateQueries({ queryKey: queryKeys.deals.all(org) });
    },
  });
}

/**
 * Move o deal de estágio (drag-and-drop do CRM). Persiste imediatamente e
 * dispara Timeline/Audit (banco) + eventos (won/lost/stage.changed) via service.
 */
export function useMoveDealStage() {
  const session = useSession();
  const org = session?.activeOrganization?.organizationId ?? null;
  const qc = useQueryClient();
  return useMutation({
    ...mutationDefaults,
    mutationFn: (vars: { id: string; stageId: string; stageType: StageType; reason?: string }) =>
      makeService(session!).moveStage(vars.id, vars.stageId, vars.stageType, vars.reason),
    onSuccess: () => {
      if (org) qc.invalidateQueries({ queryKey: queryKeys.deals.all(org) });
    },
  });
}
