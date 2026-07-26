import { PermissionError } from "@/core/errors";

/**
 * Core · Feature Flags — módulos habilitados por organização.
 *
 * Os Application Services consultam isto antes de executar uma funcionalidade,
 * respeitando `Organization.enabledModules` (e, no futuro, o plano). `"*"`
 * habilita tudo (Enterprise).
 */
export function isModuleEnabled(enabledModules: readonly string[], moduleKey: string): boolean {
  return enabledModules.includes("*") || enabledModules.includes(moduleKey);
}

/** Garante que o módulo esteja habilitado; senão lança PermissionError. */
export function assertModuleEnabled(enabledModules: readonly string[], moduleKey: string): void {
  if (!isModuleEnabled(enabledModules, moduleKey)) {
    throw new PermissionError(`O módulo "${moduleKey}" não está habilitado para esta organização.`);
  }
}
