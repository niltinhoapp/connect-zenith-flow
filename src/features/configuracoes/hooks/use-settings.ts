import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession, type AuthSession } from "@/core/auth";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { mutationDefaults } from "@/lib/query";
import {
  SettingsApplicationService,
  type SettingsView,
} from "@/features/configuracoes/application/settings-service";
import type {
  UpdateProfileInput,
  UpdateWorkspaceInput,
} from "@/features/configuracoes/schema";

const settingsKey = (org: string) => ["settings", org] as const;

function makeService(session: AuthSession) {
  return new SettingsApplicationService(getSupabaseBrowserClient(), {
    organizationId: session.activeOrganization!.organizationId,
    actorId: session.user.id,
    enabledModules: session.enabledModules,
  });
}

export function useSettings() {
  const session = useSession();
  const org = session?.activeOrganization?.organizationId ?? null;
  return useQuery<SettingsView>({
    queryKey: settingsKey(org ?? "none"),
    enabled: Boolean(org),
    queryFn: () => makeService(session!).getSettings(),
  });
}

export function useUpdateProfile() {
  const session = useSession();
  const org = session?.activeOrganization?.organizationId ?? null;
  const queryClient = useQueryClient();
  return useMutation({
    ...mutationDefaults,
    mutationFn: (input: UpdateProfileInput) => makeService(session!).updateProfile(input),
    onSuccess: () => {
      if (org) queryClient.invalidateQueries({ queryKey: settingsKey(org) });
    },
  });
}

export function useUpdateWorkspace() {
  const session = useSession();
  const org = session?.activeOrganization?.organizationId ?? null;
  const queryClient = useQueryClient();
  return useMutation({
    ...mutationDefaults,
    mutationFn: (input: UpdateWorkspaceInput) => makeService(session!).updateWorkspace(input),
    onSuccess: () => {
      if (org) queryClient.invalidateQueries({ queryKey: settingsKey(org) });
    },
  });
}

