import { Link, useRouterState, useRouter, useNavigate } from "@tanstack/react-router";
import { ChevronsLeft, Settings, LifeBuoy, LogOut, Building2, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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
import { BrandMark } from "@/components/layout/brand-mark";
import { primaryNav } from "@/config/navigation";
import { useSession, initialsFromName, signOut } from "@/core/auth";
import { setActiveOrganization } from "@/core/organizations";

/**
 * Authenticated workspace sidebar.
 *
 * Extracted verbatim from the original AppLayout. The collapse state is owned
 * by AppLayout and passed down so it can stay in sync with the header toggle.
 * The account block still shows placeholder identity ("Rafael Alves"); F1 wires
 * it to the Supabase session.
 */
export function Sidebar({ collapsed }: { collapsed: boolean }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const router = useRouter();
  const navigate = useNavigate();
  const session = useSession();

  const fullName = session?.profile.fullName?.trim() || "Usuário";
  const initials = initialsFromName(fullName);
  const roleName = session?.activeOrganization?.roleName ?? "—";
  const orgName = session?.activeOrganization?.organizationName ?? "—";

  async function handleSwitchOrg(organizationId: string) {
    if (organizationId === session?.activeOrganization?.organizationId) return;
    try {
      await setActiveOrganization(organizationId);
      await router.invalidate();
    } catch {
      toast.error("Não foi possível trocar de empresa.");
    }
  }

  async function handleLogout() {
    try {
      await signOut();
      await router.invalidate();
      await navigate({ to: "/login" });
    } catch {
      toast.error("Não foi possível sair.");
    }
  }

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-border bg-sidebar transition-[width] duration-200 md:flex",
        collapsed ? "w-[72px]" : "w-[248px]",
      )}
    >
      <div className="flex h-16 items-center gap-2.5 border-b border-sidebar-border px-4">
        <BrandMark className="shrink-0" />
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
          {primaryNav.map((item) => {
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
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{fullName}</p>
                <p className="truncate text-[11px] text-muted-foreground">{roleName} • {orgName}</p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                    <ChevronsLeft className="h-4 w-4 -rotate-90 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuLabel>Minha conta</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {session && session.memberships.length > 0 && (
                    <>
                      <DropdownMenuLabel className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Empresas
                      </DropdownMenuLabel>
                      {session.memberships.map((m) => (
                        <DropdownMenuItem
                          key={m.organizationId}
                          onClick={() => handleSwitchOrg(m.organizationId)}
                        >
                          <Building2 className="mr-2 h-4 w-4" />
                          <span className="flex-1 truncate">{m.organizationName}</span>
                          {m.organizationId === session.activeOrganization?.organizationId && (
                            <Check className="ml-2 h-4 w-4 text-primary" />
                          )}
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuSeparator />
                    </>
                  )}
                  <DropdownMenuItem asChild>
                    <Link to="/configuracoes">
                      <Settings className="mr-2 h-4 w-4" /> Configurações
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <LifeBuoy className="mr-2 h-4 w-4" /> Suporte
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="text-destructive focus:text-destructive"
                  >
                    <LogOut className="mr-2 h-4 w-4" /> Sair
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        ) : (
          <Avatar className="mx-auto h-9 w-9 border border-border">
            <AvatarFallback className="bg-primary/20 text-xs font-semibold text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
        )}
      </div>
    </aside>
  );
}
