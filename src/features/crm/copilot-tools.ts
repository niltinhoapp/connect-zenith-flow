import { PERMISSIONS, registerCopilotTool } from "@/core";
import type { CopilotTool } from "@/core";
import type {
  CrmBoard,
  CrmBoardService,
} from "@/features/crm/application/crm-board-service";

export interface CrmCopilotSummary {
  board: CrmBoard;
  openDeals: number;
  openValue: number;
  oldestOpenDeals: Array<{ id: string; title: string; customerName: string; daysOpen: number }>;
}

const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function createCrmPipelineTool(
  service: Pick<CrmBoardService, "getBoard">,
  now: () => Date = () => new Date(),
): CopilotTool<Record<string, never>, CrmCopilotSummary> {
  return {
    name: "crm.pipeline.read",
    title: "Analisar oportunidades",
    description: "Resume o funil e destaca negócios abertos há mais tempo.",
    module: "crm",
    permissions: [PERMISSIONS.CRM_READ],
    risk: "read",
    async execute() {
      const board = await service.getBoard();
      const stageById = new Map(board.stages.map((stage) => [stage.id, stage]));
      const openDeals = board.deals.filter((deal) => stageById.get(deal.stageId)?.type === "open");
      const openValue = openDeals.reduce((total, deal) => total + deal.amount, 0);
      const currentTime = now().getTime();
      const oldestOpenDeals = openDeals
        .map((deal) => ({
          id: deal.id,
          title: deal.title,
          customerName: deal.customerName,
          daysOpen: Math.max(
            0,
            Math.floor((currentTime - new Date(deal.createdAt).getTime()) / 86_400_000),
          ),
        }))
        .sort((a, b) => b.daysOpen - a.daysOpen)
        .slice(0, 5);
      const attention = oldestOpenDeals[0]
        ? `A oportunidade mais antiga está aberta há ${oldestOpenDeals[0].daysOpen} dias.`
        : "Não há oportunidades abertas neste momento.";

      return {
        summary: `Existem ${openDeals.length} oportunidades abertas, somando ${brl(openValue)}. ${attention}`,
        data: { board, openDeals: openDeals.length, openValue, oldestOpenDeals },
        navigateTo: "/crm",
      };
    },
  };
}

export function registerCrmCopilotTools(service: Pick<CrmBoardService, "getBoard">): void {
  registerCopilotTool(createCrmPipelineTool(service));
}
