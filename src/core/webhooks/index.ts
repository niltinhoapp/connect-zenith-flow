import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { InfrastructureError } from "@/core/errors";
import type { ServiceContext } from "@/core/application/context";

export interface WebhookInput {
  url: string;
  events: string[];
  secret?: string;
}

/**
 * Core · Webhooks — CRUD de endpoints de saída. A entrega (dispatch) é feita
 * pelo worker a partir do outbox do Event Bus (`dispatch_webhooks`).
 */
export class WebhookService {
  constructor(
    private readonly db: SupabaseClient<Database>,
    private readonly ctx: ServiceContext,
  ) {}

  async list() {
    const { data, error } = await this.db
      .from("webhooks")
      .select("id, url, events, enabled")
      .eq("organization_id", this.ctx.organizationId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) throw new InfrastructureError(error.message, { cause: error });
    return data ?? [];
  }

  async create(input: WebhookInput): Promise<string> {
    const { data, error } = await this.db
      .from("webhooks")
      .insert({
        organization_id: this.ctx.organizationId,
        url: input.url,
        events: input.events,
        secret: input.secret ?? null,
      })
      .select("id")
      .single();
    if (error) throw new InfrastructureError(error.message, { cause: error });
    return data.id;
  }

  async setEnabled(id: string, enabled: boolean): Promise<void> {
    const { error } = await this.db
      .from("webhooks")
      .update({ enabled })
      .eq("id", id)
      .eq("organization_id", this.ctx.organizationId);
    if (error) throw new InfrastructureError(error.message, { cause: error });
  }

  async remove(id: string): Promise<void> {
    const { error } = await this.db
      .from("webhooks")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .eq("organization_id", this.ctx.organizationId);
    if (error) throw new InfrastructureError(error.message, { cause: error });
  }
}
