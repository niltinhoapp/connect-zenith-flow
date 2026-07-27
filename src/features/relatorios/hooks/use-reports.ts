import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/core/auth";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { ReportsApplicationService, type ReportsMetrics } from "@/features/relatorios/application/reports-service";

export function useReports() {
  const session = useSession();
  const org = session?.activeOrganization?.organizationId ?? null;
  return useQuery<ReportsMetrics>({
    queryKey: ["reports", org ?? "none"],
    enabled: Boolean(org),
    retry: 2,
    queryFn: () =>
      new ReportsApplicationService(getSupabaseBrowserClient(), {
        organizationId: session!.activeOrganization!.organizationId,
        actorId: session!.user.id,
        enabledModules: session!.enabledModules,
      }).getMetrics(),
  });
}
