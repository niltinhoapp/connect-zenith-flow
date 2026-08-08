import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession, type AuthSession } from "@/core/auth";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { mutationDefaults } from "@/lib/query";
import { WebhookService } from "@/core/webhooks";
import { InfrastructureError } from "@/core/errors";
import { ApiKeyApplicationService } from "@/features/configuracoes/application/api-key-service";
import {
  SettingsApplicationService,
  type SettingsView,
} from "@/features/configuracoes/application/settings-service";
import type {
  UpdateProfileInput,
  UpdateWorkspaceInput,
  ConnectWhatsAppInput,
  CreateWebhookInput,
  NotificationPreferences,
  CreateApiKeyInput,
} from "@/features/configuracoes/schema";

const settingsKey = (org: string) => ["settings", org] as const;
const webhooksKey = (org: string) => ["settings", org, "webhooks"] as const;
const apiKeysKey = (org: string) => ["settings", org, "api-keys"] as const;
const apiScopesKey = ["settings", "api-scopes"] as const;

async function edgeFunctionErrorMessage(error: unknown, fallback: string): Promise<string> {
  if (error && typeof error === "object" && "context" in error) {
    const context = (error as { context?: unknown }).context;
    if (context instanceof Response) {
      const payload = await context.clone().json().catch(() => null) as
        | { error?: unknown; detail?: unknown }
        | null;
      const detail = payload?.detail && typeof payload.detail === "object"
        ? JSON.stringify(payload.detail)
        : payload?.detail;
      if (typeof payload?.error === "string") {
        return detail ? `${payload.error}: ${String(detail)}` : payload.error;
      }
    }
  }
  return error instanceof Error && error.message ? error.message : fallback;
}

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

function makeApiKeyService(session: AuthSession) {
  return new ApiKeyApplicationService(getSupabaseBrowserClient(), {
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

export function useUpdatePreferences() {
  const session = useSession();
  const org = session?.activeOrganization?.organizationId ?? null;
  const queryClient = useQueryClient();
  return useMutation({
    ...mutationDefaults,
    mutationFn: (input: NotificationPreferences) => makeService(session!).updatePreferences(input),
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
      if (error) {
        throw new InfrastructureError(
          await edgeFunctionErrorMessage(error, "Falha ao conectar o WhatsApp."),
          { cause: error },
        );
      }
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

export function useApiKeys() {
  const session = useSession();
  const org = session?.activeOrganization?.organizationId ?? null;
  return useQuery({
    queryKey: apiKeysKey(org ?? "none"),
    enabled: Boolean(org),
    queryFn: () => makeApiKeyService(session!).list(),
  });
}

export function useApiScopes() {
  const session = useSession();
  return useQuery({
    queryKey: apiScopesKey,
    enabled: Boolean(session),
    staleTime: 60 * 60 * 1000,
    queryFn: () => makeApiKeyService(session!).listScopes(),
  });
}

export function useCreateApiKey() {
  const session = useSession();
  const org = session?.activeOrganization?.organizationId ?? null;
  const queryClient = useQueryClient();
  return useMutation({
    ...mutationDefaults,
    mutationFn: (input: CreateApiKeyInput) => makeApiKeyService(session!).create(input),
    onSuccess: () => {
      if (org) queryClient.invalidateQueries({ queryKey: apiKeysKey(org) });
    },
  });
}

export function useRevokeApiKey() {
  const session = useSession();
  const org = session?.activeOrganization?.organizationId ?? null;
  const queryClient = useQueryClient();
  return useMutation({
    ...mutationDefaults,
    mutationFn: (id: string) => makeApiKeyService(session!).revoke(id),
    onSuccess: () => {
      if (org) queryClient.invalidateQueries({ queryKey: apiKeysKey(org) });
    },
  });
}
