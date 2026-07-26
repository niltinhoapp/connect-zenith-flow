import { Entity, invariant } from "@/core/domain";
import { Money } from "../value-objects/money";
import { DealStage, type DealStageValue } from "../value-objects/deal-stage";

export interface DealProps {
  id: string;
  organizationId: string;
  clienteId: string | null;
  title: string;
  stage: DealStageValue;
  amount: number;
  currency: string;
  ownerId: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CreateDealInput {
  organizationId: string;
  clienteId?: string | null;
  title: string;
  amount?: number;
  currency?: string;
  stage?: string;
  ownerId?: string | null;
}

/**
 * Deal — negócio do CRM. Invariantes: título obrigatório, valor não-negativo,
 * transições de estágio válidas (um negócio "ganho" não muda de estágio).
 */
export class Deal extends Entity<DealProps> {
  private constructor(props: DealProps) {
    super(props);
  }

  static create(
    input: CreateDealInput,
    id: string = crypto.randomUUID(),
    now: string = new Date().toISOString(),
  ): Deal {
    invariant(input.title.trim().length >= 2, "Título do negócio é obrigatório");
    const money = Money.create(input.amount ?? 0, input.currency ?? "BRL");
    const stage = input.stage ? DealStage.create(input.stage).unwrap() : "lead";

    return new Deal({
      id,
      organizationId: input.organizationId,
      clienteId: input.clienteId ?? null,
      title: input.title.trim(),
      stage,
      amount: money.amount,
      currency: money.currency,
      ownerId: input.ownerId ?? null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
  }

  static fromPersistence(props: DealProps): Deal {
    return new Deal(props);
  }

  moveTo(stage: string): void {
    const next = DealStage.create(stage);
    invariant(this.props.stage !== "won", "Negócio ganho não pode mudar de estágio");
    this.props.stage = next.unwrap();
    this.touch();
  }

  markWon(): void {
    this.props.stage = "won";
    this.touch();
  }

  private touch(): void {
    this.props.updatedAt = new Date().toISOString();
  }

  get organizationId(): string {
    return this.props.organizationId;
  }
  get amount(): number {
    return this.props.amount;
  }
  get isWon(): boolean {
    return this.props.stage === "won";
  }
}
