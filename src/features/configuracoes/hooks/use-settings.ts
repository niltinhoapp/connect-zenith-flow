import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession, type AuthSession } from "@/core/auth";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { mutationDefaults } from "@/lib/query";
import { WebhookService } from "@/core/webhooks";
import { InfrastructureError } from "@/core/errors";
import {
  SettingsApplicationService,
  type SettingsView,
} from "@/features/configuracoes/application/settings-service";
import type {
  UpdateProfileInput,
  UpdateWorkspaceInput,
  ConnectWhatsAppInput,
  CreateWebhookInput,
} from "@/features/configuracoes/schema";

const settingsKey = (org: string) => ["settings", org] as const;
const webhooksKey = (org: string) => ["settings", org, "webhooks"] as const;

function makeService(session: AuthSession) {
  return new SettingsApplicationService(getSupabaseBrowserClient(), {
    organizationId: session.activeOrganization!.organizationId,
    actorId: session.user.id,
    enabledModules: session.enabledModules,
  });
}

function makeWebhookService(session: AuthSession) {
  return new WebhookService(getSupabaseBrowserClient(), {
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

export function useConnectWhatsApp() {
  const session = useSession();
  const org = session?.activeOrganization?.organizationId ?? null;
  const queryClient = useQueryClient();
  return useMutation({
    ...mutationDefaults,
    mutationFn: async (input: ConnectWhatsAppInput) => {
      const { data, error } = await getSupabaseBrowserClient().functions.invoke("whatsapp-connect", {
        body: {
          organizationId: org,
          mode: "manual",
          accessToken: input.accessToken,
          wabaId: input.wabaId,
          phoneNumberId: input.phoneNumberId,
        },
      });
      if (error) throw new InfrastructureError(error.message, { cause: error });
      if (!data?.ok) throw new InfrastructureError(String(data?.error ?? "Falha ao conectar o WhatsApp."));
      return data;
    },
    onSuccess: () => {
      if (org) queryClient.invalidateQueries({ queryKey: settingsKey(org) });
    },
  });
}

export function useWebhooks() {
  const session = useSession();
  const org = session?.activeOrganization?.organizationId ?? null;
  return useQuery({
    queryKey: webhooksKey(org ?? "none"),
    enabled: Boolean(org),
    queryFn: () => makeWebhookService(session!).list(),
  });
}

export function useCreateWebhook() {
  const session = useSession();
  const org = session?.activeOrganization?.organizationId ?? null;
  const queryClient = useQueryClient();
  return useMutation({
    ...mutationDefaults,
    mutationFn: (input: CreateWebhookInput) => makeWebhookService(session!).create(input),
    onSuccess: () => {
      if (org) queryClient.invalidateQueries({ queryKey: webhooksKey(org) });
    },
  });
}

export function useToggleWebhook() {
  const session = useSession();
  const org = session?.activeOrganization?.organizationId ?? null;
  const queryClient = useQueryClient();
  return useMutation({
    ...mutationDefaults,
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      makeWebhookService(session!).setEnabled(id, enabled),
    onSuccess: () => {
      if (org) queryClient.invalidateQueries({ queryKey: webhooksKey(org) });
    },
  });
}

export function useRemoveWebhook() {
  const session = useSession();
  const org = session?.activeOrganization?.organizationId ?? null;
  const queryClient = useQueryClient();
  return useMutation({
    ...mutationDefaults,
    mutationFn: (id: string) => makeWebhookService(session!).remove(id),
    onSuccess: () => {
      if (org) queryClient.invalidateQueries({ queryKey: webhooksKey(org) });
    },
  });
}
