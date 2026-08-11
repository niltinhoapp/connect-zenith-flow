import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { InfrastructureError } from "@/core/errors";
import type { ServiceContext } from "@/core/application/context";

export interface TemplateView {
  key: string;
  name: string;
  description: string;
  version: number;
}

/**
 * Core · Templates — modelos de mercado (onboarding). Aplicação 100% data-driven
 * (RPC `apply_market_template` lê a `definition jsonb`).
 */
export class TemplateService {
  constructor(
    private readonly db: SupabaseClient<Database>,
    private readonly ctx: ServiceContext,
  ) {}

  async list(): Promise<TemplateView[]> {
    const { data, error } = await this.db
      .from("market_templates")
      .select("key, name, description, version")
      .eq("is_active", true)
      .order("position");
    if (error) throw new InfrastructureError(error.message, { cause: error });
    return (data ?? []).map((t) => ({
      key: t.key,
      name: t.name,
      description: t.description,
      version: t.version,
    }));
  }

  async apply(key: string): Promise<void> {
    const { error } = await this.db.rpc("apply_market_template", {
      p_org: this.ctx.organizationId,
      p_key: key,
    });
    if (error) throw new InfrastructureError(error.message, { cause: error });
  }
}
