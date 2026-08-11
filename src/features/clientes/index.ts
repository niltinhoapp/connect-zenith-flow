export const MODULE_KEY = "clientes" as const;

export * from "./domain";
export {
  CustomerApplicationService,
  type UpdateCustomerInput,
} from "./application/customer-application-service";
export {
  CustomerSupabaseRepository,
  rowToCustomer,
} from "./infrastructure/customer-supabase-repository";
export {
  createCustomersOverviewTool,
  createCustomersBatchTool,
  registerCustomersCopilotTools,
  type CopilotCustomerInput,
  type CreateCustomersBatchInput,
  type CreateCustomersBatchResult,
} from "./copilot-tools";
