/**
 * Feature: Automações
 * Module key: "automacoes" (see src/config/modules.ts)
 *
 * Public surface of the Automações feature. Domain logic (api, hooks, schema,
 * components) is added here from F3 onward; UI screens currently live in
 * src/routes and are migrated to consume this module without visual changes.
 */
export const MODULE_KEY = "automacoes" as const;

export * from "./domain/engine";
export {
  nextRunAt,
  parseSchedule,
  describeSchedule,
  type Schedule,
  type ScheduleUnit,
} from "./domain/schedule";
export {
  AutomacaoApplicationService,
  type SaveAutomationInput,
  type FlowGraphInput,
  type AutomationRow,
  type AutomationRunRow,
  type AutomationRunStepRow,
} from "./application/automacao-application-service";
