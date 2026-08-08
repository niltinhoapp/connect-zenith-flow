/**
 * useConversationAssist — resumo/rascunho de IA DENTRO da tela do WhatsApp.
 *
 * Chama as ferramentas do Core (whatsapp.conversation.summarize / whatsapp.reply.draft)
 * passando SÓ o `conversationId`. Toda leitura/autorização/prompt/medição de
 * créditos acontece server-side (Edge Function ai-whatsapp-assist). O clique no
 * botão é a intenção explícita → confirmado. Estado local (não mistura com o
 * painel global).
 */
import { useCallback, useMemo, useState } from "react";
import { useSession } from "@/core/auth";
import {
  executeCopilotTool,
  CopilotToolError,
  type CopilotExecutionContext,
} from "@/core/copilot";

export type AssistMode = "summary" | "draft";

const TOOL: Record<AssistMode, string> = {
  summary: "whatsapp.conversation.summarize",
  draft: "whatsapp.reply.draft",
};

const friendly = (e: unknown): string =>
  e instanceof CopilotToolError ? e.message
  : e instanceof Error ? e.message
  : "Não foi possível gerar agora.";

export interface ConversationAssistState {
  loading: AssistMode | null;
  result: { mode: AssistMode; text: string } | null;
  error: string | null;
}

export function useConversationAssist(conversationId: string | null) {
  const session = useSession();

  const context: CopilotExecutionContext | null = useMemo(() => {
    if (!session?.activeOrganization) return null;
    return {
      organizationId: session.activeOrganization.organizationId,
      actorId: session.user.id,
      enabledModules: session.enabledModules ?? [],
      permissions: session.permissions ?? [],
    };
  }, [session]);

  const [state, setState] = useState<ConversationAssistState>({
    loading: null,
    result: null,
    error: null,
  });

  const assist = useCallback(
    async (mode: AssistMode): Promise<string | null> => {
      if (!context || !conversationId) return null;
      setState({ loading: mode, result: null, error: null });
      try {
        const res = await executeCopilotTool(
          { tool: TOOL[mode], input: { conversationId }, confirmed: true },
          context,
        );
        const text = res.summary ?? "";
        setState({ loading: null, result: { mode, text }, error: null });
        return text;
      } catch (e) {
        setState({ loading: null, result: null, error: friendly(e) });
        return null;
      }
    },
    [context, conversationId],
  );

  const clear = useCallback(() => setState((s) => ({ ...s, result: null, error: null })), []);

  return { ...state, available: !!context, assist, clear };
}
