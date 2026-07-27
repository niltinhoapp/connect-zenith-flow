import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { ConflictError, InfrastructureError } from "@/core/errors";

export type QuotaResource = "customers" | "messages" | "ai_credits" | "storage_bytes" | "api_calls";

/** Regra pura de limite (testável): -1 = ilimitado. */
export function isWithinLimit(used: number, limit: number, amount = 1): boolean {
  if (limit < 0) return true;
  return used + amount <= limit;
}

/**
 * QuotaService — ÚNICA fonte de enforcement de limites. Nenhum módulo valida
 * cota individualmente: chama `ensure`/`check` antes e `consume` depois.
 */
export class QuotaService {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async check(organizationId: string, resource: QuotaResource, amount = 1): Promise<boolean> {
    const { data, error } = await this.db.rpc("check_quota", {
      p_org: organizationId,
      p_resource: resource,
      p_amount: amount,
    });
    if (error) throw new InfrastructureError(error.message, { cause: error });
    return data ?? false;
  }

  async ensure(organizationId: string, resource: QuotaResource, amount = 1): Promise<void> {
    if (!(await this.check(organizationId, resource, amount))) {
      throw new ConflictError(`Limite do plano atingido para "${resource}".`);
    }
  }

  async consume(organizationId: string, resource: QuotaResource, amount = 1): Promise<void> {
    const { error } = await this.db.rpc("consume_quota", {
      p_org: organizationId,
      p_resource: resource,
      p_amount: amount,
    });
    if (error) throw new InfrastructureError(error.message, { cause: error });
  }

  /** Consumo ATÔMICO (verifica + incrementa numa transação). Retorna se coube. */
  async tryConsume(organizationId: string, resource: QuotaResource, amount = 1): Promise<boolean> {
    const { data, error } = await this.db.rpc("try_consume_quota", {
      p_org: organizationId,
      p_resource: resource,
      p_amount: amount,
    });
    if (error) throw new InfrastructureError(error.message, { cause: error });
    return data ?? false;
  }

  /** Consome atomicamente ou lança ConflictError se estourar o limite. */
  async ensureAndConsume(organizationId: string, resource: QuotaResource, amount = 1): Promise<void> {
    if (!(await this.tryConsume(organizationId, resource, amount))) {
      throw new ConflictError(`Limite do plano atingido para "${resource}".`);
    }
  }
}
