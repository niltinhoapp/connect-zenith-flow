import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/core/auth";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  DashboardApplicationService,
  type DashboardMetrics,
} from "@/features/dashboard/application/dashboard-service";

/** Hook do Dashboard: React → Hook → DashboardApplicationService → RPC agregada. */
export function useDashboard() {
  const session = useSession();
  const org = session?.activeOrganization?.organizationId ?? null;
  return useQuery<DashboardMetrics>({
    queryKey: ["dashboard", org ?? "none"],
    enabled: Boolean(org),
    retry: 2,
    queryFn: () => {
      const service = new DashboardApplicationService(getSupabaseBrowserClient(), {
        organizationId: session!.activeOrganization!.organizationId,
        actorId: session!.user.id,
        enabledModules: session!.enabledModules,
      });
      return service.getMetrics();
    },
  });
}
