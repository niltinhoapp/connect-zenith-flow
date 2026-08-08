export type BillingProductKind = "subscription" | "ai_addon";
export type SubscriptionStatus =
  "incomplete" | "trialing" | "active" | "past_due" | "unpaid" | "paused" | "canceled";

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

export type BillingPurchaseStatus = "pending" | "paid" | "failed" | "canceled" | "refunded";

export interface BillingPurchaseView {
  id: string;
  productId: string;
  productName: string;
  status: BillingPurchaseStatus;
  amountCents: number;
  credits: number;
  invoiceUrl: string | null;
  paidAt: string | null;
  createdAt: string;
}

export interface BillingOverview {
  subscription: BillingSubscriptionView | null;
  products: BillingProductView[];
  purchases: BillingPurchaseView[];
  ai: AiCreditOverview;
  metaFeesIncluded: false;
}

export interface BillingCustomerInput {
  legalName: string;
  email: string;
  taxId: string;
  phone?: string;
}

export interface BillingCheckoutResult {
  purchaseId: string;
  paymentId: string;
  url: string;
  environment: "sandbox" | "production";
}
