import { createServerFn } from "@tanstack/react-start";
import { getSupabaseServerClient } from "@/server/supabase";

/**
 * Sessão autenticada (Core).
 *
 * `fetchSession` roda no servidor (createServerFn), lê a sessão dos cookies e
 * monta o contexto de auth consumido por toda a aplicação: perfil real,
 * organizações do usuário, organização ativa e permissões efetivas.
 *
 * A organização ativa e as permissões vêm daqui — nunca de input do cliente.
 */

export type SessionMembership = {
  organizationId: string;
  organizationName: string;
  roleId: string;
  roleKey: string;
  roleName: string;
};

export type AuthSession = {
  user: { id: string; email: string };
  profile: { id: string; fullName: string; email: string; avatarUrl: string | null };
  memberships: SessionMembership[];
  activeOrganization: SessionMembership | null;
  /** Chaves de permissão efetivas na organização ativa. */
  permissions: string[];
  /** Módulos habilitados na organização ativa (feature flags). */
  enabledModules: string[];
};

export const fetchSession = createServerFn({ method: "GET" }).handler(
  async (): Promise<AuthSession | null> => {
    const supabase = getSupabaseServerClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, full_name, email, avatar_url, active_organization_id")
      .eq("id", user.id)
      .maybeSingle();

    const { data: memberRows } = await supabase
      .from("organization_members")
      .select("organization_id, role_id")
      .eq("user_id", user.id)
      .is("deleted_at", null);

    const members = memberRows ?? [];
    const orgIds = members.map((m) => m.organization_id);
    const roleIds = members.map((m) => m.role_id);

    const [{ data: orgs }, { data: roles }] = await Promise.all([
      orgIds.length
        ? supabase.from("organizations").select("id, name, enabled_modules").in("id", orgIds)
        : Promise.resolve({ data: [] as { id: string; name: string; enabled_modules: string[] }[] }),
      roleIds.length
        ? supabase.from("roles").select("id, key, name").in("id", roleIds)
        : Promise.resolve({ data: [] as { id: string; key: string; name: string }[] }),
    ]);

    const orgById = new Map((orgs ?? []).map((o) => [o.id, o]));
    const roleById = new Map((roles ?? []).map((r) => [r.id, r]));

    const memberships: SessionMembership[] = members.map((m) => {
      const org = orgById.get(m.organization_id);
      const role = roleById.get(m.role_id);
      return {
        organizationId: m.organization_id,
        organizationName: org?.name ?? "—",
        roleId: m.role_id,
        roleKey: role?.key ?? "member",
        roleName: role?.name ?? "Membro",
      };
    });

    const activeId =
      profile?.active_organization_id && orgIds.includes(profile.active_organization_id)
        ? profile.active_organization_id
        : (orgIds[0] ?? null);

    const activeOrganization =
      memberships.find((m) => m.organizationId === activeId) ?? null;

    const enabledModules = (activeId && orgById.get(activeId)?.enabled_modules) || [];

    let permissions: string[] = [];
    if (activeOrganization) {
      const { data: rolePerms } = await supabase
        .from("role_permissions")
        .select("permission_id")
        .eq("role_id", activeOrganization.roleId);
      const permIds = (rolePerms ?? []).map((rp) => rp.permission_id);
      if (permIds.length) {
        const { data: permRows } = await supabase
          .from("permissions")
          .select("key")
          .in("id", permIds);
        permissions = (permRows ?? []).map((p) => p.key);
      }
    }

    return {
      user: { id: user.id, email: user.email ?? "" },
      profile: {
        id: user.id,
        fullName: profile?.full_name ?? "",
        email: profile?.email ?? user.email ?? "",
        avatarUrl: profile?.avatar_url ?? null,
      },
      memberships,
      activeOrganization,
      permissions,
      enabledModules,
    };
  },
);
