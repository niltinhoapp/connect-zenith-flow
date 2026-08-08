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
} from "@/features/configuracoes/schema";

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
      const [profileResult, workspaceResult, whatsappResult] = await Promise.all([
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
      };
    }, { service: "settings.get" });
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

