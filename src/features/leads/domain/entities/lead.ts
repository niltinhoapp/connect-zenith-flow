import { Entity, invariant } from "@/core/domain";
import { type LeadStatusValue } from "../value-objects/lead-status";

export interface LeadProps {
  id: string;
  organizationId: string;
  code: string | null;
  name: string;
  companyName: string | null;
  email: string | null;
  phone: string | null;
  source: string | null;
  status: LeadStatusValue;
  ownerId: string | null;
  notes: string | null;
  tags: string[];
  customFields: Record<string, unknown>;
  convertedCustomerId: string | null;
  convertedAt: string | null;
  qualifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CreateLeadInput {
  organizationId: string;
  name: string;
  companyName?: string | null;
  email?: string | null;
  phone?: string | null;
  source?: string | null;
  ownerId?: string | null;
  notes?: string | null;
  tags?: string[];
  customFields?: Record<string, unknown>;
}

/**
 * Lead — contato pré-cliente. Regras: nome obrigatório; um lead convertido não
 * volta atrás. A criação do Customer na conversão é orquestrada pela camada de
 * aplicação/RPC (não aqui).
 */
export class Lead extends Entity<LeadProps> {
  private constructor(props: LeadProps) {
    super(props);
  }

  static create(
    input: CreateLeadInput,
    id: string = crypto.randomUUID(),
    now: string = new Date().toISOString(),
  ): Lead {
    invariant(input.name.trim().length >= 2, "Nome do lead é obrigatório");
    return new Lead({
      id,
      organizationId: input.organizationId,
      code: null,
      name: input.name.trim(),
      companyName: input.companyName?.trim() || null,
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      source: input.source?.trim() || null,
      status: "new",
      ownerId: input.ownerId ?? null,
      notes: input.notes ?? null,
      tags: input.tags ?? [],
      customFields: input.customFields ?? {},
      convertedCustomerId: null,
      convertedAt: null,
      qualifiedAt: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
  }

  static fromPersistence(props: LeadProps): Lead {
    return new Lead(props);
  }

  qualify(): void {
    invariant(this.props.status !== "converted", "Lead já convertido");
    this.props.status = "qualified";
    this.props.qualifiedAt = new Date().toISOString();
    this.touch();
  }

  private touch(): void {
    this.props.updatedAt = new Date().toISOString();
  }

  get organizationId(): string {
    return this.props.organizationId;
  }
  get isConverted(): boolean {
    return this.props.status === "converted";
  }
}
