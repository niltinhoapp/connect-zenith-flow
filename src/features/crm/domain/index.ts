/** CRM · Domain — barrel. */
export { Deal, type DealProps, type CreateDealInput } from "./entities/deal";
export { Money } from "./value-objects/money";
export { DealStage, DEAL_STAGES, type DealStageValue } from "./value-objects/deal-stage";
export { DealService } from "./services/deal-service";
export type { DealRepository, DealFilter } from "./repositories/deal-repository";
export * from "./events";
