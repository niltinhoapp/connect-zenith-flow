import type { PermissionKey } from "@/core/permissions";

export type CopilotModule =
  | "dashboard"
  | "crm"
  | "clientes"
  | "whatsapp"
  | "automacoes"
  | "ia"
  | "relatorios"
  | "configuracoes";

export type CopilotToolRisk = "read" | "write" | "external";

export interface CopilotExecutionContext {
  organizationId: string;
  actorId: string;
  enabledModules: readonly string[];
  permissions: readonly string[];
}

export interface CopilotToolResult<T = unknown> {
  summary: string;
  data?: T;
  navigateTo?: string;
}

export interface CopilotTool<TInput = unknown, TOutput = unknown> {
  name: string;
  title: string;
  description: string;
  module: CopilotModule;
  permissions: readonly PermissionKey[];
  risk: CopilotToolRisk;
  execute(input: TInput, context: CopilotExecutionContext): Promise<CopilotToolResult<TOutput>>;
}

export interface CopilotToolSummary {
  name: string;
  title: string;
  description: string;
  module: CopilotModule;
  risk: CopilotToolRisk;
  requiresConfirmation: boolean;
}

export interface CopilotExecutionRequest<TInput = unknown> {
  tool: string;
  input: TInput;
  confirmed?: boolean;
}

export interface CopilotExecutionAudit {
  executionId: string;
  tool: string;
  module: CopilotModule;
  risk: CopilotToolRisk;
  organizationId: string;
  actorId: string;
  confirmed: boolean;
  status: "started" | "succeeded" | "failed";
  errorCode?: string;
  occurredAt: string;
}

export type CopilotAuditWriter = (entry: CopilotExecutionAudit) => Promise<void>;

export class CopilotToolError extends Error {
  constructor(
    message: string,
    readonly code: "NOT_FOUND" | "MODULE_DISABLED" | "FORBIDDEN" | "CONFIRMATION_REQUIRED",
  ) {
    super(message);
    this.name = "CopilotToolError";
  }
}
