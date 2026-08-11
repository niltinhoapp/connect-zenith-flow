import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { guard } from "@/core/application/guard";
import { assertModuleEnabled } from "@/core/feature-flags";
import { InfrastructureError } from "@/core/errors";
import type { ServiceContext } from "@/core/application/context";

export interface RoleView {
  id: string;
  key: string;
  name: string;
  description: string;
  isSystem: boolean;
  permissionKeys: string[];
}
export interface PermissionView {
  key: string;
  module: string;
  description: string;
}

/**
 * RolesApplicationService — leitura e criação de papéis (RBAC). Usa a
 * infraestrutura já criada (roles / permissions / role_permissions + RPC
 * create_role). Toda leitura passa pela RLS (papéis de sistema + da org).
 */
export class RolesApplicationService {
  constructor(
    private readonly db: SupabaseClient<Database>,
    private readonly ctx: ServiceContext,
  ) {}

  async listRoles(): Promise<RoleView[]> {
    return guard(
      async () => {
        assertModuleEnabled(this.ctx.enabledModules, "configuracoes");
        const [{ data: roles, error: rErr }, { data: rp }, { data: perms }] = await Promise.all([
          this.db
            .from("roles")
            .select("id, key, name, description, is_system")
            .is("deleted_at", null),
          this.db.from("role_permissions").select("role_id, permission_id"),
          this.db.from("permissions").select("id, key"),
        ]);
        if (rErr) throw new InfrastructureError(rErr.message, { cause: rErr });

        const permKeyById = new Map((perms ?? []).map((p) => [p.id, p.key]));
        const keysByRole = new Map<string, string[]>();
        for (const link of rp ?? []) {
          const key = permKeyById.get(link.permission_id);
          if (!key) continue;
          const arr = keysByRole.get(link.role_id) ?? [];
          arr.push(key);
          keysByRole.set(link.role_id, arr);
        }

        return (roles ?? []).map((r) => ({
          id: r.id,
          key: r.key,
          name: r.name,
          description: r.description,
          isSystem: r.is_system,
          permissionKeys: keysByRole.get(r.id) ?? [],
        }));
      },
      { service: "roles.list" },
    );
  }

  listPermissions(): Promise<PermissionView[]> {
    return guard(
      async () => {
        assertModuleEnabled(this.ctx.enabledModules, "configuracoes");
        const { data, error } = await this.db
          .from("permissions")
          .select("key, module, description")
          .order("module");
        if (error) throw new InfrastructureError(error.message, { cause: error });
        return data ?? [];
      },
      { service: "permissions.list" },
    );
  }

  createRole(name: string, permissionKeys: string[]): Promise<void> {
    return guard(
      async () => {
        assertModuleEnabled(this.ctx.enabledModules, "configuracoes");
        const { error } = await this.db.rpc("create_role", {
          p_org: this.ctx.organizationId,
          p_name: name,
          p_permission_keys: permissionKeys,
        });
        if (error) throw new InfrastructureError(error.message, { cause: error });
      },
      { service: "roles.create" },
    );
  }
}
