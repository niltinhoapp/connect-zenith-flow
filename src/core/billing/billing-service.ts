import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/types/database";
import { InfrastructureError } from "@/core/errors";
import type {
  BillingAccess,
  BillingCheckoutResult,
  BillingCustomerInput,
  BillingOverview,
  SubscriptionCheckoutResult,
} from "./types";

const productSchema = z.object({
  id: z.string(),
  kind: z.enum(["subscription", "ai_addon"]),
  name: z.string(),
  description: z.string(),
  price_cents: z.number().int().nonnegative(),
  currency: z.literal("BRL"),
  billing_interval: z.literal("month").nullable(),
  ai_credits: z.number().int().nonnegative(),
  position: z.number().int(),
});

const subscriptionSchema = z.object({
  id: z.string(),
  product_id: z.string(),
  status: z.enum([
    "incomplete",
    "trialing",
    "trial_expired",
    "active",
    "past_due",
    "unpaid",
    "paused",
    "canceled",
  ]),
  current_period_start: z.string().nullable(),
  current_period_end: z.string().nullable(),
  cancel_at_period_end: z.boolean(),
  trial_started_at: z.string().nullable().default(null),
  trial_ends_at: z.string().nullable().default(null),
});

const overviewSchema = z.object({
  subscription: subscriptionSchema.nullable(),
  products: z.array(productSchema),
  purchases: z
    .array(
      z.object({
        id: z.string().uuid(),
        product_id: z.string(),
        product_name: z.string(),
        status: z.enum(["pending", "paid", "failed", "canceled", "refunded"]),
        amount_cents: z.number().int().nonnegative(),
        credits: z.number().int().positive(),
        invoice_url: z.string().url().nullable(),
        paid_at: z.string().nullable(),
        created_at: z.string(),
      }),
    )
    .default([]),
  ai: z.object({
    monthly_limit: z.number().int(),
    monthly_used: z.number().int().nonnegative(),
    additional_balance: z.number().int().nonnegative(),
  }),
  meta_fees_included: z.literal(false),
});

const checkoutSchema = z.object({
  purchaseId: z.string().uuid(),
  paymentId: z.string().min(1),
  url: z.string().url(),
  environment: z.enum(["sandbox", "production"]),
});

const subscriptionCheckoutSchema = z.object({
  subscriptionId: z.string().uuid(),
  checkoutId: z.string().min(1),
  url: z.string().url(),
  environment: z.enum(["sandbox", "production"]),
});

const accessSchema = z.object({
  status: z.enum([
    "incomplete",
    "trialing",
    "trial_expired",
    "active",
    "past_due",
    "unpaid",
    "paused",
    "canceled",
  ]),
  trial_started_at: z.string().nullable(),
  trial_ends_at: z.string().nullable(),
  trial_days_remaining: z.number().int().nonnegative(),
  can_use_paid_features: z.boolean(),
  can_buy_addons: z.boolean(),
  needs_subscription: z.boolean(),
});

export class BillingService {
  constructor(
    private readonly db: SupabaseClient<Database>,
    private readonly organizationId: string,
  ) {}

  async overview(): Promise<BillingOverview> {
    const { data, error } = await this.db.rpc("billing_overview", { p_org: this.organizationId });
    if (error) throw new InfrastructureError(error.message, { cause: error });
    const parsed = overviewSchema.safeParse(data);
    if (!parsed.success) {
      throw new InfrastructureError("Resposta de cobrança inválida", { cause: parsed.error });
    }
    const value = parsed.data;
    return {
      subscription: value.subscription
        ? {
            id: value.subscription.id,
            productId: value.subscription.product_id,
            status: value.subscription.status,
            currentPeriodStart: value.subscription.current_period_start,
            currentPeriodEnd: value.subscription.current_period_end,
            cancelAtPeriodEnd: value.subscription.cancel_at_period_end,
            trialStartedAt: value.subscription.trial_started_at,
            trialEndsAt: value.subscription.trial_ends_at,
          }
        : null,
      products: value.products.map((product) => ({
        id: product.id,
        kind: product.kind,
        name: product.name,
        description: product.description,
        priceCents: product.price_cents,
        currency: product.currency,
        billingInterval: product.billing_interval,
        aiCredits: product.ai_credits,
        position: product.position,
      })),
      purchases: value.purchases.map((purchase) => ({
        id: purchase.id,
        productId: purchase.product_id,
        productName: purchase.product_name,
        status: purchase.status,
        amountCents: purchase.amount_cents,
        credits: purchase.credits,
        invoiceUrl: purchase.invoice_url,
        paidAt: purchase.paid_at,
        createdAt: purchase.created_at,
      })),
      ai: {
        monthlyLimit: value.ai.monthly_limit,
        monthlyUsed: value.ai.monthly_used,
        additionalBalance: value.ai.additional_balance,
      },
      metaFeesIncluded: false,
    };
  }

  async access(): Promise<BillingAccess> {
    const { data, error } = await this.db.rpc("billing_access", { p_org: this.organizationId });
    if (error) throw new InfrastructureError(error.message, { cause: error });
    const value = accessSchema.parse(data);
    return {
      status: value.status,
      trialStartedAt: value.trial_started_at,
      trialEndsAt: value.trial_ends_at,
      trialDaysRemaining: value.trial_days_remaining,
      canUsePaidFeatures: value.can_use_paid_features,
      canBuyAddons: value.can_buy_addons,
      needsSubscription: value.needs_subscription,
    };
  }

  async requestAiAddon(
    productId: string,
    idempotencyKey: string = crypto.randomUUID(),
  ): Promise<string> {
    const { data, error } = await this.db.rpc("request_ai_addon_purchase", {
      p_org: this.organizationId,
      p_product: productId,
      p_idempotency_key: idempotencyKey,
    });
    if (error) throw new InfrastructureError(error.message, { cause: error });
    return data;
  }

  async createAiAddonCheckout(
    productId: string,
    customer: BillingCustomerInput,
    idempotencyKey: string = crypto.randomUUID(),
  ): Promise<BillingCheckoutResult> {
    const { data, error } = await this.db.functions.invoke("asaas-checkout", {
      body: { organizationId: this.organizationId, productId, idempotencyKey, customer },
    });
    if (error) throw new InfrastructureError(error.message, { cause: error });
    const parsed = checkoutSchema.safeParse(data);
    if (!parsed.success) {
      const providerMessage =
        data && typeof data === "object" && "error" in data
          ? String(data.error)
          : "Resposta do checkout inválida";
      throw new InfrastructureError(providerMessage, { cause: parsed.error });
    }
    return parsed.data;
  }

  async createSubscriptionCheckout(
    customer: BillingCustomerInput,
  ): Promise<SubscriptionCheckoutResult> {
    const { data, error } = await this.db.functions.invoke("asaas-subscription-checkout", {
      body: { organizationId: this.organizationId, customer },
    });
    if (error) throw new InfrastructureError(error.message, { cause: error });
    const parsed = subscriptionCheckoutSchema.safeParse(data);
    if (!parsed.success) {
      const providerMessage =
        data && typeof data === "object" && "error" in data
          ? String(data.error)
          : "Resposta da assinatura inválida";
      throw new InfrastructureError(providerMessage, { cause: parsed.error });
    }
    return parsed.data;
  }
}
