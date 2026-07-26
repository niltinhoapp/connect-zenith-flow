/**
 * Core · Logging — logging estruturado com abstração de transporte.
 *
 * Toda exceção nas camadas de aplicação/infra passa por `logError`, gerando um
 * registro estruturado. O transporte é plugável: hoje só console; na F5 um
 * transporte Sentry/OpenTelemetry pode ser injetado via `setLogTransport` SEM
 * mudar os call-sites. (Não implementamos Sentry/OTel agora — só a abstração.)
 */
export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogRecord {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, unknown>;
  error?: { name: string; message: string; stack?: string; kind?: string };
}

export interface LogTransport {
  send(record: LogRecord): void;
}

const consoleTransport: LogTransport = {
  send(record) {
    const line = `[${record.level.toUpperCase()}] ${record.message}`;
    if (record.level === "error") console.error(line, record.context ?? "", record.error ?? "");
    else if (record.level === "warn") console.warn(line, record.context ?? "");
    else console.log(line, record.context ?? "");
  },
};

let transport: LogTransport = consoleTransport;

/** Ponto de injeção futuro (Sentry/OTel). */
export function setLogTransport(next: LogTransport): void {
  transport = next;
}

function emit(level: LogLevel, message: string, context?: Record<string, unknown>, error?: unknown) {
  const record: LogRecord = {
    level,
    message,
    timestamp: new Date().toISOString(),
    context,
    error:
      error instanceof Error
        ? {
            name: error.name,
            message: error.message,
            stack: error.stack,
            kind: (error as { kind?: string }).kind,
          }
        : undefined,
  };
  transport.send(record);
}

export const logger = {
  debug: (m: string, c?: Record<string, unknown>) => emit("debug", m, c),
  info: (m: string, c?: Record<string, unknown>) => emit("info", m, c),
  warn: (m: string, c?: Record<string, unknown>) => emit("warn", m, c),
  error: (m: string, c?: Record<string, unknown>) => emit("error", m, c),
};

/** Registra uma exceção de forma estruturada. */
export function logError(error: unknown, context?: Record<string, unknown>): void {
  const message = error instanceof Error ? error.message : String(error);
  emit("error", message, context, error);
}
