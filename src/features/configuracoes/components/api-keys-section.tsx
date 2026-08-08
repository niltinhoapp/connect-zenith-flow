import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Copy, KeyRound, Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { SectionCard } from "@/components/shared/section-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { can, PERMISSIONS } from "@/core/permissions";
import { useSession } from "@/core/auth";
import {
  createApiKeySchema,
  useApiKeys,
  useApiScopes,
  useCreateApiKey,
  useRevokeApiKey,
  type CreateApiKeyInput,
  type CreatedApiKey,
} from "@/features/configuracoes";

const expirationOptions = [
  { value: "30", label: "30 dias" },
  { value: "90", label: "90 dias" },
  { value: "365", label: "1 ano" },
  { value: "never", label: "Sem expiração" },
];

export function ApiKeysSection() {
  const session = useSession();
  const allowed = can(session, PERMISSIONS.API_KEYS_MANAGE);
  const keys = useApiKeys();
  const scopes = useApiScopes();
  const create = useCreateApiKey();
  const revoke = useRevokeApiKey();
  const [expiration, setExpiration] = useState("90");
  const [created, setCreated] = useState<CreatedApiKey | null>(null);
  const [copied, setCopied] = useState(false);
  const form = useForm<CreateApiKeyInput>({
    resolver: zodResolver(createApiKeySchema),
    defaultValues: { name: "", scopes: [], expiresAt: null },
  });
  const selected = form.watch("scopes");
  const expiresAt = useMemo(() => {
    if (expiration === "never") return null;
    return new Date(Date.now() + Number(expiration) * 86_400_000).toISOString();
  }, [expiration]);

  const toggleScope = (scope: string) => {
    form.setValue("scopes", selected.includes(scope) ? selected.filter((item) => item !== scope) : [...selected, scope], {
      shouldDirty: true,
      shouldValidate: true,
    });
  };
  const submit = form.handleSubmit(async (values) => {
    try {
      const result = await create.mutateAsync({ ...values, expiresAt });
      setCreated(result);
      setCopied(false);
      form.reset({ name: "", scopes: [], expiresAt: null });
      toast.success("Chave criada. Copie o segredo agora.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível criar a chave.");
    }
  });
  const copySecret = async () => {
    if (!created) return;
    await navigator.clipboard.writeText(created.secret);
    setCopied(true);
    toast.success("Chave copiada.");
  };

  return (
    <div className="space-y-4">
      <SectionCard title="API Keys" description="Acesso seguro para sistemas e integrações">
        {!allowed ? <p className="text-sm text-muted-foreground">Você não possui permissão para gerenciar chaves.</p> : (
          <form onSubmit={submit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div><Label htmlFor="api-key-name">Nome da chave</Label><Input id="api-key-name" placeholder="Ex.: Integração com ERP" className="mt-1.5" {...form.register("name")} />{form.formState.errors.name && <p className="mt-1 text-xs text-destructive">{form.formState.errors.name.message}</p>}</div>
              <div><Label htmlFor="api-key-expiration">Expiração</Label><select id="api-key-expiration" value={expiration} onChange={(event) => setExpiration(event.target.value)} className="mt-1.5 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">{expirationOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>
            </div>
            <div><Label>Permissões da chave</Label><div className="mt-2 grid gap-2 sm:grid-cols-2">{scopes.data?.map((scope) => <label key={scope.key} className="flex cursor-pointer items-start gap-2 rounded-lg border border-border p-3"><input type="checkbox" checked={selected.includes(scope.key)} onChange={() => toggleScope(scope.key)} className="mt-1 accent-primary" /><span><span className="block text-sm font-medium">{scope.key}</span><span className="text-xs text-muted-foreground">{scope.description}</span></span></label>)}</div>{scopes.isLoading && <Loader2 className="mt-2 h-4 w-4 animate-spin text-primary" />}{form.formState.errors.scopes && <p className="mt-1 text-xs text-destructive">{form.formState.errors.scopes.message}</p>}</div>
            <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 p-3 text-xs text-muted-foreground">A chave completa será exibida somente uma vez. O ConnectWeb armazenará apenas uma impressão digital segura.</div>
            <div className="flex justify-end"><Button type="submit" disabled={create.isPending || scopes.isLoading}>{create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Criar chave</Button></div>
          </form>
        )}
      </SectionCard>

      <SectionCard title="Chaves cadastradas" description="Revogue imediatamente qualquer chave que não reconheça">
        {keys.isLoading && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
        {keys.isError && <p className="text-sm text-destructive">Não foi possível carregar as chaves.</p>}
        {keys.data?.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma chave criada.</p>}
        <div className="space-y-3">{keys.data?.map((item) => {
          const expired = Boolean(item.expiresAt && new Date(item.expiresAt) <= new Date());
          const active = !item.revokedAt && !expired;
          return <div key={item.id} className="flex flex-col gap-3 rounded-xl border border-border p-3 sm:flex-row sm:items-center"><KeyRound className="h-5 w-5 shrink-0 text-primary" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-medium">{item.name}</p><Badge variant={active ? "default" : "secondary"}>{item.revokedAt ? "Revogada" : expired ? "Expirada" : "Ativa"}</Badge></div><p className="font-mono text-xs text-muted-foreground">{item.prefix}••••••••</p><p className="mt-1 text-[11px] text-muted-foreground">Último uso: {item.lastUsedAt ? new Date(item.lastUsedAt).toLocaleString("pt-BR") : "nunca"} · {item.expiresAt ? `expira em ${new Date(item.expiresAt).toLocaleDateString("pt-BR")}` : "sem expiração"}</p></div>{active && <AlertDialog><AlertDialogTrigger asChild><Button variant="outline" size="sm">Revogar</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle className="flex items-center gap-2"><ShieldAlert className="h-4 w-4 text-destructive" />Revogar esta chave?</AlertDialogTitle><AlertDialogDescription>A integração “{item.name}” perderá o acesso imediatamente. Esta ação não pode ser desfeita.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => revoke.mutate(item.id, { onSuccess: () => toast.success("Chave revogada."), onError: (error) => toast.error(error.message) })}>Revogar chave</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>}</div>;
        })}</div>
      </SectionCard>

      <Dialog open={Boolean(created)} onOpenChange={(open) => { if (!open) setCreated(null); }}>
        <DialogContent><DialogHeader><DialogTitle>Copie sua chave agora</DialogTitle><DialogDescription>Por segurança, ela não poderá ser exibida novamente.</DialogDescription></DialogHeader><div className="rounded-lg border border-border bg-muted p-3"><code className="break-all text-xs">{created?.secret}</code></div><DialogFooter><Button variant="outline" onClick={copySecret}>{copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}{copied ? "Copiada" : "Copiar chave"}</Button><Button onClick={() => setCreated(null)}>Já guardei a chave</Button></DialogFooter></DialogContent>
      </Dialog>
    </div>
  );
}
