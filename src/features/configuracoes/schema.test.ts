import { describe, expect, it } from "vitest";
import { createApiKeySchema } from "@/features/configuracoes/schema";

describe("createApiKeySchema", () => {
  it("aceita nome, escopos e expiração futura em ISO", () => {
    const result = createApiKeySchema.safeParse({
      name: "Integração ERP",
      scopes: ["customers:read"],
      expiresAt: "2030-01-01T00:00:00.000Z",
    });
    expect(result.success).toBe(true);
  });

  it("aceita chave sem expiração", () => {
    expect(createApiKeySchema.safeParse({ name: "ERP", scopes: ["deals:read"], expiresAt: null }).success).toBe(true);
  });

  it("rejeita chave sem escopo e nome vazio", () => {
    const result = createApiKeySchema.safeParse({ name: " ", scopes: [], expiresAt: null });
    expect(result.success).toBe(false);
  });
});
