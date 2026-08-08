import { beforeEach, describe, expect, it, vi } from "vitest";
import { PERMISSIONS } from "@/core/permissions";
import {
  clearCopilotTools,
  configureCopilotAudit,
  executeCopilotTool,
  listCopilotTools,
  replaceCopilotTools,
  registerCopilotTool,
} from "@/core/copilot/registry";
import type {
  CopilotAuditWriter,
  CopilotExecutionContext,
} from "@/core/copilot/types";

const context: CopilotExecutionContext = {
  organizationId: "org-1",
  actorId: "user-1",
  enabledModules: ["crm", "whatsapp"],
  permissions: [PERMISSIONS.CRM_READ, PERMISSIONS.WHATSAPP_SEND],
};

beforeEach(clearCopilotTools);

describe("Core · Copilot tool registry", () => {
  it("lista somente ferramentas disponíveis para os módulos e permissões da sessão", () => {
    registerCopilotTool({
      name: "crm.pipeline.summary",
      title: "Resumir o funil",
      description: "Mostra oportunidades e gargalos do funil.",
      module: "crm",
      permissions: [PERMISSIONS.CRM_READ],
      risk: "read",
      async execute() {
        return { summary: "Resumo pronto." };
      },
    });
    registerCopilotTool({
      name: "clientes.inactive.list",
      title: "Localizar clientes inativos",
      description: "Encontra clientes sem atividade recente.",
      module: "clientes",
      permissions: [PERMISSIONS.CLIENTES_READ],
      risk: "read",
      async execute() {
        return { summary: "Clientes encontrados." };
      },
    });

    expect(listCopilotTools(context).map((tool) => tool.name)).toEqual([
      "crm.pipeline.summary",
    ]);
  });

  it("executa leitura autorizada usando o contexto confiável da sessão", async () => {
    const execute = vi.fn(async (_input: { period: string }, ctx: CopilotExecutionContext) => ({
      summary: `Empresa ${ctx.organizationId}`,
    }));
    registerCopilotTool({
      name: "crm.pipeline.summary",
      title: "Resumir o funil",
      description: "Mostra oportunidades e gargalos do funil.",
      module: "crm",
      permissions: [PERMISSIONS.CRM_READ],
      risk: "read",
      execute,
    });

    const result = await executeCopilotTool(
      { tool: "crm.pipeline.summary", input: { period: "week" } },
      context,
    );

    expect(result.summary).toBe("Empresa org-1");
    expect(execute).toHaveBeenCalledWith({ period: "week" }, context);
  });

  it("exige confirmação explícita antes de escrita ou comunicação externa", async () => {
    registerCopilotTool({
      name: "whatsapp.message.send",
      title: "Enviar mensagem",
      description: "Envia uma mensagem para o contato selecionado.",
      module: "whatsapp",
      permissions: [PERMISSIONS.WHATSAPP_SEND],
      risk: "external",
      async execute() {
        return { summary: "Mensagem enviada." };
      },
    });

    await expect(
      executeCopilotTool(
        { tool: "whatsapp.message.send", input: { body: "Olá" } },
        context,
      ),
    ).rejects.toMatchObject({ code: "CONFIRMATION_REQUIRED" });

    await expect(
      executeCopilotTool(
        { tool: "whatsapp.message.send", input: { body: "Olá" }, confirmed: true },
        context,
      ),
    ).resolves.toEqual({ summary: "Mensagem enviada." });
  });

  it("bloqueia ferramenta sem permissão mesmo quando a requisição pede confirmação", async () => {
    registerCopilotTool({
      name: "crm.deal.update",
      title: "Atualizar negócio",
      description: "Atualiza os dados de uma oportunidade.",
      module: "crm",
      permissions: [PERMISSIONS.CRM_WRITE],
      risk: "write",
      async execute() {
        return { summary: "Negócio atualizado." };
      },
    });

    await expect(
      executeCopilotTool(
        { tool: "crm.deal.update", input: {}, confirmed: true },
        context,
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("registra início e conclusão da execução sem gravar o conteúdo sensível", async () => {
    const audit = vi.fn<CopilotAuditWriter>(async () => undefined);
    configureCopilotAudit(audit);
    registerCopilotTool({
      name: "crm.pipeline.summary",
      title: "Resumir o funil",
      description: "Mostra oportunidades e gargalos do funil.",
      module: "crm",
      permissions: [PERMISSIONS.CRM_READ],
      risk: "read",
      async execute() {
        return { summary: "Resumo pronto.", data: { confidential: "não auditar" } };
      },
    });

    await executeCopilotTool(
      { tool: "crm.pipeline.summary", input: { confidential: "não auditar" } },
      context,
    );

    expect(audit).toHaveBeenCalledTimes(2);
    expect(audit.mock.calls.map(([entry]) => entry.status)).toEqual(["started", "succeeded"]);
    expect(JSON.stringify(audit.mock.calls)).not.toContain("não auditar");
    expect(audit.mock.calls[0][0]).toMatchObject({
      tool: "crm.pipeline.summary",
      organizationId: "org-1",
      actorId: "user-1",
      risk: "read",
    });
  });

  it("troca o catálogo atomicamente quando a empresa ativa muda", () => {
    const crmTool = {
      name: "crm.pipeline.summary",
      title: "Resumir o funil",
      description: "Mostra oportunidades e gargalos do funil.",
      module: "crm" as const,
      permissions: [PERMISSIONS.CRM_READ],
      risk: "read" as const,
      async execute() {
        return { summary: "Resumo pronto." };
      },
    };
    replaceCopilotTools([crmTool]);
    expect(listCopilotTools(context)).toHaveLength(1);

    replaceCopilotTools([]);
    expect(listCopilotTools(context)).toHaveLength(0);
  });
});
