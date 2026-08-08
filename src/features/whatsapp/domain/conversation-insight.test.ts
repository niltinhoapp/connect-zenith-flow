import { describe, expect, it } from "vitest";
import { isInsightStale } from "@/features/whatsapp/domain/conversation-insight";

describe("isInsightStale", () => {
  it("fica desatualizado quando chegou mensagem depois da análise", () => {
    expect(isInsightStale("2026-08-08T10:00:00.000Z", "2026-08-08T10:01:00.000Z")).toBe(true);
  });

  it("continua atual quando a conversa não mudou", () => {
    expect(isInsightStale("2026-08-08T10:00:00.000Z", "2026-08-08T10:00:00.000Z")).toBe(false);
    expect(isInsightStale("2026-08-08T10:00:00.000Z", null)).toBe(false);
  });

  it("considera análise sem referência desatualizada se já existem mensagens", () => {
    expect(isInsightStale(null, "2026-08-08T10:00:00.000Z")).toBe(true);
    expect(isInsightStale(null, null)).toBe(false);
  });
});
