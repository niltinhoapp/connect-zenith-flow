import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { SignupInput } from "@/core/auth/schema";
import { eventBus } from "@/core/events";

/**
 * API de autenticação (browser). Consome apenas o cliente Supabase do browser.
 * Serviço do Core — módulos de negócio devem usar estas funções, nunca falar
 * com o Supabase Auth diretamente.
 */

export async function signIn(input: { email: string; password: string }) {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.auth.signInWithPassword(input);
  if (error) throw error;
  const { error: workspaceError } = await supabase.rpc("ensure_user_workspace", {
    p_company_name: null,
  });
  if (workspaceError) throw workspaceError;
}

/**
 * Cadastro + provisionamento automático (org + Owner + workspace inicial).
 * Requer confirmação de e-mail DESLIGADA (decisão da F1): a sessão já existe
 * ao final do signUp, permitindo chamar a RPC de provisionamento.
 */
export async function signUpWithOrganization(input: SignupInput) {
  const supabase = getSupabaseBrowserClient();
  const fullName = `${input.firstName} ${input.lastName}`.trim();

  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: { data: { full_name: fullName, company_name: input.companyName } },
  });
  if (error) throw error;

  if (!data.session) {
    // Confirmação de e-mail ativa: provisionamento acontece no 1º login.
    throw new Error("Confirme seu e-mail para concluir o cadastro.");
  }

  const { data: org, error: rpcError } = await supabase.rpc("ensure_user_workspace", {
    p_company_name: input.companyName,
  });
  if (rpcError) throw rpcError;

  // Comunicação entre módulos via Event Bus (nunca chamada direta).
  if (org) {
    await eventBus.publish("organization.created", {
      organizationId: org.id,
      name: org.name,
    });
  }
}

export async function signOut() {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function requestPasswordReset(email: string) {
  const supabase = getSupabaseBrowserClient();
  const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/login` : undefined;
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) throw error;
}
