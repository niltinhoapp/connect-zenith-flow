/**
 * Billing plans (marketing + entitlements).
 *
 * Catálogo local espelhado pela tabela billing_products. A cobrança é
 * independente do provedor; preços e créditos são validados no servidor.
 */
export type PlanId = "free" | "starter" | "pro" | "enterprise" | "connectweb_complete";

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
  connectweb_complete: {
    id: "connectweb_complete",
    name: "ConnectWeb Completo",
    priceMonthly: 54_979,
    aiCredits: 5_000_000,
    seats: 100,
    includedModules: ["*"],
    highlights: ["Todos os módulos", "Todos os fluxos", "5 milhões de créditos de IA/mês"],
  },
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

export type AiAddonId = "ai_advantage" | "ai_turbo" | "ai_ultra";

export interface AiAddon {
  id: AiAddonId;
  name: string;
  price: number;
  credits: number;
  description: string;
}

export const aiAddons: Record<AiAddonId, AiAddon> = {
  ai_advantage: { id: "ai_advantage", name: "IA Advantage", price: 5_990, credits: 1_000_000, description: "Uso pontual acima da franquia." },
  ai_turbo: { id: "ai_turbo", name: "IA Turbo", price: 14_990, credits: 3_000_000, description: "Atendimento e automações intensivas." },
  ai_ultra: { id: "ai_ultra", name: "IA Ultra", price: 39_990, credits: 10_000_000, description: "Operações com alto volume." },
};

export const defaultPlanId: PlanId = "connectweb_complete";
