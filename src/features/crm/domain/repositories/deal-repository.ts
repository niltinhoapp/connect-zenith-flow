import type { Repository, Paginated } from "@/core/domain";
import type { Deal } from "../entities/deal";

export interface DealFilter {
  pipelineId?: string;
  stageId?: string;
  customerId?: string;
  limit?: number;
  offset?: number;
}

/** Persistência de Deal (persist-only). */
export interface DealRepository extends Repository<Deal> {
  findMany(filter?: DealFilter): Promise<Paginated<Deal>>;
}
