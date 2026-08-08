import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/core/auth";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { mutationDefaults } from "@/lib/query";
import { BillingService } from "./billing-service";

export const billingKey = (organizationId: string) => ["billing", organizationId] as const;

export function useBillingOverview() {
  const session = useSession();
  const organizationId = session?.activeOrganization?.organizationId ?? null;
  return useQuery({
    queryKey: billingKey(organizationId ?? "none"),
    enabled: Boolean(organizationId),
    queryFn: () => new BillingService(getSupabaseBrowserClient(), organizationId!).overview(),
  });
}

export function useRequestAiAddon() {
  const session = useSession();
  const organizationId = session?.activeOrganization?.organizationId ?? null;
  const queryClient = useQueryClient();
  return useMutation({
    ...mutationDefaults,
    mutationFn: ({ productId, idempotencyKey }: { productId: string; idempotencyKey?: string }) =>
      new BillingService(getSupabaseBrowserClient(), organizationId!).requestAiAddon(productId, idempotencyKey),
    onSuccess: () => {
      if (organizationId) queryClient.invalidateQueries({ queryKey: billingKey(organizationId) });
    },
  });
}
