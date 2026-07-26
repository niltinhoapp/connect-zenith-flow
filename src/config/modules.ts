/**
 * Module registry — backbone of the module marketplace.
 *
 * Each feature of the app is described here as an installable "module". An
 * organization enables a subset (`Organization.enabledModules`), gated by its
 * plan (`config/plans.ts`). The sidebar, routing guards and the future
 * marketplace all read from this registry so modules can be turned on/off per
 * tenant without code changes. See docs/ARCHITECTURE.md · Marketplace.
 */
export type ModuleCategory = "core" | "sales" | "communication" | "automation" | "intelligence" | "billing";

export interface ModuleDefinition {
  /** Stable key — matches `features/<key>` and `NavItem.module`. */
  key: string;
  name: string;
  description: string;
  category: ModuleCategory;
  /** Route this module mounts (if it adds navigation). */
  route?: string;
  /** Cannot be disabled (always on for every tenant). */
  core: boolean;
}

export const moduleRegistry: ModuleDefinition[] = [
  { key: "dashboard", name: "Dashboard", description: "Visão geral do workspace.", category: "core", route: "/", core: true },
  { key: "crm", name: "CRM", description: "Pipeline de vendas em kanban.", category: "sales", route: "/crm", core: false },
  { key: "clientes", name: "Clientes", description: "Base de clientes e contatos.", category: "sales", route: "/clientes", core: false },
  { key: "whatsapp", name: "WhatsApp", description: "Inbox e envio via WhatsApp Cloud API.", category: "communication", route: "/whatsapp", core: false },
  { key: "automacoes", name: "Automações", description: "Construtor visual de fluxos.", category: "automation", route: "/automacoes", core: false },
  { key: "ia", name: "IA", description: "Copilot e blocos de IA.", category: "intelligence", route: "/ia", core: false },
  { key: "relatorios", name: "Relatórios", description: "Análises e exportações.", category: "sales", route: "/relatorios", core: false },
  { key: "configuracoes", name: "Configurações", description: "Workspace, time e integrações.", category: "core", route: "/configuracoes", core: true },
  { key: "billing", name: "Cobrança", description: "Planos, assinatura e uso.", category: "billing", route: "/configuracoes", core: true },
];

export const moduleByKey: Record<string, ModuleDefinition> = Object.fromEntries(
  moduleRegistry.map((m) => [m.key, m]),
);
