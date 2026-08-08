import { describe, it, expect } from "vitest";
import { can, PERMISSIONS } from "@/core/permissions";
// `import type` garante que a camada server (session.server) NÃO seja carregada
// em runtime pelo teste — apenas o tipo é usado.
import type { AuthSession } from "@/core/auth/session.server";

const session: AuthSession = {
  user: { id: "u", email: "e@x.com" },
  profile: { id: "u", fullName: "Fulano", email: "e@x.com", avatarUrl: null },
  memberships: [],
  activeOrganization: {
    organizationId: "o",
    organizationName: "Org",
    roleId: "r",
    roleKey: "member",
    roleName: "Membro",
  },
  permissions: [PERMISSIONS.CRM_READ, PERMISSIONS.CLIENTES_WRITE],
  enabledModules: ["*"],
  mfaRequired: false,
};

describe("Core · RBAC · can()", () => {
  it("true quando a permissão está presente", () => {
    expect(can(session, PERMISSIONS.CRM_READ)).toBe(true);
    expect(can(session, PERMISSIONS.CLIENTES_WRITE)).toBe(true);
  });

  it("false quando a permissão está ausente", () => {
    expect(can(session, PERMISSIONS.ORG_DELETE)).toBe(false);
  });

  it("false para sessão nula", () => {
    expect(can(null, PERMISSIONS.CRM_READ)).toBe(false);
  });
});
