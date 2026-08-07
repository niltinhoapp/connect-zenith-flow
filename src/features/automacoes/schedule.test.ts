import { describe, it, expect } from "vitest";
import { parseSchedule, nextRunAt, describeSchedule } from "./domain/schedule";

describe("schedule · parseSchedule", () => {
  it("aceita interval válido e infere modo", () => {
    expect(parseSchedule({ mode: "interval", every: 5, unit: "minutes" })).toEqual({ mode: "interval", every: 5, unit: "minutes" });
    expect(parseSchedule({ every: 2, unit: "hours" })).toEqual({ mode: "interval", every: 2, unit: "hours" });
  });
  it("aceita daily HH:MM e infere modo", () => {
    expect(parseSchedule({ mode: "daily", at: "09:30" })).toEqual({ mode: "daily", at: "09:30" });
    expect(parseSchedule({ at: "23:59" })).toEqual({ mode: "daily", at: "23:59" });
  });
  it("rejeita inválidos", () => {
    expect(parseSchedule({ mode: "interval", every: 0, unit: "minutes" })).toBeNull();
    expect(parseSchedule({ mode: "interval", every: 5, unit: "anos" })).toBeNull();
    expect(parseSchedule({ mode: "daily", at: "25:00" })).toBeNull();
    expect(parseSchedule({ mode: "daily", at: "9:5" })).toBeNull();
    expect(parseSchedule(null)).toBeNull();
    expect(parseSchedule({})).toBeNull();
  });
});

describe("schedule · nextRunAt (interval)", () => {
  const base = new Date("2026-08-07T10:00:00.000Z");
  it("soma o intervalo", () => {
    expect(nextRunAt({ every: 5, unit: "minutes" }, base)?.toISOString()).toBe("2026-08-07T10:05:00.000Z");
    expect(nextRunAt({ every: 2, unit: "hours" }, base)?.toISOString()).toBe("2026-08-07T12:00:00.000Z");
    expect(nextRunAt({ every: 1, unit: "days" }, base)?.toISOString()).toBe("2026-08-08T10:00:00.000Z");
  });
});

describe("schedule · nextRunAt (daily UTC)", () => {
  it("hoje se o horário ainda não passou", () => {
    const from = new Date("2026-08-07T08:00:00.000Z");
    expect(nextRunAt({ mode: "daily", at: "09:30" }, from)?.toISOString()).toBe("2026-08-07T09:30:00.000Z");
  });
  it("amanhã se já passou (ou é igual)", () => {
    const from = new Date("2026-08-07T10:00:00.000Z");
    expect(nextRunAt({ mode: "daily", at: "09:30" }, from)?.toISOString()).toBe("2026-08-08T09:30:00.000Z");
    // exatamente no horário → próximo é amanhã (estritamente após)
    expect(nextRunAt({ mode: "daily", at: "10:00" }, from)?.toISOString()).toBe("2026-08-08T10:00:00.000Z");
  });
  it("vira o mês corretamente", () => {
    const from = new Date("2026-08-31T23:00:00.000Z");
    expect(nextRunAt({ mode: "daily", at: "22:00" }, from)?.toISOString()).toBe("2026-09-01T22:00:00.000Z");
  });
});

describe("schedule · inválido e rótulo", () => {
  it("nextRunAt null em config inválida", () => {
    expect(nextRunAt({ foo: "bar" })).toBeNull();
  });
  it("describeSchedule legível", () => {
    expect(describeSchedule({ every: 15, unit: "minutes" })).toBe("a cada 15 min");
    expect(describeSchedule({ mode: "daily", at: "08:00" })).toBe("todo dia às 08:00 (UTC)");
    expect(describeSchedule({})).toBe("sem agendamento");
  });
});
