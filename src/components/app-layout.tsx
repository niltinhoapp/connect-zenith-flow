import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  KanbanSquare,
  Users,
  MessageCircle,
  Workflow,
  Sparkles,
  BarChart3,
  Settings,
  ChevronsLeft,
  Search,
  Bell,
  Plus,
  LifeBuoy,
  LogOut,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const nav = [
  { title: "Dashboard", to: "/", icon: LayoutDashboard },
  { title: "CRM", to: "/crm", icon: KanbanSquare },
  { title: "Clientes", to: "/clientes", icon: Users },
  { title: "WhatsApp", to: "/whatsapp", icon: MessageCircle, badge: "12" },
  { title: "Automações", to: "/automacoes", icon: Workflow },
  { title: "IA", to: "/ia", icon: Sparkles, badge: "Novo" },
  { title: "Relatórios", to: "/relatorios", icon: BarChart3 },
  { title: "Configurações", to: "/configuracoes", icon: Settings },
] as const;

export function AppLayout({
  children,
  title,
  subtitle,
  actions,
}: {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Sidebar */}
      <aside
        className={cn(
          "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-border bg-sidebar transition-[width] duration-200 md:flex",
          collapsed ? "w-[72px]" : "w-[248px]",
        )}
      >
        <div className="flex h-16 items-center gap-2.5 border-b border-sidebar-border px-4">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/15 ring-1 ring-primary/30">
            <div className="h-3.5 w-3.5 rounded-sm bg-primary shadow-[0_0_12px_theme(colors.primary)]" />
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold tracking-tight">ConnectWeb</p>
              <p className="truncate text-[11px] text-muted-foreground">Automations</p>
            </div>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {!collapsed && (
            <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">
              Workspace
            </p>
          )}
          <ul className="space-y-0.5">
            {nav.map((item) => {
              const active =
                item.to === "/"
                  ? pathname === "/"
                  : pathname === item.to || pathname.startsWith(item.to + "/");
              const Icon = item.icon;
              return (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    className={cn(
                      "group flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
                      active
                        ? "bg-primary/10 text-foreground ring-1 ring-inset ring-primary/25"
                        : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-[18px] w-[18px] shrink-0",
                        active ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
                      )}
                    />
                    {!collapsed && (
                      <>
                        <span className="flex-1 truncate">{item.title}</span>
                        {"badge" in item && item.badge && (
                          <Badge
                            variant="secondary"
                            className="h-5 rounded-full border-0 bg-primary/15 px-1.5 text-[10px] font-semibold text-primary"
                          >
                            {item.badge}
                          </Badge>
                        )}
                      </>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="border-t border-sidebar-border p-3">
          {!collapsed ? (
            <div className="rounded-xl border border-sidebar-border bg-card/60 p-3">
              <div className="flex items-center gap-2.5">
                <Avatar className="h-9 w-9 border border-border">
                  <AvatarFallback className="bg-primary/20 text-xs font-semibold text-primary">
                    RA
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">Rafael Alves</p>
                  <p className="truncate text-[11px] text-muted-foreground">Admin • Pro</p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                      <ChevronsLeft
                        className="h-4 w-4 -rotate-90 text-muted-foreground"
                      />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuLabel>Minha conta</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>
                      <Settings className="mr-2 h-4 w-4" /> Configurações
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <LifeBuoy className="mr-2 h-4 w-4" /> Suporte
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link to="/login" className="text-destructive focus:text-destructive">
                        <LogOut className="mr-2 h-4 w-4" /> Sair
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ) : (
            <Avatar className="mx-auto h-9 w-9 border border-border">
              <AvatarFallback className="bg-primary/20 text-xs font-semibold text-primary">
                RA
              </AvatarFallback>
            </Avatar>
          )}
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-xl md:px-8">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed((c) => !c)}
            className="hidden md:inline-flex"
          >
            <ChevronsLeft
              className={cn(
                "h-4 w-4 text-muted-foreground transition-transform",
                collapsed && "rotate-180",
              )}
            />
          </Button>

          <div className="relative hidden max-w-md flex-1 md:block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar clientes, automações, contatos..."
              className="h-9 rounded-lg border-border bg-card pl-9 text-sm placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-primary/40"
            />
            <kbd className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground lg:inline-block">
              ⌘K
            </kbd>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="hidden h-9 rounded-lg border-border bg-card text-sm font-medium hover:bg-accent md:inline-flex"
            >
              <Plus className="mr-1.5 h-4 w-4" /> Criar
            </Button>
            <Button variant="ghost" size="icon" className="relative h-9 w-9">
              <Bell className="h-[18px] w-[18px] text-muted-foreground" />
              <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_6px_theme(colors.primary)]" />
            </Button>
            <div className="ml-1 hidden h-8 w-px bg-border md:block" />
            <Avatar className="h-8 w-8 border border-border">
              <AvatarFallback className="bg-primary/20 text-[11px] font-semibold text-primary">
                RA
              </AvatarFallback>
            </Avatar>
          </div>
        </header>

        {(title || actions) && (
          <div className="border-b border-border/70 bg-background/60">
            <div className="flex flex-col gap-3 px-4 py-6 md:flex-row md:items-end md:justify-between md:px-8">
              <div className="min-w-0">
                {title && (
                  <h1 className="truncate text-2xl font-semibold tracking-tight text-foreground">
                    {title}
                  </h1>
                )}
                {subtitle && (
                  <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
                )}
              </div>
              {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
            </div>
          </div>
        )}

        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
