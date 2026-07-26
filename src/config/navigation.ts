import {
  LayoutDashboard,
  KanbanSquare,
  Users,
  MessageCircle,
  Workflow,
  Sparkles,
  BarChart3,
  Settings,
} from "lucide-react";

/**
 * Primary workspace navigation.
 *
 * Single source of truth for the authenticated sidebar. Kept in `config/` so
 * feature modules and the marketplace can reason about entries without touching
 * layout components (see docs/ARCHITECTURE.md · Marketplace).
 *
 * Declared `as const` so each `to` keeps its literal type — required by
 * TanStack Router's typed `<Link>`. The optional `badge` is present on only
 * some items, so consumers guard with `"badge" in item` (as the original
 * layout did). `module` maps to `src/config/modules.ts`.
 */
export const primaryNav = [
  { title: "Dashboard", to: "/", icon: LayoutDashboard, module: "dashboard" },
  { title: "CRM", to: "/crm", icon: KanbanSquare, module: "crm" },
  { title: "Clientes", to: "/clientes", icon: Users, module: "clientes" },
  { title: "WhatsApp", to: "/whatsapp", icon: MessageCircle, badge: "12", module: "whatsapp" },
  { title: "Automações", to: "/automacoes", icon: Workflow, module: "automacoes" },
  { title: "IA", to: "/ia", icon: Sparkles, badge: "Novo", module: "ia" },
  { title: "Relatórios", to: "/relatorios", icon: BarChart3, module: "relatorios" },
  { title: "Configurações", to: "/configuracoes", icon: Settings, module: "configuracoes" },
] as const;

export type NavItem = (typeof primaryNav)[number];
