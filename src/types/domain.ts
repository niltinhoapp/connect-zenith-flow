/**
 * Core domain model for ConnectWeb Automations.
 *
 * Hand-written, framework-agnostic entity types shared by features, server
 * functions and UI. In Fase F1 the persisted shapes will be backed by the
 * generated `Database` types (see `./database.ts`); these interfaces describe
 * the conceptual model and stay useful for DTOs and view models.
 *
 * MULTI-TENANCY: every tenant-scoped entity carries `organizationId`. The
 * database enforces isolation with Row Level Security on that column — see
 * docs/DATABASE.md. Never trust `organizationId` from the client; the server
 * derives it from the authenticated session.
 */

export type ID = string;
export type ISODateString = string;

/** Base fields shared by every persisted record. */
export interface BaseEntity {
  id: ID;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

/** Fields shared by every tenant-scoped (RLS-protected) record. */
export interface TenantScoped {
  organizationId: ID;
}

/* ---------------------------------------------------------------- Identity */

export type MemberRole = "owner" | "admin" | "member" | "viewer";

export interface Organization extends BaseEntity {
  name: string;
  slug: string;
  /** Current plan key — see `config/plans.ts`. */
  planId: string;
  /** Enabled marketplace module keys — see `config/modules.ts`. */
  enabledModules: string[];
}

export interface Profile extends BaseEntity {
  /** Matches Supabase `auth.users.id`. */
  userId: ID;
  fullName: string;
  email: string;
  avatarUrl?: string;
}

export interface Membership extends BaseEntity, TenantScoped {
  userId: ID;
  role: MemberRole;
}

/* -------------------------------------------------------------------- CRM */

export type DealStage = "lead" | "qualified" | "proposal" | "negotiation" | "won" | "lost";

export interface Cliente extends BaseEntity, TenantScoped {
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  tags: string[];
  status: "active" | "trial" | "inactive" | "vip";
}

export interface Deal extends BaseEntity, TenantScoped {
  clienteId: ID;
  title: string;
  stage: DealStage;
  amount: number;
  currency: string;
  ownerId: ID;
}

/* --------------------------------------------------------------- WhatsApp */

export type MessageDirection = "inbound" | "outbound";
export type MessageChannel = "whatsapp" | "email" | "sms" | "web" | "api";

export interface Conversation extends BaseEntity, TenantScoped {
  clienteId?: ID;
  channel: MessageChannel;
  /** WhatsApp Cloud API contact (E.164). */
  externalId?: string;
  unreadCount: number;
  lastMessageAt?: ISODateString;
}

export interface Message extends BaseEntity, TenantScoped {
  conversationId: ID;
  direction: MessageDirection;
  channel: MessageChannel;
  body: string;
  status: "queued" | "sent" | "delivered" | "read" | "failed";
}

/* ------------------------------------------------------------- Automações */

export type AutomationStatus = "draft" | "active" | "paused";

export interface AutomationNode {
  id: ID;
  type: string;
  position: { x: number; y: number };
  data: Record<string, unknown>;
}

export interface AutomationEdge {
  id: ID;
  source: ID;
  target: ID;
}

export interface Automation extends BaseEntity, TenantScoped {
  name: string;
  status: AutomationStatus;
  version: number;
  nodes: AutomationNode[];
  edges: AutomationEdge[];
}

export interface AutomationRun extends BaseEntity, TenantScoped {
  automationId: ID;
  status: "running" | "success" | "failed";
  startedAt: ISODateString;
  finishedAt?: ISODateString;
}

/* --------------------------------------------------------------------- IA */

export interface AiUsage extends BaseEntity, TenantScoped {
  feature: string;
  tokensIn: number;
  tokensOut: number;
  creditsSpent: number;
}

/* ---------------------------------------------------------------- Billing */

export type SubscriptionStatus = "trialing" | "active" | "past_due" | "canceled";

export interface Subscription extends BaseEntity, TenantScoped {
  planId: string;
  status: SubscriptionStatus;
  currentPeriodEnd: ISODateString;
  /** Stripe (or other PSP) reference. */
  externalCustomerId?: string;
}
