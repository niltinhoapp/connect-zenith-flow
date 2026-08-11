import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Plus,
  Sparkles,
  MessageCircle,
  Mail,
  Clock,
  Zap,
  UserPlus,
  Filter,
  MoreHorizontal,
  ArrowRight,
  Play,
  Copy,
  Trash2,
} from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { SectionCard } from "@/components/shared/section-card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  useAutomations,
  useSetAutomationStatus,
  useDuplicateAutomation,
  useDeleteAutomation,
  useTestAutomation,
  useGenerateFlow,
} from "@/features/automacoes/hooks/use-automacoes";

export const Route = createFileRoute("/automacoes")({
  head: () => ({
    meta: [
      { title: "Automações — ConnectWeb" },
      { name: "description", content: "Fluxos de automação drag-and-drop com IA integrada." },
    ],
  }),
  component: AutomacoesPage,
});

// Rótulo + ícone por tipo de gatilho (preserva o visual de "canal" da lista).
const TRIGGER_META: Record<string, { label: string; icon: typeof Zap }> = {
  "lead.created": { label: "Lead criado", icon: UserPlus },
  "lead.converted": { label: "Lead convertido", icon: UserPlus },
  "customer.created": { label: "Cliente criado", icon: UserPlus },
  "deal.created": { label: "Negócio criado", icon: Zap },
  "deal.stage.changed": { label: "Mudança de estágio", icon: Zap },
  "deal.won": { label: "Negócio ganho", icon: Zap },
  "whatsapp.message.received": { label: "WhatsApp recebido", icon: MessageCircle },
  "whatsapp.message.sent": { label: "WhatsApp enviado", icon: MessageCircle },
  manual: { label: "Manual", icon: Sparkles },
  scheduled: { label: "Agendado", icon: Clock },
};
const triggerMeta = (t: string) => TRIGGER_META[t] ?? { label: t || "—", icon: Mail };

function AutomacoesPage() {
  const [query, setQuery] = useState("");
  const { data: automations = [], isLoading } = useAutomations();
  const setStatus = useSetAutomationStatus();
  const duplicate = useDuplicateAutomation();
  const remove = useDeleteAutomation();
  const test = useTestAutomation();
  const generate = useGenerateFlow();
  const navigate = useNavigate();
  const [aiOpen, setAiOpen] = useState(false);
  const [aiText, setAiText] = useState("");

  function runGenerate() {
    if (aiText.trim().length < 4) return;
    generate.mutate(aiText.trim(), {
      onSuccess: (res) => {
        setAiOpen(false);
        setAiText("");
        navigate({ to: "/automacoes/builder", search: { id: res.id } });
      },
    });
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? automations.filter((a) => a.name.toLowerCase().includes(q)) : automations;
  }, [automations, query]);

  const activeCount = automations.filter((a) => a.status === "active").length;

  return (
    <AppLayout
      title="Automações"
      subtitle={`${automations.length} fluxos · ${activeCount} ativos`}
      actions={
        <>
          <Button variant="outline" className="h-9 rounded-lg border-border bg-card">
            <Filter className="mr-1.5 h-4 w-4" /> Filtrar
          </Button>
          <Button asChild className="h-9 rounded-lg bg-primary hover:bg-primary/90">
            <Link to="/automacoes/builder">
              <Plus className="mr-1.5 h-4 w-4" /> Nova automação
            </Link>
          </Button>
        </>
      }
    >
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        {[
          { l: "Fluxos ativos", v: String(activeCount) },
          { l: "Total de fluxos", v: String(automations.length) },
          { l: "Rascunhos", v: String(automations.filter((a) => a.status === "draft").length) },
        ].map((k) => (
          <div key={k.l} className="rounded-2xl border border-border bg-card p-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">{k.l}</p>
            <div className="mt-2 flex items-baseline gap-2">
              <p className="text-2xl font-semibold tabular-nums">{k.v}</p>
            </div>
          </div>
        ))}
      </div>

      <SectionCard
        title="Meus fluxos"
        description="Ative, pause ou edite suas automações"
        padded={false}
        action={
          <div className="w-56">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar automação..."
              className="h-8 rounded-lg border-border bg-background text-xs"
            />
          </div>
        }
      >
        {isLoading ? (
          <div className="px-5 py-10 text-center text-sm text-muted-foreground">Carregando…</div>
        ) : filtered.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-muted-foreground">
            Nenhuma automação. Clique em{" "}
            <span className="font-medium text-foreground">Nova automação</span> para começar.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((f) => {
              const meta = triggerMeta(f.trigger_type);
              const Icon = meta.icon;
              return (
                <li
                  key={f.id}
                  className="group flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-accent/20 md:flex-row md:items-center"
                >
                  <div className="flex flex-1 items-center gap-4">
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/20">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Link
                          to="/automacoes/builder"
                          search={{ id: f.id }}
                          className="truncate text-sm font-medium hover:underline"
                        >
                          {f.name}
                        </Link>
                        <Badge className="rounded-md border-0 bg-muted text-[10px] text-muted-foreground">
                          {meta.label}
                        </Badge>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {f.description || `Versão ${f.current_version}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6 text-xs md:pl-4">
                    <div className="text-right">
                      <p className="text-muted-foreground">Versão</p>
                      <p className="font-semibold tabular-nums text-foreground">
                        v{f.current_version}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-muted-foreground">Status</p>
                      <p className="font-semibold tabular-nums text-foreground">
                        {f.status === "active"
                          ? "Ativa"
                          : f.status === "paused"
                            ? "Pausada"
                            : "Rascunho"}
                      </p>
                    </div>
                    <Switch
                      checked={f.status === "active"}
                      disabled={setStatus.isPending}
                      onCheckedChange={(on) =>
                        setStatus.mutate({ id: f.id, status: on ? "active" : "paused" })
                      }
                    />
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 opacity-0 group-hover:opacity-100"
                        >
                          <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem onSelect={() => test.mutate({ id: f.id })}>
                          <Play className="mr-2 h-4 w-4" /> Testar fluxo
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => duplicate.mutate(f.id)}>
                          <Copy className="mr-2 h-4 w-4" /> Duplicar
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onSelect={() => {
                            if (window.confirm(`Excluir a automação "${f.name}"?`))
                              remove.mutate(f.id);
                          }}
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>

      <div className="mt-6 rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/10 to-transparent p-6">
        <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
          <div className="flex items-start gap-4">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/20 text-primary ring-1 ring-inset ring-primary/30">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold">Peça à IA para criar uma automação</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Descreva o que precisa em linguagem natural — nós montamos o fluxo pra você.
              </p>
            </div>
          </div>
          <Button
            className="h-9 rounded-lg bg-primary hover:bg-primary/90"
            onClick={() => setAiOpen(true)}
          >
            Gerar com IA <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
        </div>
      </div>

      <Dialog
        open={aiOpen}
        onOpenChange={(o) => {
          if (!generate.isPending) setAiOpen(o);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> Gerar automação com IA
            </DialogTitle>
            <DialogDescription>
              Descreva o fluxo em português. A IA monta o rascunho — você revisa e ativa no builder.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            autoFocus
            value={aiText}
            onChange={(e) => setAiText(e.target.value)}
            rows={5}
            className="text-sm"
            placeholder="Ex.: Quando um lead é criado pelo WhatsApp, se a origem for 'site', enviar uma mensagem de boas-vindas e criar uma nota no CRM."
            disabled={generate.isPending}
          />
          {generate.isError && (
            <p className="text-xs text-destructive">
              {(generate.error as Error)?.message ??
                "Falha ao gerar. Verifique se a IA está configurada."}
            </p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAiOpen(false)}
              disabled={generate.isPending}
            >
              Cancelar
            </Button>
            <Button
              onClick={runGenerate}
              disabled={generate.isPending || aiText.trim().length < 4}
              className="bg-primary hover:bg-primary/90"
            >
              {generate.isPending ? "Gerando…" : "Gerar rascunho"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
