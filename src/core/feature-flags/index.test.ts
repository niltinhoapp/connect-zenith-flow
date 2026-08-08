import { describe, expect, it } from "vitest";
import { assertModuleEnabled, isModuleEnabled } from "@/core/feature-flags";

describe("feature flags", () => {
  it("mantém módulos essenciais disponíveis mesmo fora da lista da organização", () => {
    expect(isModuleEnabled([], "dashboard")).toBe(true);
    expect(isModuleEnabled(["crm"], "configuracoes")).toBe(true);
    expect(isModuleEnabled([], "billing")).toBe(true);
  });

  it("continua exigindo ativação para módulos opcionais", () => {
    expect(isModuleEnabled([], "whatsapp")).toBe(false);
    expect(isModuleEnabled(["whatsapp"], "whatsapp")).toBe(true);
    expect(isModuleEnabled(["*"], "automacoes")).toBe(true);
  });

  it("rejeita um módulo opcional desativado", () => {
    expect(() => assertModuleEnabled([], "crm")).toThrow(
      'O módulo "crm" não está habilitado para esta organização.',
    );
  });
});
