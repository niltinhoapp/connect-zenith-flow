import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toUserMessage } from "@/core/errors";
import type { Customer } from "@/features/clientes";
import { useCreateCustomer, useUpdateCustomer } from "@/features/clientes/hooks/use-customers";

const schema = z
  .object({
    type: z.enum(["person", "company"]),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    companyName: z.string().optional(),
    email: z.string().email("E-mail inválido").optional().or(z.literal("")),
    phone: z.string().optional(),
    status: z.enum(["active", "inactive", "prospect", "vip"]),
  })
  .refine((v) => (v.type === "company" ? Boolean(v.companyName?.trim()) : Boolean(v.firstName?.trim())), {
    message: "Informe o nome",
    path: ["firstName"],
  });

/**
 * Dialog de criar/editar cliente. Fala apenas com os hooks (→ services →
 * repositories). Usa exclusivamente componentes do Design System.
 */
export function CustomerFormDialog({
  open,
  onOpenChange,
  customer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer?: Customer;
}) {
  const isEdit = Boolean(customer);
  const create = useCreateCustomer();
  const update = useUpdateCustomer();

  const [type, setType] = useState<"person" | "company">("person");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<"active" | "inactive" | "prospect" | "vip">("active");

  useEffect(() => {
    if (!open) return;
    const p = customer?.toJSON();
    setType(p?.type ?? "person");
    setFirstName(p?.firstName ?? "");
    setLastName(p?.lastName ?? "");
    setCompanyName(p?.companyName ?? "");
    setEmail(p?.email ?? "");
    setPhone(p?.phone ?? "");
    setStatus((p?.status as typeof status) ?? "active");
  }, [open, customer]);

  const pending = create.isPending || update.isPending;

  async function submit() {
    const parsed = schema.safeParse({ type, firstName, lastName, companyName, email, phone, status });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Verifique os campos.");
      return;
    }
    const v = parsed.data;
    try {
      if (isEdit && customer) {
        await update.mutateAsync({
          id: customer.id,
          changes: { status: v.status, email: v.email || null, phone: v.phone || null },
        });
        toast.success("Cliente atualizado.");
      } else {
        await create.mutateAsync({
          type: v.type,
          firstName: v.firstName || null,
          lastName: v.lastName || null,
          companyName: v.companyName || null,
          email: v.email || null,
          phone: v.phone || null,
          status: v.status,
        });
        toast.success("Cliente criado.");
      }
      onOpenChange(false);
    } catch (e) {
      toast.error(toUserMessage(e));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar cliente" : "Novo cliente"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Tipo</Label>
              <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
                <SelectTrigger className="mt-1.5 h-9 rounded-lg border-border bg-background text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="person">Pessoa</SelectItem>
                  <SelectItem value="company">Empresa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
                <SelectTrigger className="mt-1.5 h-9 rounded-lg border-border bg-background text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="prospect">Prospect</SelectItem>
                  <SelectItem value="vip">VIP</SelectItem>
                  <SelectItem value="inactive">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {type === "company" ? (
            <div>
              <Label className="text-xs">Empresa</Label>
              <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="mt-1.5 h-9 rounded-lg border-border bg-background text-sm" />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Nome</Label>
                <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="mt-1.5 h-9 rounded-lg border-border bg-background text-sm" />
              </div>
              <div>
                <Label className="text-xs">Sobrenome</Label>
                <Input value={lastName} onChange={(e) => setLastName(e.target.value)} className="mt-1.5 h-9 rounded-lg border-border bg-background text-sm" />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">E-mail</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1.5 h-9 rounded-lg border-border bg-background text-sm" />
            </div>
            <div>
              <Label className="text-xs">Telefone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1.5 h-9 rounded-lg border-border bg-background text-sm" />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="h-9 rounded-lg border-border bg-background">
            Cancelar
          </Button>
          <Button onClick={submit} disabled={pending} className="h-9 rounded-lg bg-primary hover:bg-primary/90">
            {isEdit ? "Salvar" : "Criar cliente"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
