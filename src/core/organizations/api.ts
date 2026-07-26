import { getSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Core · Organizations — operações de organização (browser).
 */

/** Troca a organização ativa do usuário (multi-org). */
export async function setActiveOrganization(organizationId: string) {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.rpc("set_active_organization", {
    p_org: organizationId,
  });
  if (error) throw error;
}
