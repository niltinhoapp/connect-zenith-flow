import type { Repository, Paginated } from "@/core/domain";
import type { Customer } from "../entities/customer";

export type { Paginated };

export interface CustomerFilter {
  status?: string;
  search?: string;
  ownerId?: string;
  limit?: number;
  offset?: number;
}

/**
 * Persistência de Customer (persist-only). Não publica eventos, não chama
 * providers, não executa regras — isso é da camada de aplicação. Suporta
 * paginação/filtros no banco (evita N+1 e over-fetch).
 */
export interface CustomerRepository extends Repository<Customer> {
  findMany(filter?: CustomerFilter): Promise<Paginated<Customer>>;
}
