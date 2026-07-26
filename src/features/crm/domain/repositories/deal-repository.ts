import type { Repository } from "@/core/domain";
import type { Deal } from "../entities/deal";

export interface DealFilter {
  stage?: string;
  clienteId?: string;
}

/** Contrato de persistência de Deal. Implementação Supabase na F2. */
export interface DealRepository extends Repository<Deal> {
  findMany(filter?: DealFilter): Promise<Deal[]>;
}
