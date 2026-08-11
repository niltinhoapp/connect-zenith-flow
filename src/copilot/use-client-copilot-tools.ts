/**
 * Composition root do Copiloto no browser.
 *
 * Liga as ferramentas de leitura aos Application Services existentes, sempre
 * sob a sessão ativa e RLS. O Core continua sem conhecer nenhum módulo.
 */
import { useEffect, useState } from "react";
import type { AuthSession } from "@/core/auth";
import { configureCopilotAudit, replaceCopilotTools, type ServiceContext } from "@/core";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { DashboardApplicationService } from "@/features/dashboard/application/dashboard-service";
import { createDashboardMetricsTool } from "@/features/dashboard";
import { ReportsApplicationService } from "@/features/relatorios/application/reports-service";
import { createReportsOverviewTool } from "@/features/relatorios";
import { SettingsApplicationService, createActivationStatusTool } from "@/features/configuracoes";
import {
  CrmBoardService,
  DealApplicationService,
  DealSupabaseRepository,
  createCrmPipelineTool,
} from "@/features/crm";
import {
  CustomerApplicationService,
  CustomerSupabaseRepository,
  createCustomersBatchTool,
  createCustomersOverviewTool,
} from "@/features/clientes";
import {
  SupabaseWhatsAppAssistant,
  createWhatsAppConversationSummaryTool,
  createWhatsAppReplyDraftTool,
  createWhatsAppCommerceAssistantTool,
  createCommerceRegisterCrmTool,
  CommerceCrmApplicationService,
} from "@/features/whatsapp";

function serviceContext(session: AuthSession): ServiceContext {
  return {
    organizationId: session.activeOrganization!.organizationId,
    actorId: session.user.id,
    enabledModules: session.enabledModules,
  };
}

export function useClientCopilotTools(session: AuthSession | null): number {
  const [catalogVersion, setCatalogVersion] = useState(0);
  const organizationId = session?.activeOrganization?.organizationId ?? null;

  useEffect(() => {
    if (!session?.activeOrganization) {
      configureCopilotAudit(null);
      replaceCopilotTools([]);
      setCatalogVersion((version) => version + 1);
      return;
    }

    const db = getSupabaseBrowserClient();
    const context = serviceContext(session);
    const dashboard = new DashboardApplicationService(db, context);
    const reports = new ReportsApplicationService(db, context);
    const settings = new SettingsApplicationService(db, context);
    const crm = new CrmBoardService(db, context);
    const deals = new DealApplicationService(new DealSupabaseRepository(db), context, db);
    const customers = new CustomerApplicationService(
      new CustomerSupabaseRepository(db),
      context,
      db,
    );
    const whatsappAssistant = new SupabaseWhatsAppAssistant(db);
    const commerceCrm = new CommerceCrmApplicationService(
      db,
      customers,
      deals,
      crm,
      context.organizationId,
    );

    configureCopilotAudit(async (entry) => {
      const { error } = await db.rpc("write_audit", {
        p_org: entry.organizationId,
        p_action: `copilot.${entry.status}`,
        p_entity_type: "copilot_tool",
        p_entity_id: entry.executionId,
        p_metadata: {
          tool: entry.tool,
          module: entry.module,
          risk: entry.risk,
          confirmed: entry.confirmed,
          errorCode: entry.errorCode ?? null,
        },
      });
      if (error) throw error;
    });

    replaceCopilotTools([
      createDashboardMetricsTool(dashboard),
      createReportsOverviewTool(reports),
      createActivationStatusTool(settings),
      createCrmPipelineTool(crm),
      createCustomersOverviewTool(customers),
      createCustomersBatchTool(customers),
      createWhatsAppConversationSummaryTool(whatsappAssistant),
      createWhatsAppReplyDraftTool(whatsappAssistant),
      createWhatsAppCommerceAssistantTool(whatsappAssistant),
      createCommerceRegisterCrmTool(commerceCrm),
    ]);
    setCatalogVersion((version) => version + 1);
  }, [organizationId, session]);

  return catalogVersion;
}
