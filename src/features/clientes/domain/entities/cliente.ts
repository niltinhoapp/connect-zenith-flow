import { Entity, invariant } from "@/core/domain";
import { Email } from "../value-objects/email";
import { Phone } from "../value-objects/phone";
import { ClienteStatus, type ClienteStatusValue } from "../value-objects/cliente-status";

export interface ClienteProps {
  id: string;
  organizationId: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  tags: string[];
  status: ClienteStatusValue;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CreateClienteInput {
  organizationId: string;
  name: string;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  tags?: string[];
  status?: string;
}

/**
 * Cliente — entidade de domínio. Concentra as invariantes (nome obrigatório,
 * e-mail/telefone válidos, status no conjunto permitido). Nenhuma dessas regras
 * pode viver em componentes React ou rotas.
 */
export class Cliente extends Entity<ClienteProps> {
  private constructor(props: ClienteProps) {
    super(props);
  }

  static create(
    input: CreateClienteInput,
    id: string = crypto.randomUUID(),
    now: string = new Date().toISOString(),
  ): Cliente {
    invariant(input.name.trim().length >= 2, "Nome do cliente é obrigatório");
    const email = input.email ? Email.create(input.email).unwrap() : null;
    const phone = input.phone ? Phone.create(input.phone).unwrap() : null;
    const status = input.status
      ? ClienteStatus.create(input.status).unwrap()
      : ClienteStatus.default().unwrap();

    return new Cliente({
      id,
      organizationId: input.organizationId,
      name: input.name.trim(),
      company: input.company?.trim() || null,
      email,
      phone,
      tags: input.tags ?? [],
      status,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
  }

  /** Reidrata a entidade a partir do repositório (dados já persistidos). */
  static fromPersistence(props: ClienteProps): Cliente {
    return new Cliente(props);
  }

  rename(name: string): void {
    invariant(name.trim().length >= 2, "Nome do cliente é obrigatório");
    this.props.name = name.trim();
    this.touch();
  }

  changeStatus(status: string): void {
    this.props.status = ClienteStatus.create(status).unwrap();
    this.touch();
  }

  updateContact(input: { email?: string | null; phone?: string | null }): void {
    if (input.email !== undefined) {
      this.props.email = input.email ? Email.create(input.email).unwrap() : null;
    }
    if (input.phone !== undefined) {
      this.props.phone = input.phone ? Phone.create(input.phone).unwrap() : null;
    }
    this.touch();
  }

  private touch(): void {
    this.props.updatedAt = new Date().toISOString();
  }

  get organizationId(): string {
    return this.props.organizationId;
  }
  get name(): string {
    return this.props.name;
  }
  get status(): ClienteStatusValue {
    return this.props.status;
  }
}
