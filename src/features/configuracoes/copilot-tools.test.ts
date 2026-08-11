import { describe, expect, it } from "vitest";
import { activationResult } from "./copilot-tools";
import type { ActivationStatus } from "./application/settings-service";

const empty: ActivationStatus = {
  companyConfigured: false,
  whatsappConnected: false,
  hasCustomerOrLead: false,
  hasInboundMessage: false,
  hasLinkedConversation: false,
  hasActiveAutomation: false,
  hasSuccessfulMessageAutomation: false,
  hasFailedMessageAutomation: false,
};

describe("Onboarding · primeiro valor", () => {
  it("começa pela empresa e não aceita execução manual como evidência", () => {
    const result = activationResult(empty);
    expect(result.percent).toBe(0);
    expect(result.nextStep?.navigateTo).toBe("/configuracoes");
  });

  it("orienta a correção quando a execução por mensagem falhou", () => {
    const result = activationResult({
      ...empty,
      companyConfigured: true,
      whatsappConnected: true,
      hasCustomerOrLead: true,
      hasInboundMessage: true,
      hasLinkedConversation: true,
      hasActiveAutomation: true,
      hasFailedMessageAutomation: true,
    });
    expect(result.nextStep?.explanation).toContain("falhou");
    expect(result.firstValueReached).toBe(false);
  });

  it("só conclui com automação de mensagem executada com sucesso", () => {
    const result = activationResult(
      Object.fromEntries(
        Object.keys(empty).map((key) => [key, key !== "hasFailedMessageAutomation"]),
      ) as unknown as ActivationStatus,
    );
    expect(result.percent).toBe(100);
    expect(result.firstValueReached).toBe(true);
    expect(result.nextStep).toBeNull();
  });
});
