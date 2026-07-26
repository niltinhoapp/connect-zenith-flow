import { ChevronsLeft, Search, Bell, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useSession, initialsFromName } from "@/core/auth";

/**
 * Top application header (search, quick-create, notifications, account).
 *
 * Extracted verbatim from the original AppLayout. Collapse state is owned by
 * AppLayout; the toggle button calls back up via `onToggleSidebar`.
 */
export function Header({
  collapsed,
  onToggleSidebar,
}: {
  collapsed: boolean;
  onToggleSidebar: () => void;
}) {
  const session = useSession();
  const initials = initialsFromName(session?.profile.fullName?.trim() || "Usuário");

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-xl md:px-8">
      <Button
        variant="ghost"
        size="icon"
        onClick={onToggleSidebar}
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
            {initials}
          </AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}
