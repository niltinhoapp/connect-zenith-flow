import { Entity, invariant } from "@/core/domain";
import { Email } from "../value-objects/email";
import { Phone } from "../value-objects/phone";
import { CustomerStatus, type CustomerStatusValue } from "../value-objects/customer-status";

export type CustomerType = "person" | "company";

export interface CustomerProps {
  id: string;
  organizationId: string;
  code: string | null;
  type: CustomerType;
  firstName: string | null;
  lastName: string | null;
  companyName: string | null;
  document: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  website: string | null;
  status: CustomerStatusValue;
  ownerId: string | null;
  source: string | null;
  notes: string | null;
  tags: string[];
  customFields: Record<string, unknown>;
  lastContactAt: string | null;
  nextFollowupAt: string | null;
  score: number | null;
  lifetimeValue: number;
  originChannel: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CreateCustomerInput {
  organizationId: string;
  type?: CustomerType;
  firstName?: string | null;
  lastName?: string | null;
  companyName?: string | null;
  document?: string | null;
  email?: string | null;
  phone?: string | null;
  mobile?: string | null;
  website?: string | null;
  status?: string;
  ownerId?: string | null;
  source?: string | null;
  notes?: string | null;
  tags?: string[];
  customFields?: Record<string, unknown>;
  originChannel?: string | null;
}

/**
 * Customer — cliente (pessoa/empresa). Concentra as invariantes; nenhuma regra
 * aqui depende de banco, React ou eventos (isso é da camada de aplicação).
 */
export class Customer extends Entity<CustomerProps> {
  private constructor(props: CustomerProps) {
    super(props);
  }

  static create(
    input: CreateCustomerInput,
    id: string = crypto.randomUUID(),
    now: string = new Date().toISOString(),
  ): Customer {
    const type: CustomerType = input.type ?? "person";
    const hasName =
      type === "company"
        ? Boolean(input.companyName?.trim())
        : Boolean(input.firstName?.trim());
    invariant(hasName, type === "company" ? "Nome da empresa é obrigatório" : "Nome é obrigatório");

    const email = input.email ? Email.create(input.email).unwrap() : null;
    const phone = input.phone ? Phone.create(input.phone).unwrap() : null;
    const mobile = input.mobile ? Phone.create(input.mobile).unwrap() : null;
    const status = input.status ? CustomerStatus.create(input.status).unwrap() : CustomerStatus.default().unwrap();

    return new Customer({
      id,
      organizationId: input.organizationId,
      code: null,
      type,
      firstName: input.firstName?.trim() || null,
      lastName: input.lastName?.trim() || null,
      companyName: input.companyName?.trim() || null,
      document: input.document?.trim() || null,
      email,
      phone,
      mobile,
      website: input.website?.trim() || null,
      status,
      ownerId: input.ownerId ?? null,
      source: input.source?.trim() || null,
      notes: input.notes ?? null,
      tags: input.tags ?? [],
      customFields: input.customFields ?? {},
      lastContactAt: null,
      nextFollowupAt: null,
      score: null,
      lifetimeValue: 0,
      originChannel: input.originChannel?.trim() || null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
  }

  static fromPersistence(props: CustomerProps): Customer {
    return new Customer(props);
  }

  changeStatus(status: string): void {
    this.props.status = CustomerStatus.create(status).unwrap();
    this.touch();
  }

  updateContact(input: { email?: string | null; phone?: string | null; mobile?: string | null }): void {
    if (input.email !== undefined) this.props.email = input.email ? Email.create(input.email).unwrap() : null;
    if (input.phone !== undefined) this.props.phone = input.phone ? Phone.create(input.phone).unwrap() : null;
    if (input.mobile !== undefined) this.props.mobile = input.mobile ? Phone.create(input.mobile).unwrap() : null;
    this.touch();
  }

  private touch(): void {
    this.props.updatedAt = new Date().toISOString();
  }

  get organizationId(): string {
    return this.props.organizationId;
  }
  get displayName(): string {
    if (this.props.type === "company") return this.props.companyName ?? "—";
    return [this.props.firstName, this.props.lastName].filter(Boolean).join(" ") || "—";
  }
  get status(): CustomerStatusValue {
    return this.props.status;
  }
}
