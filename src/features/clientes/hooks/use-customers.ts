import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession, type AuthSession } from "@/core/auth";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { queryKeys, mutationDefaults, optimisticUpdate } from "@/lib/query";
import {
  CustomerApplicationService,
  CustomerSupabaseRepository,
  type Customer,
  type CustomerFilter,
  type CreateCustomerInput,
  type UpdateCustomerInput,
  type Paginated,
} from "@/features/clientes";

/**
 * Hooks TanStack Query de Customers.
 * Fluxo: React → Hook → Application Service → Repository → Supabase.
 * A UI nunca toca o repository; o service é a única porta de entrada.
 */
function makeService(session: AuthSession): CustomerApplicationService {
  const db = getSupabaseBrowserClient();
  const repo = new CustomerSupabaseRepository(db);
  return new CustomerApplicationService(repo, {
    organizationId: session.activeOrganization!.organizationId,
    actorId: session.user.id,
    enabledModules: session.enabledModules,
  }, db);
}

export function useCustomers(filter?: CustomerFilter) {
  const session = useSession();
  const org = session?.activeOrganization?.organizationId ?? null;
  return useQuery<Paginated<Customer>>({
    queryKey: queryKeys.customers.list(org ?? "none", filter),
    enabled: Boolean(org),
    retry: 2,
    queryFn: () => makeService(session!).list(filter),
  });
}

export function useCustomer(id: string | undefined) {
  const session = useSession();
  const org = session?.activeOrganization?.organizationId ?? null;
  return useQuery<Customer>({
    queryKey: queryKeys.customers.detail(org ?? "none", id ?? "none"),
    enabled: Boolean(org && id),
    retry: 2,
    queryFn: () => makeService(session!).get(id!),
  });
}

export function useCreateCustomer() {
  const session = useSession();
  const org = session?.activeOrganization?.organizationId ?? null;
  const qc = useQueryClient();
  return useMutation({
    ...mutationDefaults,
    mutationFn: (input: Omit<CreateCustomerInput, "organizationId">) => makeService(session!).create(input),
    onSuccess: () => {
      if (org) qc.invalidateQueries({ queryKey: queryKeys.customers.all(org) });
    },
  });
}

export function useUpdateCustomer() {
  const session = useSession();
  const org = session?.activeOrganization?.organizationId ?? null;
  const qc = useQueryClient();
  return useMutation({
    ...mutationDefaults,
    mutationFn: (vars: { id: string; changes: UpdateCustomerInput }) =>
      makeService(session!).update(vars.id, vars.changes),
    onSuccess: (_data, vars) => {
      if (!org) return;
      qc.invalidateQueries({ queryKey: queryKeys.customers.all(org) });
      qc.invalidateQueries({ queryKey: queryKeys.customers.detail(org, vars.id) });
    },
  });
}

export function useDeleteCustomer(filter?: CustomerFilter) {
  const session = useSession();
  const org = session?.activeOrganization?.organizationId ?? null;
  const qc = useQueryClient();
  return useMutation({
    ...mutationDefaults,
    mutationFn: (id: string) => makeService(session!).remove(id),
    // Optimistic: remove da lista antes da confirmação; rollback em erro.
    onMutate: async (id) => {
      if (!org) return {};
      const key = queryKeys.customers.list(org, filter);
      const rollback = await optimisticUpdate<Paginated<Customer>>(qc, key, (prev) =>
        prev
          ? { items: prev.items.filter((c) => c.id !== id), total: Math.max(0, prev.total - 1) }
          : { items: [], total: 0 },
      );
      return { rollback };
    },
    onError: (_e, _id, ctx) => ctx?.rollback?.(),
    onSettled: () => {
      if (org) qc.invalidateQueries({ queryKey: queryKeys.customers.all(org) });
    },
  });
}
