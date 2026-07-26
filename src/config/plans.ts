/**
 * Billing plans (marketing + entitlements).
 *
 * Source of truth for pricing tiers and per-plan limits. Wired to Stripe and
 * enforced server-side in Fase F4; consumed by the UI (upgrade prompts, the
 * "Pro" badge) and by module gating.
 */
export type PlanId = "free" | "starter" | "pro" | "enterprise";

export interface Plan {
  id: PlanId;
  name: string;
  /** Monthly price in BRL cents; null = "fale conosco". */
  priceMonthly: number | null;
  /** Included AI credits per month. */
  aiCredits: number;
  seats: number;
  /** Marketplace module keys included in this plan — see `config/modules.ts`. */
  includedModules: string[];
  highlights: string[];
}

export const plans: Record<PlanId, Plan> = {
  free: {
    id: "free",
    name: "Free",
    priceMonthly: 0,
    aiCredits: 1_000,
    seats: 1,
    includedModules: ["dashboard", "crm", "clientes"],
    highlights: ["1 usuário", "CRM básico", "1.000 créditos IA"],
  },
  starter: {
    id: "starter",
    name: "Starter",
    priceMonthly: 9_900,
    aiCredits: 20_000,
    seats: 3,
    includedModules: ["dashboard", "crm", "clientes", "whatsapp", "relatorios"],
    highlights: ["3 usuários", "WhatsApp Cloud API", "Relatórios"],
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceMonthly: 29_900,
    aiCredits: 150_000,
    seats: 10,
    includedModules: [
      "dashboard",
      "crm",
      "clientes",
      "whatsapp",
      "automacoes",
      "ia",
      "relatorios",
    ],
    highlights: ["10 usuários", "Automações + IA", "150k créditos IA"],
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    priceMonthly: null,
    aiCredits: 1_000_000,
    seats: 100,
    includedModules: ["*"],
    highlights: ["Usuários ilimitados", "SLA dedicado", "Todos os módulos"],
  },
};

export const defaultPlanId: PlanId = "free";
