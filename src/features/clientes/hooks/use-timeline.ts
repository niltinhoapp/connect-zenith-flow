import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/core/auth";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { TimelineApplicationService, type TimelineEntry } from "@/features/clientes/application/timeline-service";

export function useCustomerTimeline(customerId: string | undefined) {
  const session = useSession();
  const org = session?.activeOrganization?.organizationId ?? null;
  return useQuery<TimelineEntry[]>({
    queryKey: ["timeline", org ?? "none", customerId ?? "none"],
    enabled: Boolean(org && customerId),
    retry: 2,
    queryFn: () =>
      new TimelineApplicationService(getSupabaseBrowserClient(), {
        organizationId: session!.activeOrganization!.organizationId,
        actorId: session!.user.id,
        enabledModules: session!.enabledModules,
      }).list(customerId!),
  });
}
