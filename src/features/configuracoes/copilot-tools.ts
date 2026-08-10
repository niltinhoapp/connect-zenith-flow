import type { CopilotTool } from "@/core";
import type { ActivationStatus, SettingsApplicationService } from "./application/settings-service";

export interface ActivationCopilotResult {
  completed: number;
  total: number;
  percent: number;
  nextStep: { title: string; explanation: string; navigateTo: string } | null;
  firstValueReached: boolean;
}

const steps = [
  {
    key: "companyConfigured",
    title: "Configurar sua empresa",
    explanation: "Confira os dados da empresa para preparar sua operação.",
    navigateTo: "/configuracoes",
  },
  {
    key: "whatsappConnected",
    title: "Conectar o WhatsApp",
    explanation: "Conecte o WhatsApp para receber a primeira mensagem real.",
    navigateTo: "/configuracoes",
  },
  {
    key: "hasCustomerOrLead",
    title: "Registrar o primeiro cliente ou lead",
    explanation: "Cadastre uma pessoa no CRM para organizar o atendimento.",
    navigateTo: "/clientes",
  },
  {
    key: "hasInboundMessage",
    title: "Receber a primeira mensagem",
    explanation: "Peça para alguém enviar uma mensagem real ao WhatsApp conectado.",
    navigateTo: "/whatsapp",
  },
  {
    key: "hasLinkedConversation",
    title: "Identificar o cliente no CRM",
    explanation: "Abra a conversa e registre ou vincule o contato ao CRM.",
    navigateTo: "/whatsapp",
  },
  {
    key: "hasActiveAutomation",
    title: "Criar e ativar a primeira automação",
    explanation: "Crie uma automação para mensagens recebidas e deixe-a ativa.",
    navigateTo: "/automacoes",
  },
  {
    key: "hasSuccessfulMessageAutomation",
    title: "Executar a primeira automação",
    explanation: "Envie outra mensagem real e acompanhe a execução até concluir com sucesso.",
    navigateTo: "/automacoes",
  },
] as const;

export function activationResult(status: ActivationStatus): ActivationCopilotResult {
  const completed = steps.filter((step) => status[step.key]).length;
  const next = steps.find((step) => !status[step.key]) ?? null;
  const failedExplanation =
    next?.key === "hasSuccessfulMessageAutomation" && status.hasFailedMessageAutomation
      ? "A automação foi acionada, mas falhou. Abra as execuções, corrija o erro e envie uma nova mensagem."
      : next?.explanation;
  return {
    completed,
    total: steps.length,
    percent: Math.round((completed / steps.length) * 100),
    nextStep: next
      ? { title: next.title, explanation: failedExplanation!, navigateTo: next.navigateTo }
      : null,
    firstValueReached: status.hasSuccessfulMessageAutomation,
  };
}

export function createActivationStatusTool(
  service: Pick<SettingsApplicationService, "getActivationStatus">,
): CopilotTool<Record<string, never>, ActivationCopilotResult> {
  return {
    name: "onboarding.activation.read",
    title: "Ver meu próximo passo",
    description:
      "Verifica o progresso real e explica o próximo passo para colocar o ConnectWeb para trabalhar.",
    module: "configuracoes",
    permissions: [],
    risk: "read",
    async execute() {
      const data = activationResult(await service.getActivationStatus());
      const summary = data.firstValueReached
        ? "Tudo pronto! Uma mensagem foi recebida, registrada no CRM e uma automação foi executada com sucesso."
        : `Você concluiu ${data.completed} de ${data.total} etapas. Agora: ${data.nextStep!.title}. ${data.nextStep!.explanation}`;
      return { summary, data, navigateTo: data.nextStep?.navigateTo };
    },
  };
}
