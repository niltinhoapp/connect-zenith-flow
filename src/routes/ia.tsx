import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Sparkles, Send, Plus, Wand2, BarChart3, Users, BriefcaseBusiness,
  Loader2, ShieldAlert, ArrowRight,
} from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { useCopilot } from "@/components/copilot/use-copilot";
import { useCopilotPrompt } from "@/components/copilot/use-copilot-prompt";

export const Route = createFileRoute("/ia")({
  head: () => ({
    meta: [
      { title: "IA Copilot — ConnectWeb" },
      { name: "description", content: "Copilot IA integrado ao seu workspace." },
    ],
  }),
  component: IAPage,
});

const suggestions = [
  { icon: Users, text: "Analise a situação da minha base de clientes" },
  { icon: BarChart3, text: "Mostre um resumo das métricas do painel" },
  { icon: BriefcaseBusiness, text: "Analise meu funil de vendas" },
  { icon: Wand2, text: "Crie 5 clientes fictícios para testar o CRM" },
];

function IAPage() {
  const navigate = useNavigate();
  const { org, tools, state, runWithInput, confirm, cancelConfirm, clear } = useCopilot();
  const { interpret, interpreting, error: promptError, clearError } = useCopilotPrompt(org);
  const [prompt, setPrompt] = useState("");
  const [lastPrompt, setLastPrompt] = useState<string | null>(null);
  const [answer, setAnswer] = useState<string | null>(null);

  const reset = () => {
    setPrompt("");
    setLastPrompt(null);
    setAnswer(null);
    clearError();
    clear();
  };

  const submit = async (text = prompt) => {
    const request = text.trim();
    if (!request || interpreting || state.running) return;
    setPrompt(request);
    setLastPrompt(request);
    setAnswer(null);
    clearError();
    clear();

    const prepared = await interpret(request);
    if (!prepared) return;
    if (prepared.action === "none") {
      setAnswer(prepared.message);
      return;
    }
    const tool = tools.find((item) => item.name === prepared.action);
    if (!tool) {
      setAnswer("Essa ação não está disponível para seu perfil ou para os módulos ativos da empresa.");
      return;
    }
    setAnswer(prepared.message);
    await runWithInput(tool, prepared.input, prepared.preview);
  };

  const busy = interpreting || Boolean(state.running);
  const response = state.result?.summary ?? state.error ?? promptError ?? answer;

  return (
    <AppLayout>
      <div className="grid h-[calc(100vh-8rem)] grid-cols-1 overflow-hidden rounded-2xl border border-border bg-card lg:grid-cols-[280px_1fr]">
        <aside className="flex min-h-0 flex-col border-r border-border">
          <div className="border-b border-border p-4">
            <Button className="h-9 w-full rounded-lg" onClick={reset}>
              <Plus className="mr-1.5 h-4 w-4" /> Nova conversa
            </Button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              O que já posso fazer
            </p>
            <ul className="space-y-2">
              {tools
                .filter((tool) => !tool.name.startsWith("whatsapp."))
                .map((tool) => (
                  <li key={tool.name} className="rounded-lg border border-border bg-background p-3">
                    <p className="text-xs font-medium">{tool.title}</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{tool.description}</p>
                  </li>
                ))}
            </ul>
          </div>
          <div className="border-t border-border p-3">
            <div className="rounded-lg border border-primary/25 bg-primary/5 p-3">
              <p className="text-xs font-semibold">Uso seguro</p>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                Consultas usam dados reais da empresa. Alterações sempre pedem confirmação.
              </p>
            </div>
          </div>
        </aside>

        <section className="flex min-h-0 flex-col">
          <header className="flex items-center justify-between border-b border-border px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/15 text-primary ring-1 ring-inset ring-primary/25">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold">ConnectWeb Copilot</p>
                <p className="text-[11px] text-muted-foreground">Conectado aos dados da empresa ativa</p>
              </div>
            </div>
            <Badge className="rounded-md border-0 bg-success/15 text-[11px] text-success">Ativo</Badge>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-8">
            <div className="mx-auto max-w-3xl space-y-6">
              {!lastPrompt ? (
                <>
                  <div className="text-center">
                    <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary/15 text-primary ring-1 ring-inset ring-primary/25">
                      <Sparkles className="h-6 w-6" />
                    </div>
                    <h2 className="mt-4 text-2xl font-semibold tracking-tight">Como posso ajudar hoje?</h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Consulte seu painel, clientes, relatórios e CRM ou prepare novos contatos.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {suggestions.map((suggestion) => (
                      <button
                        key={suggestion.text}
                        className="group flex items-start gap-3 rounded-xl border border-border bg-background p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40"
                        onClick={() => { setPrompt(suggestion.text); void submit(suggestion.text); }}
                      >
                        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary/20">
                          <suggestion.icon className="h-4 w-4" />
                        </div>
                        <p className="text-sm text-foreground">{suggestion.text}</p>
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div className="space-y-6">
                  <div className="ml-auto max-w-[85%] rounded-2xl rounded-tr-md bg-primary px-4 py-3 text-sm text-primary-foreground">
                    {lastPrompt}
                  </div>
                  <div className="flex gap-3">
                    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/15 text-primary ring-1 ring-inset ring-primary/25">
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    </div>
                    <div className={cn(
                      "max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-tl-md px-4 py-3 text-sm",
                      state.error || promptError ? "bg-destructive/10 text-destructive" : "bg-muted/60 text-foreground",
                    )}>
                      {busy ? "Estou consultando os dados e preparando uma resposta…" : response ?? "Pedido preparado para sua confirmação."}
                      {state.result?.navigateTo && (
                        <Button
                          size="sm"
                          className="mt-3 flex h-8 gap-1.5 text-xs"
                          onClick={() => navigate({ to: state.result!.navigateTo as never })}
                        >
                          Abrir módulo <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-border bg-background/60 p-4">
            <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border border-border bg-card p-2.5">
              <textarea
                rows={1}
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void submit();
                  }
                }}
                disabled={busy}
                placeholder="Peça uma análise ou uma ação ao Copilot…"
                className="max-h-40 min-h-[24px] flex-1 resize-none bg-transparent px-2 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none"
              />
              <Button
                size="icon"
                className="h-8 w-8 shrink-0 rounded-lg"
                disabled={!prompt.trim() || busy}
                onClick={() => void submit()}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
            <p className="mx-auto mt-2 max-w-3xl text-center text-[10px] text-muted-foreground">
              A IA prepara ações; você confirma antes de qualquer alteração.
            </p>
          </div>
        </section>
      </div>

      <AlertDialog open={Boolean(state.pendingConfirm)} onOpenChange={(open) => { if (!open) cancelConfirm(); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-warning" /> Confirmar ação
            </AlertDialogTitle>
            <AlertDialogDescription>
              <span className="block">
                A ação <span className="font-medium text-foreground">{state.pendingConfirm?.tool.title}</span> fará alterações.
              </span>
              {state.pendingConfirm?.preview && (
                <span className="mt-3 block max-h-72 overflow-y-auto whitespace-pre-wrap rounded-lg bg-muted p-3 text-foreground">
                  {state.pendingConfirm.preview}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelConfirm}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirm}>Confirmar e executar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
