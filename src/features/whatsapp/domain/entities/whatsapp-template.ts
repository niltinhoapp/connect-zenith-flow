import { Entity, invariant } from "@/core/domain";

export type TemplateCategory = "MARKETING" | "UTILITY" | "AUTHENTICATION";
export type TemplateStatus = "pending" | "approved" | "rejected" | "paused" | "disabled";

export interface TemplateProps {
  id: string;
  organizationId: string;
  accountId: string | null;
  externalId: string | null;
  name: string;
  language: string;
  category: TemplateCategory;
  status: TemplateStatus;
  components: unknown[];
  rejectedReason: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CreateTemplateInput {
  organizationId: string;
  name: string;
  language?: string;
  category?: TemplateCategory;
  bodyText: string;
  headerText?: string | null;
  footerText?: string | null;
}

/**
 * WhatsAppTemplate — modelo de mensagem aprovável pela Meta. O nome segue as
 * regras da Cloud API (minúsculas, dígitos e underscore). Os `components`
 * (header/body/footer) são data-driven (jsonb). Nasce `pending`; a aprovação é
 * refletida via sync com a Meta (bloco live).
 */
export class WhatsAppTemplate extends Entity<TemplateProps> {
  private constructor(props: TemplateProps) {
    super(props);
  }

  static create(
    input: CreateTemplateInput,
    id: string = crypto.randomUUID(),
    now: string = new Date().toISOString(),
  ): WhatsAppTemplate {
    const name = (input.name ?? "").trim().toLowerCase().replace(/\s+/g, "_");
    invariant(/^[a-z0-9_]{1,512}$/.test(name), "Nome inválido (use minúsculas, números e _).");
    invariant(Boolean(input.bodyText?.trim()), "Corpo do template é obrigatório.");

    const components: unknown[] = [];
    if (input.headerText?.trim()) {
      components.push({ type: "HEADER", format: "TEXT", text: input.headerText.trim() });
    }
    components.push({ type: "BODY", text: input.bodyText.trim() });
    if (input.footerText?.trim()) {
      components.push({ type: "FOOTER", text: input.footerText.trim() });
    }

    return new WhatsAppTemplate({
      id,
      organizationId: input.organizationId,
      accountId: null,
      externalId: null,
      name,
      language: input.language ?? "pt_BR",
      category: input.category ?? "UTILITY",
      status: "pending",
      components,
      rejectedReason: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
  }

  static fromPersistence(props: TemplateProps): WhatsAppTemplate {
    return new WhatsAppTemplate(props);
  }

  get organizationId(): string {
    return this.props.organizationId;
  }
  get name(): string {
    return this.props.name;
  }
  get status(): TemplateStatus {
    return this.props.status;
  }
  /** Extrai o texto do corpo (para preview). */
  get bodyText(): string {
    const body = (this.props.components as Array<{ type?: string; text?: string }>).find(
      (c) => c?.type === "BODY",
    );
    return body?.text ?? "";
  }
}
