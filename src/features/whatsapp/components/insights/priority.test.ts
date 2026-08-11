import { describe, expect, it } from "vitest";
import { isAwaitingReply } from "./priority";

describe("isAwaitingReply", () => {
  it("não cria pendência sem mensagem recebida", () => {
    expect(isAwaitingReply(null, null)).toBe(false);
  });

  it("mantém pendência mesmo depois de a conversa ser aberta", () => {
    expect(isAwaitingReply("2026-08-08T13:43:00Z", null)).toBe(true);
  });

  it("encerra a pendência quando há resposta posterior", () => {
    expect(isAwaitingReply("2026-08-08T13:43:00Z", "2026-08-08T13:44:00Z")).toBe(false);
  });

  it("volta a sinalizar quando o cliente escreve novamente", () => {
    expect(isAwaitingReply("2026-08-08T13:45:00Z", "2026-08-08T13:44:00Z")).toBe(true);
  });
});
