import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { guard } from "@/core/application/guard";
import { assertModuleEnabled } from "@/core/feature-flags";
import { InfrastructureError } from "@/core/errors";
import type { ServiceContext } from "@/core/application/context";
import {
  updateProfileSchema,
  updateWorkspaceSchema,
  type UpdateProfileInput,
  type UpdateWorkspaceInput,
  notificationPreferencesSchema,
  type NotificationPreferences,
} from "@/features/configuracoes/schema";

const defaultPreferences: NotificationPreferences = {
  email: true,
  push: true,
  compact: false,
  analytics: true,
};

export interface SettingsView {
  profile: {
    fullName: string;
    email: string;
    avatarUrl: string | null;
  };
  workspace: {
    id: string;
    name: string;
    slug: string;
    planId: string;
    enabledModules: string[];
  };
  whatsapp: {
    connected: boolean;
    provider: "meta" | "evolution" | null;
    name: string | null;
    status: "connected" | "disconnected" | "error" | "pending" | null;
    connectedAt: string | null;
  };
  preferences: NotificationPreferences;
  usage: Array<{ resource: string; used: number; limit: number; period: "month" | "total" }>;
}

export class SettingsApplicationService {
  constructor(
    private readonly db: SupabaseClient<Database>,
    private readonly ctx: ServiceContext,
  ) {}

  private ensureEnabled() {
    assertModuleEnabled(this.ctx.enabledModules, "configuracoes");
  }

  getSettings(): Promise<SettingsView> {
    return guard(async () => {
      this.ensureEnabled();
      const [profileResult, workspaceResult, whatsappResult, preferences] = await Promise.all([
        this.db
          .from("profiles")
          .select("full_name, email, avatar_url")
          .eq("id", this.ctx.actorId)
          .single(),
        this.db
          .from("organizations")
          .select("id, name, slug, plan_id, enabled_modules")
          .eq("id", this.ctx.organizationId)
          .single(),
        this.db
          .from("whatsapp_accounts")
          .select("provider, name, status, connected_at")
          .eq("organization_id", this.ctx.organizationId)
          .is("deleted_at", null)
          .order("connected_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        this.loadPreferences(),
      ]);
      if (profileResult.error) {
        throw new InfrastructureError(profileResult.error.message, { cause: profileResult.error });
      }
      if (workspaceResult.error) {
        throw new InfrastructureError(workspaceResult.error.message, { cause: workspaceResult.error });
      }
      if (whatsappResult.error) {
        throw new InfrastructureError(whatsappResult.error.message, { cause: whatsappResult.error });
      }
      const profile = profileResult.data;
      const workspace = workspaceResult.data;
      const whatsapp = whatsappResult.data;
      const usage = await this.loadUsage(workspace.plan_id);
      return {
        profile: {
          fullName: profile.full_name,
          email: profile.email,
          avatarUrl: profile.avatar_url,
        },
        workspace: {
          id: workspace.id,
          name: workspace.name,
          slug: workspace.slug,
          planId: workspace.plan_id,
          enabledModules: workspace.enabled_modules,
        },
        whatsapp: {
          connected: whatsapp?.status === "connected",
          provider: whatsapp?.provider ?? null,
          name: whatsapp?.name ?? null,
          status: whatsapp?.status ?? null,
          connectedAt: whatsapp?.connected_at ?? null,
        },
        preferences,
        usage,
      };
    }, { service: "settings.get" });
  }

  private async loadUsage(planId: string): Promise<SettingsView["usage"]> {
    const month = new Date().toISOString().slice(0, 7);
    const [limitsResult, usageResult] = await Promise.all([
      this.db.from("plan_limits").select("resource, limit_value, period").eq("plan_id", planId),
      this.db.from("quota_usage").select("resource, period_key, used").eq("organization_id", this.ctx.organizationId),
    ]);
    if (limitsResult.error) throw new InfrastructureError(limitsResult.error.message, { cause: limitsResult.error });
    if (usageResult.error) throw new InfrastructureError(usageResult.error.message, { cause: usageResult.error });
    return (limitsResult.data ?? []).map((limit) => {
      const record = (usageResult.data ?? []).find((item) =>
        item.resource === limit.resource && (limit.period === "total" || item.period_key === month),
      );
      return { resource: limit.resource, used: record?.used ?? 0, limit: limit.limit_value, period: limit.period };
    });
  }

  private async configurationModuleId(): Promise<string> {
    const { data, error } = await this.db.from("modules").select("id").eq("key", "configuracoes").single();
    if (error) throw new InfrastructureError(error.message, { cause: error });
    return data.id;
  }

  private async loadPreferences(): Promise<NotificationPreferences> {
    const moduleId = await this.configurationModuleId();
    const { data, error } = await this.db
      .from("module_configs")
      .select("config")
      .eq("organization_id", this.ctx.organizationId)
      .eq("module_id", moduleId)
      .maybeSingle();
    if (error) throw new InfrastructureError(error.message, { cause: error });
    const candidate = data?.config && typeof data.config === "object" && !Array.isArray(data.config)
      ? (data.config as Record<string, unknown>).notifications
      : null;
    const parsed = notificationPreferencesSchema.safeParse(candidate);
    return parsed.success ? parsed.data : defaultPreferences;
  }

  updatePreferences(input: NotificationPreferences): Promise<void> {
    return guard(async () => {
      this.ensureEnabled();
      const preferences = notificationPreferencesSchema.parse(input);
      const moduleId = await this.configurationModuleId();
      const { data: current, error: readError } = await this.db
        .from("module_configs")
        .select("config")
        .eq("organization_id", this.ctx.organizationId)
        .eq("module_id", moduleId)
        .maybeSingle();
      if (readError) throw new InfrastructureError(readError.message, { cause: readError });
      const currentConfig = current?.config && typeof current.config === "object" && !Array.isArray(current.config)
        ? current.config
        : {};
      const { error } = await this.db.from("module_configs").upsert({
        organization_id: this.ctx.organizationId,
        module_id: moduleId,
        config: { ...currentConfig, notifications: preferences },
        schema_version: 1,
        updated_by: this.ctx.actorId,
        validated_at: new Date().toISOString(),
      }, { onConflict: "organization_id,module_id" });
      if (error) throw new InfrastructureError(error.message, { cause: error });
    }, { service: "settings.preferences.update" });
  }

  updateProfile(input: UpdateProfileInput): Promise<void> {
    return guard(async () => {
      this.ensureEnabled();
      const values = updateProfileSchema.parse(input);
      const { error } = await this.db
        .from("profiles")
        .update({ full_name: values.fullName })
        .eq("id", this.ctx.actorId);
      if (error) throw new InfrastructureError(error.message, { cause: error });
    }, { service: "settings.profile.update" });
  }

  updateWorkspace(input: UpdateWorkspaceInput): Promise<void> {
    return guard(async () => {
      this.ensureEnabled();
      const values = updateWorkspaceSchema.parse(input);
      const { error } = await this.db
        .from("organizations")
        .update({ name: values.name })
        .eq("id", this.ctx.organizationId);
      if (error) throw new InfrastructureError(error.message, { cause: error });
    }, { service: "settings.workspace.update" });
  }
}
