import { ValueObject, invariant } from "@/core/domain";

export const DEAL_STAGES = [
  "lead",
  "qualified",
  "proposal",
  "negotiation",
  "won",
  "lost",
] as const;
export type DealStageValue = (typeof DEAL_STAGES)[number];

/** Estágio do negócio no pipeline (conjunto fechado). */
export class DealStage extends ValueObject<DealStageValue> {
  private constructor(value: DealStageValue) {
    super(value);
  }

  static create(raw: string): DealStage {
    invariant(
      (DEAL_STAGES as readonly string[]).includes(raw),
      `Estágio de negócio inválido: ${raw}`,
    );
    return new DealStage(raw as DealStageValue);
  }

  isClosed(): boolean {
    return this.value === "won" || this.value === "lost";
  }
}
