import { ValueObject, invariant } from "@/core/domain";

export const CUSTOMER_STATUSES = ["active", "inactive", "prospect", "vip"] as const;
export type CustomerStatusValue = (typeof CUSTOMER_STATUSES)[number];

export class CustomerStatus extends ValueObject<CustomerStatusValue> {
  private constructor(value: CustomerStatusValue) {
    super(value);
  }
  static create(raw: string): CustomerStatus {
    invariant((CUSTOMER_STATUSES as readonly string[]).includes(raw), `Status inválido: ${raw}`);
    return new CustomerStatus(raw as CustomerStatusValue);
  }
  static default(): CustomerStatus {
    return new CustomerStatus("active");
  }
}
