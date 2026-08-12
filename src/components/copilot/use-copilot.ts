/**
 * Ponte entre a UI do Copiloto (frente Claude) e a plataforma do Core (Codex).
 * Monta o contexto de execução a partir da SESSÃO (org/ator/permissões nunca
 * vêm do texto do cliente) e encapsula listar/executar com o fluxo de
 * confirmação exigido pelo Core (CONFIRMATION_REQUIRED).
 */
import { useCallback, useMemo, useState } from "react";
import { useSession } from "@/core/auth";
import {
  listCopilotTools,
  executeCopilotTool,
  CopilotToolError,
  type CopilotExecutionContext,
  type CopilotToolResult,
  type CopilotToolSummary,
} from "@/core/copilot";
import { useClientCopilotTools } from "@/copilot/use-client-copilot-tools";
import { useCopilotFocus, focusToToolInput } from "./copilot-focus";

export interface CopilotRunState {
  running: string | null; // nome da ferramenta em execução
  pendingConfirm: { tool: CopilotToolSummary; input: unknown; preview?: string } | null;
  result: (CopilotToolResult & { tool: string }) | null;
  error: string | null;
}

const friendly = (e: unknown): string => {
  if (e instanceof CopilotToolError) return e.message;
  return e instanceof Error ? e.message : "Não foi possível executar agora.";
};

/** Ferramentas que recebem o foco da tela (conversa) como input. */
const CONTEXTUAL_TOOLS = new Set<string>([
  "whatsapp.conversation.summarize",
  "whatsapp.reply.draft",
  "whatsapp.commerce.analyze",
]);

export function useCopilot() {
  const session = useSession();
  const org = session?.activeOrganization?.organizationId ?? null;
  const catalogVersion = useClientCopilotTools(session);
  const focus = useCopilotFocus();

  const context: CopilotExecutionContext | null = useMemo(() => {
    if (!session?.activeOrganization) return null;
    return {
      organizationId: session.activeOrganization.organizationId,
      actorId: session.user.id,
      enabledModules: session.enabledModules ?? [],
      permissions: session.permissions ?? [],
    };
  }, [session]);

  const tools: CopilotToolSummary[] = useMemo(() => {
    // A versão muda quando o catálogo global recebe novas ferramentas.
    // A leitura explícita mantém esta lista sincronizada com o registro.
    void catalogVersion;
    return context ? listCopilotTools(context) : [];
  }, [context, catalogVersion]);

  const [state, setState] = useState<CopilotRunState>({
    running: null,
    pendingConfirm: null,
    result: null,
    error: null,
  });

  const doExecute = useCallback(
    async (
      tool: CopilotToolSummary,
      confirmed: boolean,
      explicitInput?: unknown,
      preview?: string,
    ) => {
      if (!context) return;
      setState((s) => ({ ...s, running: tool.name, error: null, pendingConfirm: null }));
      const input =
        explicitInput ?? (CONTEXTUAL_TOOLS.has(tool.name) ? focusToToolInput(focus) : {});
      try {
        // Input contextual por ferramenta: só as ferramentas de conversa
        // recebem o foco (conversationId). O resto é resolvido server-side.
        const result = await executeCopilotTool({ tool: tool.name, input, confirmed }, context);
        setState({
          running: null,
          pendingConfirm: null,
          result: { ...result, tool: tool.name },
          error: null,
        });
      } catch (e) {
        if (e instanceof CopilotToolError && e.code === "CONFIRMATION_REQUIRED") {
          setState((s) => ({ ...s, running: null, pendingConfirm: { tool, input, preview } }));
          return;
        }
        setState((s) => ({ ...s, running: null, error: friendly(e) }));
      }
    },
    [context, focus],
  );

  /** Dispara a ferramenta (pede confirmação se o Core exigir). */
  const run = useCallback((tool: CopilotToolSummary) => doExecute(tool, false), [doExecute]);
  const runWithInput = useCallback(
    (tool: CopilotToolSummary, input: unknown, preview?: string) =>
      doExecute(tool, false, input, preview),
    [doExecute],
  );
  /** Confirma e executa a ferramenta pendente. */
  const confirm = useCallback(() => {
    if (state.pendingConfirm) {
      void doExecute(
        state.pendingConfirm.tool,
        true,
        state.pendingConfirm.input,
        state.pendingConfirm.preview,
      );
    }
  }, [doExecute, state.pendingConfirm]);
  const cancelConfirm = useCallback(() => setState((s) => ({ ...s, pendingConfirm: null })), []);
  const clear = useCallback(() => setState((s) => ({ ...s, result: null, error: null })), []);

  return {
    org,
    hasSession: !!context,
    tools,
    state,
    run,
    runWithInput,
    confirm,
    cancelConfirm,
    clear,
    focus,
  };
}
