import { useMutation } from "@tanstack/react-query";
import { useSession } from "@/core/auth";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export interface ReportsAnswer {
  answer: string;
  highlights: string[];
  generatedAt: string;
}

async function readFunctionError(error: unknown): Promise<string> {
  const fallback = error instanceof Error ? error.message : "Não foi possível responder agora.";
  try {
    const response = (error as { context?: Response })?.context;
    if (response && typeof response.clone === "function") {
      const body = await response.clone().json();
      return String(body?.error ?? fallback);
    }
  } catch {
    /* mantém fallback */
  }
  return fallback;
}

export function useAskReports() {
  const session = useSession();
  const organizationId = session?.activeOrganization?.organizationId ?? null;
  return useMutation<ReportsAnswer, Error, string>({
    mutationFn: async (question) => {
      if (!organizationId) throw new Error("Empresa ativa não encontrada.");
      const { data, error } = await getSupabaseBrowserClient().functions.invoke(
        "ai-reports-answer",
        {
          body: { question: question.trim(), organizationId },
        },
      );
      if (error) throw new Error(await readFunctionError(error));
      if (!data?.answer) throw new Error("A IA retornou uma resposta inválida.");
      return {
        answer: String(data.answer),
        highlights: Array.isArray(data.highlights) ? data.highlights.map(String).slice(0, 4) : [],
        generatedAt: String(data.generatedAt ?? new Date().toISOString()),
      };
    },
  });
}
