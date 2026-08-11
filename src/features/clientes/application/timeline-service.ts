import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";
import { guard } from "@/core/application/guard";
import { assertModuleEnabled } from "@/core/feature-flags";
import { InfrastructureError } from "@/core/errors";
import type { ServiceContext } from "@/core/application/context";

export interface TimelineEntry {
  id: string;
  eventType: string;
  title: string;
  description: string | null;
  module: string | null;
  payload: Json;
  createdAt: string;
}

/**
 * Read model da Timeline do cliente. Consome exclusivamente os eventos
 * registrados em `customer_timeline` (hub multi-módulo: CRM, WhatsApp, IA,
 * Automação, Financeiro, Agenda, API). Nenhum texto fixo — tudo vem do banco.
 */
export class TimelineApplicationService {
  constructor(
    private readonly db: SupabaseClient<Database>,
    private readonly ctx: ServiceContext,
  ) {}

  list(customerId: string): Promise<TimelineEntry[]> {
    return guard(
      async () => {
        assertModuleEnabled(this.ctx.enabledModules, "clientes");
        const { data, error } = await this.db
          .from("customer_timeline")
          .select("id, event_type, title, description, module, payload, created_at")
          .eq("customer_id", customerId)
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(50);
        if (error) throw new InfrastructureError(error.message, { cause: error });
        return (data ?? []).map((r) => ({
          id: r.id,
          eventType: r.event_type,
          title: r.title,
          description: r.description,
          module: r.module,
          payload: r.payload,
          createdAt: r.created_at,
        }));
      },
      { service: "timeline.list", customerId },
    );
  }
}
