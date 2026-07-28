import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, Trash2, ArrowLeft, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  useTemplates,
  useCreateTemplate,
  useDeleteTemplate,
} from "@/features/whatsapp/hooks/use-templates";
import type { TemplateCategory, TemplateStatus } from "@/features/whatsapp";

export const Route = createFileRoute("/whatsapp_/templates")({
  head: () => ({
    meta: [{ title: "Templates de WhatsApp — ConnectWeb" }],
  }),
  component: TemplatesPage,
});

const STATUS_STYLE: Record<TemplateStatus, string> = {
  approved: "bg-success/10 text-success ring-success/25",
  pending: "bg-warning/10 text-warning ring-warning/25",
  rejected: "bg-destructive/10 text-destructive ring-destructive/25",
  paused: "bg-muted text-muted-foreground ring-border",
  disabled: "bg-muted text-muted-foreground ring-border",
};

const STATUS_LABEL: Record<TemplateStatus, string> = {
  approved: "Aprovado",
  pending: "Pendente",
  rejected: "Rejeitado",
  paused: "Pausado",
  disabled: "Desativado",
};

function TemplatesPage() {
  const templatesQuery = useTemplates();
  const templates = (templatesQuery.data?.items ?? []).map((t) => t.toJSON());

  return (
    <AppLayout>
      <div className="mx-auto w-full max-w-4xl px-1 py-2">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              to="/whatsapp"
              className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <h1 className="text-lg font-semibold">Templates de WhatsApp</h1>
              <p className="text-xs text-muted-foreground">
                Modelos aprovados pela Meta para iniciar conversas fora da janela de 24h.
              </p>
            </div>
          </div>
          <NewTemplateDialog />
        </div>

        {templatesQuery.isLoading ? (
          <div className="flex justify-center py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : templates.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-xl border border-border bg-card">
              <FileText className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">Nenhum template ainda</p>
              <p className="text-xs text-muted-foreground">
                Crie um rascunho para enviar à aprovação da Meta.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {templates.map((t) => (
              <TemplateRow
                key={t.id}
                id={t.id}
                name={t.name}
                language={t.language}
                category={t.category}
                status={t.status}
                components={t.components}
              />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function TemplateRow(props: {
  id: string;
  name: string;
  language: string;
  category: TemplateCategory;
  status: TemplateStatus;
  components: unknown[];
}) {
  const del = useDeleteTemplate();
  const body = (props.components as Array<{ type?: string; text?: string }>).find(
    (c) => c?.type === "BODY",
  );
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-border bg-card p-4">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm font-medium">{props.name}</span>
          <Badge className="rounded-md border-0 bg-muted text-[10px] text-muted-foreground">
            {props.language}
          </Badge>
          <Badge className="rounded-md border-0 bg-primary/10 text-[10px] text-primary">
            {props.category}
          </Badge>
          <Badge
            className={cn(
              "rounded-md border-0 text-[10px] ring-1 ring-inset",
              STATUS_STYLE[props.status],
            )}
          >
            {STATUS_LABEL[props.status]}
          </Badge>
        </div>
        <p className="mt-1.5 truncate text-xs text-muted-foreground">{body?.text ?? "—"}</p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
        disabled={del.isPending}
        onClick={() => del.mutate(props.id)}
        title="Excluir"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

function NewTemplateDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [language, setLanguage] = useState("pt_BR");
  const [category, setCategory] = useState<TemplateCategory>("UTILITY");
  const [header, setHeader] = useState("");
  const [body, setBody] = useState("");
  const [footer, setFooter] = useState("");
  const create = useCreateTemplate();

  const reset = () => {
    setName("");
    setLanguage("pt_BR");
    setCategory("UTILITY");
    setHeader("");
    setBody("");
    setFooter("");
  };

  const submit = () => {
    create.mutate(
      {
        name,
        language,
        category,
        headerText: header || null,
        bodyText: body,
        footerText: footer || null,
      },
      {
        onSuccess: () => {
          toast.success("Template criado (rascunho).");
          setOpen(false);
          reset();
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao criar template."),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="h-9 rounded-lg bg-primary text-sm hover:bg-primary/90">
          <Plus className="mr-1.5 h-4 w-4" /> Novo template
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo template</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Nome</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="ex.: boas_vindas"
                className="mt-1.5 h-9"
              />
              <p className="mt-1 text-[10px] text-muted-foreground">minúsculas, números e _</p>
            </div>
            <div>
              <Label className="text-xs">Idioma</Label>
              <Input
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                placeholder="pt_BR"
                className="mt-1.5 h-9"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Categoria</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as TemplateCategory)}>
              <SelectTrigger className="mt-1.5 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="UTILITY">Utilidade</SelectItem>
                <SelectItem value="MARKETING">Marketing</SelectItem>
                <SelectItem value="AUTHENTICATION">Autenticação</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Cabeçalho (opcional)</Label>
            <Input
              value={header}
              onChange={(e) => setHeader(e.target.value)}
              className="mt-1.5 h-9"
            />
          </div>
          <div>
            <Label className="text-xs">Corpo</Label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Olá! Tudo bem?"
              className="mt-1.5 min-h-24"
            />
          </div>
          <div>
            <Label className="text-xs">Rodapé (opcional)</Label>
            <Input
              value={footer}
              onChange={(e) => setFooter(e.target.value)}
              className="mt-1.5 h-9"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={!name.trim() || !body.trim() || create.isPending}>
            {create.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Criar rascunho
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
