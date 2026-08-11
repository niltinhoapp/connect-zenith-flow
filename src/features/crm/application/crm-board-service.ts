import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { guard } from "@/core/application/guard";
import { assertModuleEnabled } from "@/core/feature-flags";
import { InfrastructureError } from "@/core/errors";
import type { ServiceContext } from "@/core/application/context";
import type { StageType } from "../domain/entities/deal";

export interface BoardStage {
  id: string;
  name: string;
  type: StageType;
}
export interface BoardDeal {
  id: string;
  title: string;
  amount: number;
  currency: string;
  stageId: string;
  customerName: string;
  ownerName: string;
  tags: string[];
  createdAt: string;
}
export interface CrmBoard {
  pipelineId: string | null;
  stages: BoardStage[];
  deals: BoardDeal[];
}

/**
 * Read model do Kanban de CRM. Agrega estágios + deals do pipeline padrão e
 * resolve nomes de cliente/dono em consultas em lote (sem N+1). Só leitura.
 */
export class CrmBoardService {
  constructor(
    private readonly db: SupabaseClient<Database>,
    private readonly ctx: ServiceContext,
  ) {}

  getBoard(): Promise<CrmBoard> {
    return guard(
      async () => {
        assertModuleEnabled(this.ctx.enabledModules, "crm");

        const { data: pipelines, error: pErr } = await this.db
          .from("pipelines")
          .select("id")
          .eq("is_default", true)
          .is("deleted_at", null)
          .limit(1);
        if (pErr) throw new InfrastructureError(pErr.message, { cause: pErr });
        const pipelineId = pipelines?.[0]?.id ?? null;
        if (!pipelineId) return { pipelineId: null, stages: [], deals: [] };

        const [{ data: stages, error: sErr }, { data: deals, error: dErr }] = await Promise.all([
          this.db
            .from("pipeline_stages")
            .select("id, name, type, position")
            .eq("pipeline_id", pipelineId)
            .is("deleted_at", null)
            .order("position", { ascending: true }),
          this.db
            .from("deals")
            .select(
              "id, title, amount, currency, stage_id, customer_id, owner_id, tags, created_at",
            )
            .eq("pipeline_id", pipelineId)
            .is("deleted_at", null)
            .order("created_at", { ascending: false })
            .limit(200),
        ]);
        if (sErr) throw new InfrastructureError(sErr.message, { cause: sErr });
        if (dErr) throw new InfrastructureError(dErr.message, { cause: dErr });

        const dealRows = deals ?? [];
        const customerIds = [
          ...new Set(dealRows.map((d) => d.customer_id).filter((v): v is string => Boolean(v))),
        ];
        const ownerIds = [
          ...new Set(dealRows.map((d) => d.owner_id).filter((v): v is string => Boolean(v))),
        ];

        const [{ data: customers }, { data: profiles }] = await Promise.all([
          customerIds.length
            ? this.db
                .from("customers")
                .select("id, first_name, last_name, company_name, type")
                .in("id", customerIds)
            : Promise.resolve({
                data: [] as {
                  id: string;
                  first_name: string | null;
                  last_name: string | null;
                  company_name: string | null;
                  type: string;
                }[],
              }),
          ownerIds.length
            ? this.db.from("profiles").select("id, full_name").in("id", ownerIds)
            : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
        ]);

        const custName = new Map(
          (customers ?? []).map((c) => [
            c.id,
            c.type === "company"
              ? (c.company_name ?? "—")
              : [c.first_name, c.last_name].filter(Boolean).join(" ") || "—",
          ]),
        );
        const ownerName = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

        return {
          pipelineId,
          stages: (stages ?? []).map((s) => ({ id: s.id, name: s.name, type: s.type })),
          deals: dealRows.map((d) => ({
            id: d.id,
            title: d.title,
            amount: d.amount,
            currency: d.currency,
            stageId: d.stage_id,
            customerName: (d.customer_id && custName.get(d.customer_id)) || "—",
            ownerName: (d.owner_id && ownerName.get(d.owner_id)) || "",
            tags: d.tags,
            createdAt: d.created_at,
          })),
        };
      },
      { service: "crm.board" },
    );
  }
}
