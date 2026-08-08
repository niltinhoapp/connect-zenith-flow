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

export interface CopilotRunState {
  running: string | null; // nome da ferramenta em execução
  pendingConfirm: CopilotToolSummary | null; // aguardando confirmação do usuário
  result: (CopilotToolResult & { tool: string }) | null;
  error: string | null;
}

const friendly = (e: unknown): string => {
  if (e instanceof CopilotToolError) return e.message;
  return e instanceof Error ? e.message : "Não foi possível executar agora.";
};

export function useCopilot() {
  const session = useSession();
  const org = session?.activeOrganization?.organizationId ?? null;

  const context: CopilotExecutionContext | null = useMemo(() => {
    if (!session?.activeOrganization) return null;
    return {
      organizationId: session.activeOrganization.organizationId,
      actorId: session.user.id,
      enabledModules: session.enabledModules ?? [],
      permissions: session.permissions ?? [],
    };
  }, [session]);

  const tools: CopilotToolSummary[] = useMemo(
    () => (context ? listCopilotTools(context) : []),
    [context],
  );

  const [state, setState] = useState<CopilotRunState>({
    running: null,
    pendingConfirm: null,
    result: null,
    error: null,
  });

  const doExecute = useCallback(
    async (tool: CopilotToolSummary, confirmed: boolean) => {
      if (!context) return;
      setState((s) => ({ ...s, running: tool.name, error: null, pendingConfirm: null }));
      try {
        const result = await executeCopilotTool({ tool: tool.name, input: {}, confirmed }, context);
        setState({ running: null, pendingConfirm: null, result: { ...result, tool: tool.name }, error: null });
      } catch (e) {
        if (e instanceof CopilotToolError && e.code === "CONFIRMATION_REQUIRED") {
          setState((s) => ({ ...s, running: null, pendingConfirm: tool }));
          return;
        }
        setState((s) => ({ ...s, running: null, error: friendly(e) }));
      }
    },
    [context],
  );

  /** Dispara a ferramenta (pede confirmação se o Core exigir). */
  const run = useCallback((tool: CopilotToolSummary) => doExecute(tool, false), [doExecute]);
  /** Confirma e executa a ferramenta pendente. */
  const confirm = useCallback(() => {
    if (state.pendingConfirm) void doExecute(state.pendingConfirm, true);
  }, [doExecute, state.pendingConfirm]);
  const cancelConfirm = useCallback(() => setState((s) => ({ ...s, pendingConfirm: null })), []);
  const clear = useCallback(() => setState((s) => ({ ...s, result: null, error: null })), []);

  return { org, hasSession: !!context, tools, state, run, confirm, cancelConfirm, clear };
}
