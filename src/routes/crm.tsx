import { createFileRoute } from "@tanstack/react-router";
import { Plus, Filter, DollarSign, Calendar, GripVertical } from "lucide-react";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/app-layout";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/core/auth";
import { useCrmBoard, crmBoardKey } from "@/features/crm/hooks/use-crm-board";
import { useMoveDealStage } from "@/features/crm/hooks/use-deals";
import type { CrmBoard, BoardStage } from "@/features/crm/application/crm-board-service";
import { formatBRL as fmtBRL, formatBRLCompact as fmtBRLk, daysSince, initials } from "@/lib/format";
import { DealFormDialog } from "@/features/crm/components/deal-form-dialog";

export const Route = createFileRoute("/crm")({
  head: () => ({
    meta: [
      { title: "CRM Kanban — ConnectWeb" },
      { name: "description", content: "Pipeline visual de vendas com estágios personalizáveis." },
    ],
  }),
  component: CrmPage,
});

function CrmPage() {
  const session = useSession();
  const org = session?.activeOrganization?.organizationId ?? null;
  const qc = useQueryClient();
  const { data: board, isLoading, isError, refetch } = useCrmBoard();
  const move = useMoveDealStage();
  const [dragId, setDragId] = useState<string | null>(null);
  const [dealOpen, setDealOpen] = useState(false);

  const stages = board?.stages ?? [];
  const firstStageId = stages.find((s) => s.type === "open")?.id ?? stages[0]?.id ?? null;
  const dealsOf = (stageId: string) => (board?.deals ?? []).filter((d) => d.stageId === stageId);

  function handleDrop(stage: BoardStage) {
    const id = dragId;
    setDragId(null);
    if (!id || !org) return;
    const key = crmBoardKey(org);
    const prev = qc.getQueryData<CrmBoard>(key);
    const deal = prev?.deals.find((d) => d.id === id);
    if (!deal || deal.stageId === stage.id) return;

    // Optimistic: move o card imediatamente; rollback em erro.
    if (prev) {
      qc.setQueryData<CrmBoard>(key, {
        ...prev,
        deals: prev.deals.map((d) => (d.id === id ? { ...d, stageId: stage.id } : d)),
      });
    }
    move.mutate(
      { id, stageId: stage.id, stageType: stage.type },
      {
        onError: () => {
          if (prev) qc.setQueryData(key, prev);
        },
        onSettled: () => {
          qc.invalidateQueries({ queryKey: crmBoardKey(org) });
          qc.invalidateQueries({ queryKey: ["dashboard", org] });
        },
      },
    );
  }

  const totalDeals = board?.deals.length ?? 0;
  const totalValue = (board?.deals ?? []).reduce((s, d) => s + d.amount, 0);

  return (
    <AppLayout
      title="CRM · Pipeline"
      subtitle={`${totalDeals} negócios ativos · ${fmtBRL(totalValue)} em pipeline`}
      actions={
        <>
          <Button variant="outline" className="h-9 rounded-lg border-border bg-card">
            <Filter className="mr-1.5 h-4 w-4" /> Filtros
          </Button>
          <Button onClick={() => setDealOpen(true)} className="h-9 rounded-lg bg-primary hover:bg-primary/90">
            <Plus className="mr-1.5 h-4 w-4" /> Novo negócio
          </Button>
        </>
      }
    >
      {isError && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card px-5 py-4">
          <p className="text-sm text-muted-foreground">Não foi possível carregar o pipeline.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="h-8 rounded-md border-border bg-background text-xs">
            Tentar novamente
          </Button>
        </div>
      )}

      <div className="-mx-4 overflow-x-auto px-4 pb-2 md:-mx-8 md:px-8">
        <div className="flex min-w-max gap-4">
          {isLoading &&
            Array.from({ length: 4 }).map((_, i) => (
              <div key={`sk-${i}`} className="w-80 shrink-0">
                <div className="mb-3 flex items-center justify-between px-1">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-5 w-6 rounded-md" />
                </div>
                <div className="space-y-2.5">
                  {Array.from({ length: 3 }).map((__, j) => (
                    <Skeleton key={j} className="h-28 w-full rounded-xl" />
                  ))}
                </div>
              </div>
            ))}

          {!isLoading && !isError && stages.length === 0 && (
            <div className="w-full py-16 text-center text-sm text-muted-foreground">
              Nenhum funil configurado.
            </div>
          )}

          {!isLoading &&
            stages.map((col) => {
              const deals = dealsOf(col.id);
              const sum = deals.reduce((s, d) => s + d.amount, 0);
              return (
                <div key={col.id} className="w-80 shrink-0">
                  <div className="mb-3 flex items-center justify-between px-1">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-primary" />
                      <h3 className="text-sm font-semibold">{col.name}</h3>
                      <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                        {deals.length}
                      </span>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7">
                      <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                  <p className="mb-3 px-1 text-[11px] text-muted-foreground">
                    {deals.length} · {fmtBRLk(sum)}
                  </p>

                  <div
                    className="space-y-2.5"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => handleDrop(col)}
                  >
                    {deals.map((d) => (
                      <article
                        key={d.id}
                        draggable
                        onDragStart={() => setDragId(d.id)}
                        onDragEnd={() => setDragId(null)}
                        className="group cursor-grab rounded-xl border border-border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 active:cursor-grabbing"
                      >
                        <div className="mb-2 flex items-start justify-between gap-2">
                          <h4 className="text-sm font-medium leading-snug text-foreground">{d.title}</h4>
                          <button className="opacity-0 transition-opacity group-hover:opacity-100">
                            <GripVertical className="h-4 w-4 text-muted-foreground" />
                          </button>
                        </div>
                        <p className="text-xs text-muted-foreground">{d.customerName}</p>

                        <div className="mt-3 flex items-center gap-1.5">
                          {d.tags[0] && (
                            <Badge variant="secondary" className="h-5 rounded-md border-0 bg-primary/10 px-1.5 text-[10px] font-medium text-primary">
                              {d.tags[0]}
                            </Badge>
                          )}
                        </div>

                        <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="inline-flex items-center gap-1 tabular-nums">
                              <DollarSign className="h-3 w-3" /> {fmtBRL(d.amount)}
                            </span>
                            <span className="inline-flex items-center gap-1 tabular-nums">
                              <Calendar className="h-3 w-3" /> {daysSince(d.createdAt)}d
                            </span>
                          </div>
                          <Avatar className="h-6 w-6 border border-border">
                            <AvatarFallback className="bg-primary/15 text-[9px] font-semibold text-primary">
                              {initials(d.ownerName)}
                            </AvatarFallback>
                          </Avatar>
                        </div>
                      </article>
                    ))}

                    <button className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-foreground">
                      <Plus className="h-3.5 w-3.5" /> Adicionar card
                    </button>
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      <DealFormDialog
        open={dealOpen}
        onOpenChange={setDealOpen}
        pipelineId={board?.pipelineId ?? null}
        stageId={firstStageId}
      />
    </AppLayout>
  );
}
