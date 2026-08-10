import { useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export interface CopilotPreparedIntent {
  action: string;
  message: string;
  preview: string;
  input: unknown;
}

async function functionError(error: unknown): Promise<string> {
  const fallback = error instanceof Error ? error.message : "Não foi possível interpretar seu pedido.";
  try {
    const response = (error as { context?: Response })?.context;
    if (response && typeof response.clone === "function") {
      const body = await response.clone().json();
      return String(body?.error ?? fallback);
    }
  } catch { /* mantém fallback */ }
  return fallback;
}

export function useCopilotPrompt(organizationId: string | null) {
  const [interpreting, setInterpreting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const interpret = async (prompt: string): Promise<CopilotPreparedIntent | null> => {
    if (!organizationId || !prompt.trim()) return null;
    setInterpreting(true);
    setError(null);
    try {
      const { data, error: invokeError } = await getSupabaseBrowserClient().functions.invoke("ai-copilot-intent", {
        body: { prompt: prompt.trim(), organizationId },
      });
      if (invokeError) throw invokeError;
      if (!data || typeof data !== "object") throw new Error("A IA retornou uma resposta inválida.");
      const prepared = data as CopilotPreparedIntent;
      if (prepared.action === "clientes.create.batch") {
        const customers = (prepared.input as { customers?: Array<{ firstName?: string; lastName?: string | null; email?: string | null; phone?: string | null }> })?.customers;
        if (!Array.isArray(customers) || customers.length === 0 || customers.length > 20) {
          throw new Error("A IA não preparou uma lista válida de clientes.");
        }
        // A confirmação mostra os dados realmente recebidos, nunca uma prévia livre inventada pela IA.
        prepared.preview = [
          `${customers.length} cliente(s) serão cadastrados:`,
          ...customers.map((customer, index) => {
            const name = [customer.firstName, customer.lastName].filter(Boolean).join(" ");
            const contact = customer.email || customer.phone || "sem e-mail/telefone";
            return `${index + 1}. ${name} — ${contact}`;
          }),
        ].join("\n");
      }
      return prepared;
    } catch (cause) {
      setError(await functionError(cause));
      return null;
    } finally {
      setInterpreting(false);
    }
  };

  return { interpret, interpreting, error, clearError: () => setError(null) };
}
