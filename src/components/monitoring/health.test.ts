import { describe, expect, it } from "vitest";
import { aiAlertLevel, whatsappGuidance } from "./health";

describe("monitoramento operacional", () => {
  it("alerta nos marcos de 70, 90 e 100 por cento", () => {
    expect(aiAlertLevel(699, 1_000).level).toBe("ok");
    expect(aiAlertLevel(700, 1_000).level).toBe("warn70");
    expect(aiAlertLevel(900, 1_000).level).toBe("warn90");
    expect(aiAlertLevel(1_000, 1_000).level).toBe("over100");
  });

  it("orienta reconexão quando o WhatsApp exige ação", () => {
    const guidance = whatsappGuidance("action_required");
    expect(guidance.tone).toBe("danger");
    expect(guidance.help).toContain("reconecte");
  });
});
