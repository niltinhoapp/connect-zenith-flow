import type { Repository, Paginated } from "@/core/domain";
import type { Lead } from "../entities/lead";

export interface LeadFilter {
  status?: string;
  search?: string;
  ownerId?: string;
  limit?: number;
  offset?: number;
}

/**
 * Persistência de Lead (persist-only). `convert` chama a RPC transacional do
 * banco (cria o Customer + timeline + auditoria) — a orquestração de evento
 * fica na camada de aplicação.
 */
export interface LeadRepository extends Repository<Lead> {
  findMany(filter?: LeadFilter): Promise<Paginated<Lead>>;
  /** Converte o lead em customer (RPC). Retorna o id do customer criado. */
  convert(leadId: string): Promise<string>;
}
