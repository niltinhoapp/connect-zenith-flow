import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/core/auth";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { mutationDefaults } from "@/lib/query";
import { BillingService } from "./billing-service";
import type { BillingCustomerInput } from "./types";

export const billingKey = (organizationId: string) => ["billing", organizationId] as const;
export const billingAccessKey = (organizationId: string) =>
  ["billing-access", organizationId] as const;

export function useBillingOverview() {
  const session = useSession();
  const organizationId = session?.activeOrganization?.organizationId ?? null;
  return useQuery({
    queryKey: billingKey(organizationId ?? "none"),
    enabled: Boolean(organizationId),
    queryFn: () => new BillingService(getSupabaseBrowserClient(), organizationId!).overview(),
  });
}

export function useBillingAccess() {
  const session = useSession();
  const organizationId = session?.activeOrganization?.organizationId ?? null;
  return useQuery({
    queryKey: billingAccessKey(organizationId ?? "none"),
    enabled: Boolean(organizationId),
    queryFn: () => new BillingService(getSupabaseBrowserClient(), organizationId!).access(),
  });
}

export function useRequestAiAddon() {
  const session = useSession();
  const organizationId = session?.activeOrganization?.organizationId ?? null;
  const queryClient = useQueryClient();
  return useMutation({
    ...mutationDefaults,
    mutationFn: ({ productId, idempotencyKey }: { productId: string; idempotencyKey?: string }) =>
      new BillingService(getSupabaseBrowserClient(), organizationId!).requestAiAddon(
        productId,
        idempotencyKey,
      ),
    onSuccess: () => {
      if (organizationId) queryClient.invalidateQueries({ queryKey: billingKey(organizationId) });
    },
  });
}

export function useCreateAiAddonCheckout() {
  const session = useSession();
  const organizationId = session?.activeOrganization?.organizationId ?? null;
  const queryClient = useQueryClient();
  return useMutation({
    ...mutationDefaults,
    mutationFn: ({
      productId,
      customer,
      idempotencyKey,
    }: {
      productId: string;
      customer: BillingCustomerInput;
      idempotencyKey?: string;
    }) => {
      if (!organizationId) throw new Error("Selecione uma empresa antes de comprar créditos.");
      return new BillingService(getSupabaseBrowserClient(), organizationId).createAiAddonCheckout(
        productId,
        customer,
        idempotencyKey,
      );
    },
    onSuccess: () => {
      if (organizationId) queryClient.invalidateQueries({ queryKey: billingKey(organizationId) });
    },
  });
}

export function useCreateSubscriptionCheckout() {
  const session = useSession();
  const organizationId = session?.activeOrganization?.organizationId ?? null;
  const queryClient = useQueryClient();
  return useMutation({
    ...mutationDefaults,
    mutationFn: ({ customer }: { customer: BillingCustomerInput }) => {
      if (!organizationId) throw new Error("Selecione uma empresa antes de assinar.");
      return new BillingService(
        getSupabaseBrowserClient(),
        organizationId,
      ).createSubscriptionCheckout(customer);
    },
    onSuccess: () => {
      if (organizationId) {
        queryClient.invalidateQueries({ queryKey: billingKey(organizationId) });
        queryClient.invalidateQueries({ queryKey: billingAccessKey(organizationId) });
      }
    },
  });
}
