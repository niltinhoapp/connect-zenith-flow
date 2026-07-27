import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { InfrastructureError, NotFoundError } from "@/core/errors";
import type { ServiceContext } from "@/core/application/context";

export interface ModuleView {
  id: string;
  key: string;
  name: string;
  category: string;
  isCore: boolean;
  enabled: boolean;
}

/**
 * Core · Modules — catálogo de módulos e ativação por organização.
 * Fonte da verdade do que a empresa contratou (`organization_modules`).
 */
export class ModuleRegistryService {
  constructor(
    private readonly db: SupabaseClient<Database>,
    private readonly ctx: ServiceContext,
  ) {}

  async orgModules(): Promise<ModuleView[]> {
    const [{ data: mods, error: e1 }, { data: orgMods, error: e2 }] = await Promise.all([
      this.db.from("modules").select("id, key, name, category, is_core, position").order("position"),
      this.db.from("organization_modules").select("module_id, enabled").eq("organization_id", this.ctx.organizationId),
    ]);
    if (e1) throw new InfrastructureError(e1.message, { cause: e1 });
    if (e2) throw new InfrastructureError(e2.message, { cause: e2 });
    const enabledById = new Map((orgMods ?? []).map((o) => [o.module_id, o.enabled]));
    return (mods ?? []).map((m) => ({
      id: m.id,
      key: m.key,
      name: m.name,
      category: m.category,
      isCore: m.is_core,
      enabled: m.is_core || (enabledById.get(m.id) ?? false),
    }));
  }

  async isEnabled(key: string): Promise<boolean> {
    const { data, error } = await this.db.rpc("has_module", { p_org: this.ctx.organizationId, p_key: key });
    if (error) throw new InfrastructureError(error.message, { cause: error });
    return data ?? false;
  }

  async setEnabled(moduleKey: string, enabled: boolean): Promise<void> {
    const { data: mod, error: me } = await this.db.from("modules").select("id").eq("key", moduleKey).maybeSingle();
    if (me) throw new InfrastructureError(me.message, { cause: me });
    if (!mod) throw new NotFoundError("Módulo não encontrado");
    const { error } = await this.db
      .from("organization_modules")
      .upsert(
        { organization_id: this.ctx.organizationId, module_id: mod.id, enabled },
        { onConflict: "organization_id,module_id" },
      );
    if (error) throw new InfrastructureError(error.message, { cause: error });
  }
}
