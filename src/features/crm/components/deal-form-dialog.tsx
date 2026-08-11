import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toUserMessage } from "@/core/errors";
import { useSession } from "@/core/auth";
import { useCreateDeal } from "@/features/crm/hooks/use-deals";
import { crmBoardKey } from "@/features/crm/hooks/use-crm-board";

/**
 * Dialog de novo negócio. Cria no funil/estágio informados (padrão) via hook →
 * service → repository, e invalida board + dashboard.
 */
export function DealFormDialog({
  open,
  onOpenChange,
  pipelineId,
  stageId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pipelineId: string | null;
  stageId: string | null;
}) {
  const create = useCreateDeal();
  const qc = useQueryClient();
  const session = useSession();
  const org = session?.activeOrganization?.organizationId ?? null;

  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");

  useEffect(() => {
    if (open) {
      setTitle("");
      setAmount("");
    }
  }, [open]);

  async function submit() {
    if (title.trim().length < 2) {
      toast.error("Informe o título do negócio.");
      return;
    }
    if (!pipelineId || !stageId) {
      toast.error("Nenhum funil configurado.");
      return;
    }
    const cents = Math.round((Number(amount.replace(/\./g, "").replace(",", ".")) || 0) * 100);
    try {
      await create.mutateAsync({
        title: title.trim(),
        amount: cents,
        currency: "BRL",
        pipelineId,
        stageId,
      });
      if (org) {
        qc.invalidateQueries({ queryKey: crmBoardKey(org) });
        qc.invalidateQueries({ queryKey: ["dashboard", org] });
      }
      toast.success("Negócio criado.");
      onOpenChange(false);
    } catch (e) {
      toast.error(toUserMessage(e));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo negócio</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-xs">Título</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex.: Contrato anual Pro"
              className="mt-1.5 h-9 rounded-lg border-border bg-background text-sm"
            />
          </div>
          <div>
            <Label className="text-xs">Valor (R$)</Label>
            <Input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              inputMode="decimal"
              className="mt-1.5 h-9 rounded-lg border-border bg-background text-sm"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="h-9 rounded-lg border-border bg-background"
          >
            Cancelar
          </Button>
          <Button
            onClick={submit}
            disabled={create.isPending}
            className="h-9 rounded-lg bg-primary hover:bg-primary/90"
          >
            Criar negócio
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
