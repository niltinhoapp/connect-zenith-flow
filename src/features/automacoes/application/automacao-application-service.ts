import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";
import { guard } from "@/core/application/guard";
import { assertModuleEnabled } from "@/core/feature-flags";
import { InfrastructureError } from "@/core/errors";
import type { ServiceContext } from "@/core/application/context";
import type { FlowEdge, FlowNode } from "../domain/engine";
import { normalizeAiFlow } from "../domain/ai-flow";

export type AutomationRow = Database["public"]["Tables"]["automations"]["Row"];
export type AutomationRunRow = Database["public"]["Tables"]["automation_runs"]["Row"];
export type AutomationRunStepRow = Database["public"]["Tables"]["automation_run_steps"]["Row"];

export interface FlowGraphInput {
  nodes: Array<FlowNode & { position?: Record<string, unknown> }>;
  edges: FlowEdge[];
}

export interface SaveAutomationInput {
  id?: string | null;
  name: string;
  description?: string | null;
  triggerType: string;
  triggerConfig?: Record<string, unknown>;
  graph: FlowGraphInput;
}

/**
 * AutomacaoApplicationService — CRUD + versionamento + execução de fluxos.
 * Não executa efeitos: `save` persiste o grafo (snapshot por versão via RPC);
 * `startRun` cria a run e enfileira `automation.run` (o worker interpreta o
 * grafo e dispara as ações via Providers/RPCs). Gatilhos de evento chegam
 * sozinhos pelo Event Bus (relay → automation_dispatch_event).
 */
export class AutomacaoApplicationService {
  constructor(
    private readonly db: SupabaseClient<Database>,
    private readonly ctx: ServiceContext,
  ) {}

  private ensureEnabled() {
    assertModuleEnabled(this.ctx.enabledModules, "automacoes");
  }

  /** Carrega o header + o grafo (nós/arestas) da versão atual. */
  getGraph(id: string): Promise<{
    automation: AutomationRow;
    nodes: Array<{ node_key: string; type: string; config: Json; position: Json }>;
    edges: Array<{ from_node: string; to_node: string; branch: "yes" | "no" | null }>;
  } | null> {
    return guard(
      async () => {
        this.ensureEnabled();
        const { data: automation, error: aErr } = await this.db
          .from("automations")
          .select("*")
          .eq("id", id)
          .is("deleted_at", null)
          .maybeSingle();
        if (aErr) throw new InfrastructureError(aErr.message, { cause: aErr });
        if (!automation) return null;
        const v = automation.current_version;
        const [{ data: nodes, error: nErr }, { data: edges, error: eErr }] = await Promise.all([
          this.db.from("automation_nodes").select("node_key,type,config,position")
            .eq("automation_id", id).eq("version", v),
          this.db.from("automation_edges").select("from_node,to_node,branch")
            .eq("automation_id", id).eq("version", v),
        ]);
        if (nErr) throw new InfrastructureError(nErr.message, { cause: nErr });
        if (eErr) throw new InfrastructureError(eErr.message, { cause: eErr });
        return { automation, nodes: nodes ?? [], edges: edges ?? [] };
      },
      { service: "automacoes.getGraph", id },
    );
  }

  list(): Promise<AutomationRow[]> {
    return guard(
      async () => {
        this.ensureEnabled();
        const { data, error } = await this.db
          .from("automations")
          .select("*")
          .is("deleted_at", null)
          .order("updated_at", { ascending: false });
        if (error) throw new InfrastructureError(error.message, { cause: error });
        return data ?? [];
      },
      { service: "automacoes.list" },
    );
  }

  save(input: SaveAutomationInput): Promise<{ id: string; version: number }> {
    return guard(
      async () => {
        this.ensureEnabled();
        const { data, error } = await this.db.rpc("automation_save", {
          p_org: this.ctx.organizationId,
          p_id: input.id ?? null,
          p_name: input.name,
          p_description: input.description ?? null,
          p_trigger_type: input.triggerType,
          p_trigger_config: (input.triggerConfig ?? {}) as Json,
          p_graph: input.graph as unknown as Json,
        });
        if (error) throw new InfrastructureError(error.message, { cause: error });
        return data as unknown as { id: string; version: number };
      },
      { service: "automacoes.save" },
    );
  }

  /**
   * AI Copilot: gera um fluxo a partir de uma descrição, normaliza a saída da
   * IA (não-confiável) e salva como RASCUNHO para revisão humana no builder.
   * A chave da IA fica na Edge Function (secret); o cliente nunca a vê.
   */
  generateAndSaveFlow(description: string): Promise<{ id: string; name: string }> {
    return guard(
      async () => {
        this.ensureEnabled();
        const { data, error } = await this.db.functions.invoke("ai-generate-flow", {
          body: { description, organizationId: this.ctx.organizationId },
        });
        if (error) {
          // tenta extrair a mensagem real do corpo da Edge Function
          let msg = error.message;
          try {
            const ctx = (error as { context?: Response }).context;
            if (ctx && typeof ctx.json === "function") msg = (await ctx.json())?.error ?? msg;
          } catch { /* ignore */ }
          throw new InfrastructureError(msg, { cause: error });
        }
        const flow = (data as { flow?: unknown })?.flow;
        const normalized = normalizeAiFlow(flow ?? {});
        const { data: saved, error: sErr } = await this.db.rpc("automation_save", {
          p_org: this.ctx.organizationId,
          p_id: null,
          p_name: normalized.name,
          p_description: normalized.description,
          p_trigger_type: normalized.triggerType,
          p_trigger_config: {} as Json,
          p_graph: normalized.graph as unknown as Json,
        });
        if (sErr) throw new InfrastructureError(sErr.message, { cause: sErr });
        const res = saved as unknown as { id: string };
        return { id: res.id, name: normalized.name };
      },
      { service: "automacoes.generateAndSaveFlow" },
    );
  }

  setStatus(id: string, status: "draft" | "active" | "paused"): Promise<void> {
    return guard(
      async () => {
        this.ensureEnabled();
        const { error } = await this.db.rpc("automation_set_status", {
          p_org: this.ctx.organizationId,
          p_id: id,
          p_status: status,
        });
        if (error) throw new InfrastructureError(error.message, { cause: error });
      },
      { service: "automacoes.setStatus", id },
    );
  }

  duplicate(id: string): Promise<string> {
    return guard(
      async () => {
        this.ensureEnabled();
        const { data, error } = await this.db.rpc("automation_duplicate", {
          p_org: this.ctx.organizationId,
          p_id: id,
        });
        if (error) throw new InfrastructureError(error.message, { cause: error });
        return data as string;
      },
      { service: "automacoes.duplicate", id },
    );
  }

  remove(id: string): Promise<void> {
    return guard(
      async () => {
        this.ensureEnabled();
        const { error } = await this.db.rpc("automation_delete", {
          p_org: this.ctx.organizationId,
          p_id: id,
        });
        if (error) throw new InfrastructureError(error.message, { cause: error });
      },
      { service: "automacoes.remove", id },
    );
  }

  /** Dispara uma execução manual/teste do fluxo com um contexto opcional. */
  startRun(id: string, context?: Record<string, unknown>): Promise<string> {
    return guard(
      async () => {
        this.ensureEnabled();
        const { data, error } = await this.db.rpc("automation_start_run", {
          p_org: this.ctx.organizationId,
          p_automation_id: id,
          p_trigger_event: "manual",
          p_context: (context ?? {}) as Json,
          p_idempotency: `test:${id}:${Date.now()}`,
        });
        if (error) throw new InfrastructureError(error.message, { cause: error });
        return data as string;
      },
      { service: "automacoes.startRun", id },
    );
  }

  listRuns(automationId: string): Promise<AutomationRunRow[]> {
    return guard(
      async () => {
        this.ensureEnabled();
        const { data, error } = await this.db
          .from("automation_runs")
          .select("*")
          .eq("automation_id", automationId)
          .order("created_at", { ascending: false })
          .limit(50);
        if (error) throw new InfrastructureError(error.message, { cause: error });
        return data ?? [];
      },
      { service: "automacoes.listRuns", id: automationId },
    );
  }

  listRunSteps(runId: string): Promise<AutomationRunStepRow[]> {
    return guard(
      async () => {
        this.ensureEnabled();
        const { data, error } = await this.db
          .from("automation_run_steps")
          .select("*")
          .eq("run_id", runId)
          .order("occurred_at", { ascending: true });
        if (error) throw new InfrastructureError(error.message, { cause: error });
        return data ?? [];
      },
      { service: "automacoes.listRunSteps", id: runId },
    );
  }
}
