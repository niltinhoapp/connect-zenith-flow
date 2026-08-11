import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Shield, Plus, Check } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppLayout } from "@/components/app-layout";
import { SectionCard } from "@/components/shared/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toUserMessage } from "@/core/errors";
import { useRoles, usePermissions, useCreateRole } from "@/features/configuracoes/hooks/use-roles";

export const Route = createFileRoute("/configuracoes/papeis")({
  head: () => ({
    meta: [
      { title: "Papéis e permissões — ConnectWeb" },
      {
        name: "description",
        content: "Gestão de papéis (RBAC): papéis de sistema e customizados.",
      },
    ],
  }),
  component: PapeisPage,
});

function PapeisPage() {
  const { data: roles = [], isLoading, isError, refetch } = useRoles();
  const { data: permissions = [] } = usePermissions();
  const createRole = useCreateRole();

  const [name, setName] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const permsByModule = useMemo(() => {
    const map = new Map<string, typeof permissions>();
    for (const p of permissions) {
      const arr = map.get(p.module) ?? [];
      arr.push(p);
      map.set(p.module, arr);
    }
    return [...map.entries()];
  }, [permissions]);

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function onCreate() {
    if (name.trim().length < 2) {
      toast.error("Informe o nome do papel.");
      return;
    }
    createRole.mutate(
      { name: name.trim(), permissionKeys: [...selected] },
      {
        onSuccess: () => {
          toast.success("Papel criado.");
          setName("");
          setSelected(new Set());
        },
        onError: (e) => toast.error(toUserMessage(e)),
      },
    );
  }

  return (
    <AppLayout title="Papéis e permissões" subtitle="RBAC · papéis de sistema e customizados">
      <div className="mb-6 flex items-center gap-2 text-xs text-muted-foreground">
        <Link to="/configuracoes" className="inline-flex items-center gap-1 hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Configurações
        </Link>
        <span>/</span>
        <span className="text-foreground">Papéis</span>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <SectionCard title="Papéis" description="Papéis de sistema e customizados da organização">
            {isError && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Não foi possível carregar os papéis.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetch()}
                  className="h-8 rounded-md border-border bg-background text-xs"
                >
                  Tentar novamente
                </Button>
              </div>
            )}
            {isLoading && (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-xl" />
                ))}
              </div>
            )}
            {!isLoading && !isError && roles.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Nenhum papel encontrado.
              </p>
            )}
            {!isLoading && !isError && (
              <ul className="space-y-2.5">
                {roles.map((role) => (
                  <li key={role.id} className="rounded-xl border border-border bg-background p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary ring-1 ring-inset ring-primary/20">
                          <Shield className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{role.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {role.description || role.key}
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant="secondary"
                        className="rounded-md border-0 bg-muted text-[10px] font-medium text-muted-foreground"
                      >
                        {role.isSystem ? "Sistema" : "Customizado"}
                      </Badge>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1">
                      {role.permissionKeys.slice(0, 8).map((k) => (
                        <Badge
                          key={k}
                          className="rounded-md border-0 bg-primary/10 text-[10px] font-medium text-primary"
                        >
                          {k}
                        </Badge>
                      ))}
                      {role.permissionKeys.length > 8 && (
                        <Badge
                          variant="secondary"
                          className="rounded-md border-0 bg-muted text-[10px] text-muted-foreground"
                        >
                          +{role.permissionKeys.length - 8}
                        </Badge>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>

        <div className="space-y-4">
          <SectionCard title="Novo papel" description="Crie um papel customizado">
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium">Nome</label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex.: Suporte N1"
                  className="h-9 rounded-lg border-border bg-background text-sm"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium">Permissões</label>
                <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
                  {permsByModule.map(([mod, perms]) => (
                    <div key={mod}>
                      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {mod}
                      </p>
                      <div className="space-y-1.5">
                        {perms.map((p) => (
                          <label
                            key={p.key}
                            className="flex items-center gap-2 text-xs text-muted-foreground"
                          >
                            <Checkbox
                              checked={selected.has(p.key)}
                              onCheckedChange={() => toggle(p.key)}
                            />
                            <span className="text-foreground">{p.key}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <Button
                onClick={onCreate}
                disabled={createRole.isPending}
                className="h-9 w-full rounded-lg bg-primary text-sm font-medium hover:bg-primary/90"
              >
                {selected.size > 0 ? (
                  <Check className="mr-1.5 h-4 w-4" />
                ) : (
                  <Plus className="mr-1.5 h-4 w-4" />
                )}
                Criar papel
              </Button>
            </div>
          </SectionCard>
        </div>
      </div>
    </AppLayout>
  );
}
