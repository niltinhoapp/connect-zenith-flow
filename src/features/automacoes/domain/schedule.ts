/**
 * Agendamento do gatilho "scheduled" — cálculo puro do próximo disparo.
 *
 * Dois modos, simples e determinísticos (sem dependência de lib de cron):
 *  - interval: a cada N minutos/horas/dias.
 *  - daily:    todo dia num horário "HH:MM" (em UTC).
 *
 * Puro e 100% testável. O worker usa um espelho disto para reprogramar
 * automations.next_run_at a cada disparo. Horários em UTC para evitar
 * ambiguidade de fuso (o front pode rotular a diferença; o motor é UTC).
 */
export type ScheduleUnit = "minutes" | "hours" | "days";

export type Schedule =
  | { mode: "interval"; every: number; unit: ScheduleUnit }
  | { mode: "daily"; at: string }; // "HH:MM" (00:00–23:59, UTC)

const UNIT_MS: Record<ScheduleUnit, number> = {
  minutes: 60_000,
  hours: 3_600_000,
  days: 86_400_000,
};

/** Interpreta o trigger_config numa Schedule válida (ou null se inválido). */
export function parseSchedule(config: unknown): Schedule | null {
  if (!config || typeof config !== "object") return null;
  const c = config as Record<string, unknown>;
  const mode = String(c.mode ?? (c.every ? "interval" : c.at ? "daily" : ""));
  if (mode === "interval") {
    const every = Math.floor(Number(c.every));
    const unit = String(c.unit) as ScheduleUnit;
    if (!Number.isFinite(every) || every < 1) return null;
    if (!(unit in UNIT_MS)) return null;
    return { mode: "interval", every, unit };
  }
  if (mode === "daily") {
    const at = String(c.at ?? "");
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(at)) return null;
    return { mode: "daily", at };
  }
  return null;
}

/**
 * Próximo disparo estritamente APÓS `from`. Retorna null se a schedule for
 * inválida. Para daily, usa o horário UTC do dia; se já passou hoje, vai p/ amanhã.
 */
export function nextRunAt(config: unknown, from: Date = new Date()): Date | null {
  const sched = parseSchedule(config);
  if (!sched) return null;

  if (sched.mode === "interval") {
    return new Date(from.getTime() + sched.every * UNIT_MS[sched.unit]);
  }

  // daily
  const [h, m] = sched.at.split(":").map(Number);
  const next = new Date(Date.UTC(
    from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate(), h, m, 0, 0,
  ));
  if (next.getTime() <= from.getTime()) next.setUTCDate(next.getUTCDate() + 1);
  return next;
}

/** Rótulo curto para a UI. */
export function describeSchedule(config: unknown): string {
  const s = parseSchedule(config);
  if (!s) return "sem agendamento";
  if (s.mode === "interval") {
    const u = s.unit === "minutes" ? "min" : s.unit === "hours" ? "h" : "dia(s)";
    return `a cada ${s.every} ${u}`;
  }
  return `todo dia às ${s.at} (UTC)`;
}
