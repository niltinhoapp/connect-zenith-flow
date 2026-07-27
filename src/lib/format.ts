/**
 * Formatadores compartilhados (evita duplicação nas telas).
 */
export function formatBRL(cents: number): string {
  return "R$ " + (cents / 100).toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}

export function formatBRLCompact(cents: number): string {
  const reais = cents / 100;
  if (Math.abs(reais) >= 1000) {
    return "R$ " + (reais / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 0 }) + "k";
  }
  return formatBRL(cents);
}

export function formatInt(n: number): string {
  return n.toLocaleString("pt-BR");
}

export function initials(name: string): string {
  return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase() || "—";
}

export function relativeTime(iso: string): string {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  return `há ${Math.floor(h / 24)}d`;
}

export function daysSince(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000));
}
