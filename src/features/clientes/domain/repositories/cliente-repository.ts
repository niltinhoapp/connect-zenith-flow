import type { Repository } from "@/core/domain";
import type { Cliente } from "../entities/cliente";

export interface ClienteFilter {
  status?: string;
  search?: string;
}

/**
 * Contrato de persistência de Cliente. TODO acesso ao banco passa por aqui.
 * A implementação Supabase (infra) é registrada na F2; o domínio depende só
 * desta interface.
 */
export interface ClienteRepository extends Repository<Cliente> {
  findMany(filter?: ClienteFilter): Promise<Cliente[]>;
}
