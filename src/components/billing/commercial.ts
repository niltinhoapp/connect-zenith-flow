/**
 * Catálogo comercial aprovado (frente Claude — apresentação visual).
 *
 * Não substitui o contrato de cobrança do Codex (config/plans.ts / Stripe):
 * são apenas os valores aprovados para APRESENTAÇÃO. A compra real será ligada
 * pelo Codex através do seam tipado `onPurchasePackage`.
 */
export interface IaPackage {
  id: "advantage" | "turbo" | "ultra";
  name: string;
  /** Créditos de IA adicionais (nunca falar em "tokens"). */
  credits: number;
  priceCents: number;
  highlight?: boolean;
}

/** Plano único aprovado. */
export const CONNECTWEB_PLAN = {
  name: "ConnectWeb Completo",
  priceCents: 54_979, // R$ 549,79/mês
} as const;

export const IA_PACKAGES: IaPackage[] = [
  { id: "advantage", name: "IA Advantage", credits: 1_000_000, priceCents: 5_990 },
  { id: "turbo", name: "IA Turbo", credits: 3_000_000, priceCents: 14_990, highlight: true },
  { id: "ultra", name: "IA Ultra", credits: 10_000_000, priceCents: 39_990 },
];

export function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatCredits(value: number): string {
  return value.toLocaleString("pt-BR");
}
