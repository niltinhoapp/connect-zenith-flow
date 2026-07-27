import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { InfrastructureError } from "@/core/errors";
import type { ServiceContext } from "@/core/application/context";

/**
 * JobAdminService — operações manuais de DLQ (base da futura tela
 * Configurações → Jobs: Reprocessar · Ignorar · Ver erro). Gate `jobs.manage`.
 */
export class JobAdminService {
  constructor(
    private readonly db: SupabaseClient<Database>,
    private readonly ctx: ServiceContext,
  ) {}

  async listDeadLetters() {
    const { data, error } = await this.db
      .from("job_dead_letter")
      .select("id, type, last_error, attempts, failed_at")
      .eq("organization_id", this.ctx.organizationId)
      .order("failed_at", { ascending: false });
    if (error) throw new InfrastructureError(error.message, { cause: error });
    return data ?? [];
  }

  async retry(deadLetterId: string): Promise<string> {
    const { data, error } = await this.db.rpc("retry_dead_letter", { p_id: deadLetterId });
    if (error) throw new InfrastructureError(error.message, { cause: error });
    return data as string;
  }

  async discard(deadLetterId: string): Promise<void> {
    const { error } = await this.db.rpc("discard_dead_letter", { p_id: deadLetterId });
    if (error) throw new InfrastructureError(error.message, { cause: error });
  }
}
