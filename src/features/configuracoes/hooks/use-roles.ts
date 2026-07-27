import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession, type AuthSession } from "@/core/auth";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { mutationDefaults } from "@/lib/query";
import {
  RolesApplicationService,
  type RoleView,
  type PermissionView,
} from "@/features/configuracoes/application/roles-service";

function makeService(session: AuthSession): RolesApplicationService {
  return new RolesApplicationService(getSupabaseBrowserClient(), {
    organizationId: session.activeOrganization!.organizationId,
    actorId: session.user.id,
    enabledModules: session.enabledModules,
  });
}

export function useRoles() {
  const session = useSession();
  const org = session?.activeOrganization?.organizationId ?? null;
  return useQuery<RoleView[]>({
    queryKey: ["roles", org ?? "none"],
    enabled: Boolean(org),
    retry: 2,
    queryFn: () => makeService(session!).listRoles(),
  });
}

export function usePermissions() {
  const session = useSession();
  const org = session?.activeOrganization?.organizationId ?? null;
  return useQuery<PermissionView[]>({
    queryKey: ["permissions-catalog", org ?? "none"],
    enabled: Boolean(org),
    retry: 2,
    staleTime: 5 * 60_000,
    queryFn: () => makeService(session!).listPermissions(),
  });
}

export function useCreateRole() {
  const session = useSession();
  const org = session?.activeOrganization?.organizationId ?? null;
  const qc = useQueryClient();
  return useMutation({
    ...mutationDefaults,
    mutationFn: (vars: { name: string; permissionKeys: string[] }) =>
      makeService(session!).createRole(vars.name, vars.permissionKeys),
    onSuccess: () => {
      if (org) qc.invalidateQueries({ queryKey: ["roles", org] });
    },
  });
}
