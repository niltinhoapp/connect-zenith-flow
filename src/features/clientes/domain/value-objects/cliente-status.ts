import { ValueObject, invariant } from "@/core/domain";

export const CLIENTE_STATUSES = ["active", "trial", "inactive", "vip"] as const;
export type ClienteStatusValue = (typeof CLIENTE_STATUSES)[number];

/** Status do cliente (conjunto fechado). */
export class ClienteStatus extends ValueObject<ClienteStatusValue> {
  private constructor(value: ClienteStatusValue) {
    super(value);
  }

  static create(raw: string): ClienteStatus {
    invariant(
      (CLIENTE_STATUSES as readonly string[]).includes(raw),
      `Status de cliente inválido: ${raw}`,
    );
    return new ClienteStatus(raw as ClienteStatusValue);
  }

  static default(): ClienteStatus {
    return new ClienteStatus("trial");
  }
}
