import { describe, expect, it } from "vitest";
import { describeSchedule, nextRunAt, parseSchedule } from "./domain/schedule";

describe("automation schedule", () => {
  it("normaliza um intervalo válido", () => {
    expect(parseSchedule({ mode: "interval", every: 3.8, unit: "hours" })).toEqual({
      mode: "interval",
      every: 3,
      unit: "hours",
    });
  });

  it("aceita o formato legado de intervalo sem mode", () => {
    expect(parseSchedule({ every: 15, unit: "minutes" })).toEqual({
      mode: "interval",
      every: 15,
      unit: "minutes",
    });
  });

  it.each([
    null,
    {},
    { mode: "interval", every: 0, unit: "hours" },
    { mode: "interval", every: 1, unit: "weeks" },
    { mode: "daily", at: "25:00" },
  ])("rejeita uma configuração inválida: %j", (value) => {
    expect(parseSchedule(value)).toBeNull();
  });

  it("calcula a próxima execução por intervalo", () => {
    const from = new Date("2026-08-09T10:00:00.000Z");
    expect(nextRunAt({ mode: "interval", every: 90, unit: "minutes" }, from)?.toISOString()).toBe(
      "2026-08-09T11:30:00.000Z",
    );
  });

  it("calcula um horário diário futuro no mesmo dia", () => {
    const from = new Date("2026-08-09T10:00:00.000Z");
    expect(nextRunAt({ mode: "daily", at: "18:30" }, from)?.toISOString()).toBe(
      "2026-08-09T18:30:00.000Z",
    );
  });

  it("avança para o dia seguinte quando o horário diário já passou", () => {
    const from = new Date("2026-08-31T22:00:00.000Z");
    expect(nextRunAt({ mode: "daily", at: "08:00" }, from)?.toISOString()).toBe(
      "2026-09-01T08:00:00.000Z",
    );
  });

  it("gera descrições simples", () => {
    expect(describeSchedule({ mode: "interval", every: 2, unit: "days" })).toBe("a cada 2 dia(s)");
    expect(describeSchedule({ mode: "daily", at: "12:15" })).toBe("todo dia às 12:15 (UTC)");
    expect(describeSchedule({})).toBe("sem agendamento");
  });
});
