export const MODULE_KEY = "leads" as const;

export * from "./domain";
export { LeadApplicationService } from "./application/lead-application-service";
export { LeadSupabaseRepository, rowToLead } from "./infrastructure/lead-supabase-repository";
