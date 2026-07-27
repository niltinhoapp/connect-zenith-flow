import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";
import type { Paginated } from "@/core/domain";
import { InfrastructureError } from "@/core/errors";
import { Deal } from "../domain/entities/deal";
import type { DealFilter, DealRepository } from "../domain/repositories/deal-repository";

type Row = Database["public"]["Tables"]["deals"]["Row"];

export function rowToDeal(row: Row): Deal {
  return Deal.fromPersistence({
    id: row.id,
    organizationId: row.organization_id,
    code: row.code,
    customerId: row.customer_id,
    pipelineId: row.pipeline_id,
    stageId: row.stage_id,
    title: row.title,
    amount: row.amount,
    currency: row.currency,
    ownerId: row.owner_id,
    source: row.source,
    notes: row.notes,
    tags: row.tags,
    customFields: (row.custom_fields ?? {}) as Record<string, unknown>,
    expectedCloseDate: row.expected_close_date,
    closedAt: row.closed_at,
    wonAt: row.won_at,
    lostAt: row.lost_at,
    lossReason: row.loss_reason,
    winReason: row.win_reason,
    probabilityOverride: row.probability_override,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  });
}

/** Repositório Supabase de Deal (persist-only), com paginação/filtros no banco. */
export class DealSupabaseRepository implements DealRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async findById(id: string): Promise<Deal | null> {
    const { data, error } = await this.db
      .from("deals")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw new InfrastructureError(error.message, { cause: error });
    return data ? rowToDeal(data) : null;
  }

  async list(): Promise<Deal[]> {
    return (await this.findMany()).items;
  }

  async findMany(filter: DealFilter = {}): Promise<Paginated<Deal>> {
    const limit = filter.limit ?? 100;
    const offset = filter.offset ?? 0;
    let q = this.db.from("deals").select("*", { count: "exact" }).is("deleted_at", null);
    if (filter.pipelineId) q = q.eq("pipeline_id", filter.pipelineId);
    if (filter.stageId) q = q.eq("stage_id", filter.stageId);
    if (filter.customerId) q = q.eq("customer_id", filter.customerId);
    const { data, error, count } = await q
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw new InfrastructureError(error.message, { cause: error });
    return { items: (data ?? []).map(rowToDeal), total: count ?? 0 };
  }

  async create(deal: Deal): Promise<Deal> {
    const p = deal.toJSON();
    const { data, error } = await this.db
      .from("deals")
      .insert({
        organization_id: p.organizationId,
        customer_id: p.customerId,
        pipeline_id: p.pipelineId,
        stage_id: p.stageId,
        title: p.title,
        amount: p.amount,
        currency: p.currency,
        owner_id: p.ownerId,
        source: p.source,
        notes: p.notes,
        tags: p.tags,
        custom_fields: p.customFields as Json,
        expected_close_date: p.expectedCloseDate,
      })
      .select("*")
      .single();
    if (error) throw new InfrastructureError(error.message, { cause: error });
    return rowToDeal(data);
  }

  async update(deal: Deal): Promise<Deal> {
    const p = deal.toJSON();
    const { data, error } = await this.db
      .from("deals")
      .update({
        customer_id: p.customerId,
        stage_id: p.stageId,
        title: p.title,
        amount: p.amount,
        currency: p.currency,
        owner_id: p.ownerId,
        notes: p.notes,
        tags: p.tags,
        custom_fields: p.customFields as Json,
        expected_close_date: p.expectedCloseDate,
        closed_at: p.closedAt,
        won_at: p.wonAt,
        lost_at: p.lostAt,
        loss_reason: p.lossReason,
        win_reason: p.winReason,
        probability_override: p.probabilityOverride,
      })
      .eq("id", p.id)
      .select("*")
      .single();
    if (error) throw new InfrastructureError(error.message, { cause: error });
    return rowToDeal(data);
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.db
      .from("deals")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw new InfrastructureError(error.message, { cause: error });
  }
}
