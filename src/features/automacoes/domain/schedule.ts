export type ScheduleUnit = "minutes" | "hours" | "days";

export type AutomationSchedule =
  | { mode: "interval"; every: number; unit: ScheduleUnit }
  | { mode: "daily"; at: string };

const UNIT_MS: Record<ScheduleUnit, number> = {
  minutes: 60_000,
  hours: 3_600_000,
  days: 86_400_000,
};

export function parseSchedule(config: unknown): AutomationSchedule | null {
  if (!config || typeof config !== "object") return null;
  const value = config as Record<string, unknown>;
  const mode = String(value.mode ?? (value.every ? "interval" : value.at ? "daily" : ""));

  if (mode === "interval") {
    const every = Math.floor(Number(value.every));
    const unit = String(value.unit) as ScheduleUnit;
    if (!Number.isFinite(every) || every < 1 || !(unit in UNIT_MS)) return null;
    return { mode, every, unit };
  }

  if (mode === "daily") {
    const at = String(value.at ?? "");
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(at)) return null;
    return { mode, at };
  }

  return null;
}

export function nextRunAt(config: unknown, from = new Date()): Date | null {
  const schedule = parseSchedule(config);
  if (!schedule) return null;

  if (schedule.mode === "interval") {
    return new Date(from.getTime() + schedule.every * UNIT_MS[schedule.unit]);
  }

  const [hours, minutes] = schedule.at.split(":").map(Number);
  const next = new Date(Date.UTC(
    from.getUTCFullYear(),
    from.getUTCMonth(),
    from.getUTCDate(),
    hours,
    minutes,
    0,
    0,
  ));
  if (next.getTime() <= from.getTime()) next.setUTCDate(next.getUTCDate() + 1);
  return next;
}

export function describeSchedule(config: unknown): string {
  const schedule = parseSchedule(config);
  if (!schedule) return "sem agendamento";
  if (schedule.mode === "interval") {
    const unit = schedule.unit === "minutes" ? "min" : schedule.unit === "hours" ? "h" : "dia(s)";
    return `a cada ${schedule.every} ${unit}`;
  }
  return `todo dia às ${schedule.at} (UTC)`;
}
