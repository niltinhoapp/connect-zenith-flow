import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/core/auth";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { CrmBoardService, type CrmBoard } from "@/features/crm/application/crm-board-service";

export function crmBoardKey(org: string) {
  return ["crm-board", org] as const;
}

export function useCrmBoard() {
  const session = useSession();
  const org = session?.activeOrganization?.organizationId ?? null;
  return useQuery<CrmBoard>({
    queryKey: crmBoardKey(org ?? "none"),
    enabled: Boolean(org),
    retry: 2,
    queryFn: () =>
      new CrmBoardService(getSupabaseBrowserClient(), {
        organizationId: session!.activeOrganization!.organizationId,
        actorId: session!.user.id,
        enabledModules: session!.enabledModules,
      }).getBoard(),
  });
}
