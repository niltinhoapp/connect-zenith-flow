import { ValueObject, invariant } from "@/core/domain";

export const LEAD_STATUSES = ["new", "contacted", "qualified", "unqualified", "converted"] as const;
export type LeadStatusValue = (typeof LEAD_STATUSES)[number];

export class LeadStatus extends ValueObject<LeadStatusValue> {
  private constructor(value: LeadStatusValue) {
    super(value);
  }
  static create(raw: string): LeadStatus {
    invariant(
      (LEAD_STATUSES as readonly string[]).includes(raw),
      `Status de lead inválido: ${raw}`,
    );
    return new LeadStatus(raw as LeadStatusValue);
  }
}
