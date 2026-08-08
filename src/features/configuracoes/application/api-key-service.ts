import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";
import type { ServiceContext } from "@/core/application/context";
import { guard } from "@/core/application/guard";
import { InfrastructureError } from "@/core/errors";
import { createApiKeySchema, type CreateApiKeyInput } from "@/features/configuracoes/schema";

export interface ApiKeyView {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  expiresAt: string | null;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export interface CreatedApiKey {
  id: string;
  secret: string;
  prefix: string;
}

function objectValue(value: Json): Record<string, Json | undefined> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new InfrastructureError("Resposta inválida ao criar a chave.");
  }
  return value;
}

export class ApiKeyApplicationService {
  constructor(
    private readonly db: SupabaseClient<Database>,
    private readonly ctx: ServiceContext,
  ) {}

  list(): Promise<ApiKeyView[]> {
    return guard(async () => {
      const { data, error } = await this.db
        .from("api_keys")
        .select("id, name, key_prefix, scopes, expires_at, last_used_at, revoked_at, created_at")
        .eq("organization_id", this.ctx.organizationId)
        .order("created_at", { ascending: false });
      if (error) throw new InfrastructureError(error.message, { cause: error });
      return (data ?? []).map((item) => ({
        id: item.id,
        name: item.name,
        prefix: item.key_prefix,
        scopes: item.scopes,
        expiresAt: item.expires_at,
        lastUsedAt: item.last_used_at,
        revokedAt: item.revoked_at,
        createdAt: item.created_at,
      }));
    }, { service: "api-keys.list" });
  }

  async listScopes(): Promise<Array<{ key: string; description: string }>> {
    return guard(async () => {
      const { data, error } = await this.db.from("api_scopes").select("key, description").order("key");
      if (error) throw new InfrastructureError(error.message, { cause: error });
      return data ?? [];
    }, { service: "api-keys.scopes" });
  }

  create(input: CreateApiKeyInput): Promise<CreatedApiKey> {
    return guard(async () => {
      const values = createApiKeySchema.parse(input);
      const { data, error } = await this.db.rpc("api_key_create", {
        p_org: this.ctx.organizationId,
        p_name: values.name,
        p_scopes: values.scopes,
        p_expires_at: values.expiresAt,
      });
      if (error) throw new InfrastructureError(error.message, { cause: error });
      const result = objectValue(data);
      if (typeof result.id !== "string" || typeof result.secret !== "string" || typeof result.prefix !== "string") {
        throw new InfrastructureError("A chave não foi retornada corretamente.");
      }
      return { id: result.id, secret: result.secret, prefix: result.prefix };
    }, { service: "api-keys.create" });
  }

  revoke(id: string): Promise<void> {
    return guard(async () => {
      const { error } = await this.db.rpc("api_key_revoke", { p_org: this.ctx.organizationId, p_id: id });
      if (error) throw new InfrastructureError(error.message, { cause: error });
    }, { service: "api-keys.revoke" });
  }
}
