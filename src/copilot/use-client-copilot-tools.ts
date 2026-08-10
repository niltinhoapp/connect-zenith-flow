/**
 * Composition root do Copiloto no browser.
 *
 * Liga as ferramentas de leitura aos Application Services existentes, sempre
 * sob a sessão ativa e RLS. O Core continua sem conhecer nenhum módulo.
 */
import { useEffect, useState } from "react";
import type { AuthSession } from "@/core/auth";
import { replaceCopilotTools, type ServiceContext } from "@/core";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  DashboardApplicationService,
} from "@/features/dashboard/application/dashboard-service";
import { createDashboardMetricsTool } from "@/features/dashboard";
import { ReportsApplicationService } from "@/features/relatorios/application/reports-service";
import { createReportsOverviewTool } from "@/features/relatorios";
import { CrmBoardService, createCrmPipelineTool } from "@/features/crm";
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
      replaceCopilotTools([]);
      setCatalogVersion((version) => version + 1);
      return;
    }

    const db = getSupabaseBrowserClient();
    const context = serviceContext(session);
    const dashboard = new DashboardApplicationService(db, context);
    const reports = new ReportsApplicationService(db, context);
    const crm = new CrmBoardService(db, context);
    const customers = new CustomerApplicationService(
      new CustomerSupabaseRepository(db),
      context,
      db,
    );
    const whatsappAssistant = new SupabaseWhatsAppAssistant(db);

    replaceCopilotTools([
      createDashboardMetricsTool(dashboard),
      createReportsOverviewTool(reports),
      createCrmPipelineTool(crm),
      createCustomersOverviewTool(customers),
      createCustomersBatchTool(customers),
      createWhatsAppConversationSummaryTool(whatsappAssistant),
      createWhatsAppReplyDraftTool(whatsappAssistant),
    ]);
    setCatalogVersion((version) => version + 1);
  }, [organizationId, session]);

  return catalogVersion;
}
