import type {
  CopilotAuditWriter,
  CopilotExecutionContext,
  CopilotExecutionRequest,
  CopilotTool,
  CopilotToolResult,
  CopilotToolSummary,
} from "@/core/copilot/types";
import { CopilotToolError } from "@/core/copilot/types";

const tools = new Map<string, CopilotTool>();
let auditWriter: CopilotAuditWriter | null = null;

export function configureCopilotAudit(writer: CopilotAuditWriter | null): void {
  auditWriter = writer;
}

async function writeAudit(
  tool: CopilotTool,
  context: CopilotExecutionContext,
  executionId: string,
  confirmed: boolean,
  status: "started" | "succeeded" | "failed",
  errorCode?: string,
): Promise<void> {
  if (!auditWriter) return;
  await auditWriter({
    executionId,
    tool: tool.name,
    module: tool.module,
    risk: tool.risk,
    organizationId: context.organizationId,
    actorId: context.actorId,
    confirmed,
    status,
    errorCode,
    occurredAt: new Date().toISOString(),
  });
}

function requiresConfirmation(tool: CopilotTool): boolean {
  return tool.risk !== "read";
}

function assertAvailable(tool: CopilotTool, context: CopilotExecutionContext): void {
  if (!context.enabledModules.includes(tool.module)) {
    throw new CopilotToolError(
      `O módulo '${tool.module}' não está habilitado para esta empresa.`,
      "MODULE_DISABLED",
    );
  }

  if (!tool.permissions.every((permission) => context.permissions.includes(permission))) {
    throw new CopilotToolError(
      "Você não possui permissão para executar esta ação.",
      "FORBIDDEN",
    );
  }
}

export function registerCopilotTool(tool: CopilotTool): void {
  if (tools.has(tool.name)) {
    throw new Error(`Ferramenta do Copiloto já registrada: '${tool.name}'.`);
  }
  tools.set(tool.name, tool);
}

/** Composition roots usam esta operação para trocar o catálogo de forma atômica. */
export function replaceCopilotTools(nextTools: readonly CopilotTool[]): void {
  const names = new Set<string>();
  for (const tool of nextTools) {
    if (names.has(tool.name)) {
      throw new Error(`Ferramenta do Copiloto duplicada: '${tool.name}'.`);
    }
    names.add(tool.name);
  }
  tools.clear();
  for (const tool of nextTools) tools.set(tool.name, tool);
}

export function listCopilotTools(context: CopilotExecutionContext): CopilotToolSummary[] {
  return [...tools.values()]
    .filter(
      (tool) =>
        context.enabledModules.includes(tool.module) &&
        tool.permissions.every((permission) => context.permissions.includes(permission)),
    )
    .map((tool) => ({
      name: tool.name,
      title: tool.title,
      description: tool.description,
      module: tool.module,
      risk: tool.risk,
      requiresConfirmation: requiresConfirmation(tool),
    }));
}

export async function executeCopilotTool<TInput, TOutput>(
  request: CopilotExecutionRequest<TInput>,
  context: CopilotExecutionContext,
): Promise<CopilotToolResult<TOutput>> {
  const tool = tools.get(request.tool);
  if (!tool) {
    throw new CopilotToolError("Ferramenta do Copiloto não encontrada.", "NOT_FOUND");
  }

  assertAvailable(tool, context);

  if (requiresConfirmation(tool) && request.confirmed !== true) {
    throw new CopilotToolError(
      "Esta ação precisa da sua confirmação antes de ser executada.",
      "CONFIRMATION_REQUIRED",
    );
  }

  const executionId = crypto.randomUUID();
  const confirmed = request.confirmed === true;
  await writeAudit(tool, context, executionId, confirmed, "started");

  try {
    const result = await tool.execute(request.input, context);
    await writeAudit(tool, context, executionId, confirmed, "succeeded");
    return result as CopilotToolResult<TOutput>;
  } catch (error) {
    const errorCode = error instanceof CopilotToolError ? error.code : "EXECUTION_FAILED";
    await writeAudit(tool, context, executionId, confirmed, "failed", errorCode);
    throw error;
  }
}

/** Exclusivo para isolamento de testes. Não expor pela API pública do Core. */
export function clearCopilotTools(): void {
  tools.clear();
  auditWriter = null;
}
