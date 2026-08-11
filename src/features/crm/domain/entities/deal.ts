import { Entity, invariant } from "@/core/domain";
import { Money } from "../value-objects/money";

export type StageType = "open" | "won" | "lost";

export interface DealProps {
  id: string;
  organizationId: string;
  code: string | null;
  customerId: string | null;
  pipelineId: string;
  stageId: string;
  title: string;
  amount: number;
  currency: string;
  ownerId: string | null;
  source: string | null;
  notes: string | null;
  tags: string[];
  customFields: Record<string, unknown>;
  expectedCloseDate: string | null;
  closedAt: string | null;
  wonAt: string | null;
  lostAt: string | null;
  lossReason: string | null;
  winReason: string | null;
  probabilityOverride: number | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CreateDealInput {
  organizationId: string;
  customerId?: string | null;
  pipelineId: string;
  stageId: string;
  title: string;
  amount?: number; // centavos
  currency?: string;
  ownerId?: string | null;
  source?: string | null;
  notes?: string | null;
  tags?: string[];
  customFields?: Record<string, unknown>;
  expectedCloseDate?: string | null;
}

/**
 * Deal — oportunidade. Invariantes: título, pipeline e stage obrigatórios,
 * valor não-negativo (Money). O desfecho (won/lost) é derivado do tipo do
 * estágio de destino em `moveToStage`.
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
    invariant(Boolean(input.pipelineId), "Pipeline é obrigatório");
    invariant(Boolean(input.stageId), "Estágio é obrigatório");
    const money = Money.create(input.amount ?? 0, input.currency ?? "BRL");

    return new Deal({
      id,
      organizationId: input.organizationId,
      code: null,
      customerId: input.customerId ?? null,
      pipelineId: input.pipelineId,
      stageId: input.stageId,
      title: input.title.trim(),
      amount: money.amount,
      currency: money.currency,
      ownerId: input.ownerId ?? null,
      source: input.source?.trim() || null,
      notes: input.notes ?? null,
      tags: input.tags ?? [],
      customFields: input.customFields ?? {},
      expectedCloseDate: input.expectedCloseDate ?? null,
      closedAt: null,
      wonAt: null,
      lostAt: null,
      lossReason: null,
      winReason: null,
      probabilityOverride: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
  }

  static fromPersistence(props: DealProps): Deal {
    return new Deal(props);
  }

  moveToStage(stageId: string, stageType: StageType, reason?: string): void {
    invariant(Boolean(stageId), "Estágio é obrigatório");
    const now = new Date().toISOString();
    this.props.stageId = stageId;
    if (stageType === "won") {
      this.props.wonAt = now;
      this.props.lostAt = null;
      this.props.closedAt = now;
      if (reason) this.props.winReason = reason;
    } else if (stageType === "lost") {
      this.props.lostAt = now;
      this.props.wonAt = null;
      this.props.closedAt = now;
      if (reason) this.props.lossReason = reason;
    } else {
      this.props.wonAt = null;
      this.props.lostAt = null;
      this.props.closedAt = null;
    }
    this.touch();
  }

  updateDetails(input: {
    customerId?: string | null;
    title?: string;
    amount?: number;
    notes?: string | null;
    tags?: string[];
    customFields?: Record<string, unknown>;
  }): void {
    if (input.title !== undefined) {
      invariant(input.title.trim().length >= 2, "Título do negócio é obrigatório");
      this.props.title = input.title.trim();
    }
    if (input.amount !== undefined)
      this.props.amount = Money.create(input.amount, this.props.currency).amount;
    if (input.customerId !== undefined) this.props.customerId = input.customerId;
    if (input.notes !== undefined) this.props.notes = input.notes;
    if (input.tags !== undefined) this.props.tags = input.tags;
    if (input.customFields !== undefined) this.props.customFields = input.customFields;
    this.touch();
  }

  private touch(): void {
    this.props.updatedAt = new Date().toISOString();
  }

  get organizationId(): string {
    return this.props.organizationId;
  }
  get stageId(): string {
    return this.props.stageId;
  }
  get amount(): number {
    return this.props.amount;
  }
  get isWon(): boolean {
    return this.props.wonAt !== null;
  }
}
