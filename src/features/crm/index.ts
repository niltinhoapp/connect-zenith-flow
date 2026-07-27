export const MODULE_KEY = "crm" as const;

export * from "./domain";
export { DealApplicationService } from "./application/deal-application-service";
export { DealSupabaseRepository, rowToDeal } from "./infrastructure/deal-supabase-repository";
