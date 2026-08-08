export type BillingProductKind = "subscription" | "ai_addon";
export type SubscriptionStatus =
  | "incomplete" | "trialing" | "active" | "past_due"
  | "unpaid" | "paused" | "canceled";

export interface BillingProductView {
  id: string;
  kind: BillingProductKind;
  name: string;
  description: string;
  priceCents: number;
  currency: "BRL";
  billingInterval: "month" | null;
  aiCredits: number;
  position: number;
}

export interface BillingSubscriptionView {
  id: string;
  productId: string;
  status: SubscriptionStatus;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

export interface AiCreditOverview {
  monthlyLimit: number;
  monthlyUsed: number;
  additionalBalance: number;
}

export interface BillingOverview {
  subscription: BillingSubscriptionView | null;
  products: BillingProductView[];
  ai: AiCreditOverview;
  metaFeesIncluded: false;
}
