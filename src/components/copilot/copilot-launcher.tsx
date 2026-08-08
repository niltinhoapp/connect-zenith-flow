/**
 * Copilot Launcher — botão global flutuante + painel "Ajuda + IA".
 * Frente Claude (experiência): onboarding guiado, ajuda contextual da rota e
 * as ações da IA (listadas/executadas pela plataforma do Core — Codex).
 */
import { useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Sparkles, HelpCircle, ArrowRight, CheckCircle2, Circle, Loader2, ShieldAlert, MessageSquare, Copy, Check } from "lucide-react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { helpForRoute } from "./route-help";
import { ONBOARDING_STEPS, useOnboarding } from "./onboarding";
import { useCopilot } from "./use-copilot";
import { useInsertDraft } from "./copilot-focus";

const RISK_LABEL: Record<string, string> = { read: "Consulta", write: "Ação", external: "IA" };
const RISK_CLS: Record<string, string> = {
  read: "bg-muted text-muted-foreground",
  write: "bg-warning/15 text-warning ring-1 ring-inset ring-warning/25",
  external: "bg-primary/15 text-primary ring-1 ring-inset ring-primary/25",
};

/** Ferramentas de IA da conversa: só aparecem no WhatsApp com conversa selecionada. */
const WHATSAPP_ASSIST = new Set<string>([
  "whatsapp.conversation.summarize",
  "whatsapp.reply.draft",
]);

export function CopilotLauncher() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const help = helpForRoute(pathname);
  const { org, tools, state, run, confirm, cancelConfirm, clear, focus } = useCopilot();
  const onboarding = useOnboarding(org);
  const insertDraft = useInsertDraft();
  const [copied, setCopied] = useState(false);

  const onWhatsApp = pathname.startsWith("/whatsapp");
  const hasConversation = focus?.type === "conversation";
  // As ferramentas de IA da conversa só aparecem no WhatsApp com conversa ativa.
  const visibleTools = tools.filter(
    (t) => !WHATSAPP_ASSIST.has(t.name) || (onWhatsApp && hasConversation),
  );

  const go = (to: string) => { navigate({ to: to as never }); setOpen(false); };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard?.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard indisponível — o texto continua visível para cópia manual */
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          aria-label="Ajuda e IA"
          className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/25 transition-transform hover:scale-105"
        >
          <Sparkles className="h-4 w-4" /> Ajuda + IA
        </button>
      </SheetTrigger>

      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border p-5">
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> Ajuda + IA
          </SheetTitle>
          <SheetDescription>Seu copiloto: te guia e faz tarefas por você.</SheetDescription>
        </SheetHeader>

        <Tabs defaultValue="passos" className="flex min-h-0 flex-1 flex-col">
          <TabsList className="mx-5 mt-3 grid grid-cols-3">
            <TabsTrigger value="passos" className="text-xs">Primeiros passos</TabsTrigger>
            <TabsTrigger value="ajuda" className="text-xs">Ajuda</TabsTrigger>
            <TabsTrigger value="ia" className="text-xs">IA</TabsTrigger>
          </TabsList>

          <ScrollArea className="min-h-0 flex-1 px-5 py-4">
            {/* ── Primeiros passos ─────────────────────────────────────── */}
            <TabsContent value="passos" className="mt-0 space-y-4">
              <div>
                <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Implantação</span>
                  <span className="tabular-nums">{onboarding.completed}/{onboarding.total}</span>
                </div>
                <Progress value={onboarding.percent} className="h-2" />
              </div>
              {onboarding.allDone && (
                <div className="rounded-lg border border-success/25 bg-success/10 p-3 text-xs text-success">
                  🎉 Tudo pronto! Seu ConnectWeb está configurado.
                </div>
              )}
              <ul className="space-y-2">
                {ONBOARDING_STEPS.map((step) => {
                  const done = onboarding.done[step.id];
                  return (
                    <li key={step.id} className="rounded-xl border border-border bg-card p-3">
                      <div className="flex items-start gap-3">
                        <button onClick={() => onboarding.toggle(step.id)} className="mt-0.5 shrink-0" aria-label="Concluir passo">
                          {done ? <CheckCircle2 className="h-5 w-5 text-success" /> : <Circle className="h-5 w-5 text-muted-foreground" />}
                        </button>
                        <div className="min-w-0 flex-1">
                          <p className={cn("text-sm font-medium", done && "text-muted-foreground line-through")}>{step.title}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">{step.desc}</p>
                          <Button variant="ghost" size="sm" className="mt-1 h-7 gap-1 px-2 text-[11px] text-primary" onClick={() => go(step.to)}>
                            {step.cta} <ArrowRight className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </TabsContent>

            {/* ── Ajuda contextual da rota ─────────────────────────────── */}
            <TabsContent value="ajuda" className="mt-0 space-y-3">
              <div className="flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">{help.title}</h3>
              </div>
              <p className="text-xs text-muted-foreground">{help.intro}</p>
              <ul className="space-y-1.5">
                {help.tips.map((t, i) => (
                  <li key={i} className="flex gap-2 text-xs">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
              {help.links && help.links.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {help.links.map((l) => (
                    <Button key={l.to} variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={() => go(l.to)}>
                      {l.label} <ArrowRight className="h-3 w-3" />
                    </Button>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* ── Ações da IA (via Core) ───────────────────────────────── */}
            <TabsContent value="ia" className="mt-0 space-y-3">
              {focus?.type === "conversation" && (
                <div className="flex items-center gap-2 rounded-lg border border-primary/25 bg-primary/5 px-3 py-2 text-xs text-primary">
                  <MessageSquare className="h-3.5 w-3.5" />
                  <span>Contexto: {focus.label ?? "conversa selecionada"}</span>
                </div>
              )}
              {state.result && (() => {
                const r = state.result;
                const isDraft = r.tool === "whatsapp.reply.draft";
                const isSummary = r.tool === "whatsapp.conversation.summarize";
                const isAssist = isDraft || isSummary;
                const heading = isDraft
                  ? "Rascunho de resposta"
                  : isSummary
                    ? "Resumo da conversa"
                    : "Resultado";
                return (
                  <div className="rounded-lg border border-primary/25 bg-primary/5 p-3">
                    <p className="mb-1 flex items-center gap-1 text-[11px] font-medium text-primary">
                      <Sparkles className="h-3 w-3" /> {heading}
                    </p>
                    <p className="max-h-48 overflow-y-auto whitespace-pre-wrap text-xs text-foreground">
                      {r.summary}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {isAssist && (
                        <Button
                          size="sm" variant="outline"
                          className="h-7 gap-1 text-[11px]"
                          onClick={() => void copy(r.summary)}
                        >
                          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                          {copied ? "Copiado" : "Copiar"}
                        </Button>
                      )}
                      {isDraft && (
                        <Button
                          size="sm"
                          className="h-7 gap-1 text-[11px]"
                          onClick={() => { if (insertDraft(r.summary)) { clear(); setOpen(false); } }}
                        >
                          Inserir no campo <ArrowRight className="h-3 w-3" />
                        </Button>
                      )}
                      {!isAssist && r.navigateTo && (
                        <Button size="sm" className="h-7 gap-1 text-[11px]" onClick={() => go(r.navigateTo!)}>
                          Abrir <ArrowRight className="h-3 w-3" />
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" className="h-7 text-[11px]" onClick={clear}>Fechar</Button>
                    </div>
                  </div>
                );
              })()}
              {state.error && <p className="rounded-lg bg-destructive/10 p-3 text-xs text-destructive">{state.error}</p>}

              {onWhatsApp && !hasConversation && (
                <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                  <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                  Selecione uma conversa para usar a IA.
                </div>
              )}

              {visibleTools.length === 0 ? (
                onWhatsApp && !hasConversation ? null : (
                  <p className="text-xs text-muted-foreground">
                    Nenhuma ação da IA disponível para o seu perfil/tela ainda. Explore as abas “Primeiros passos” e “Ajuda”.
                  </p>
                )
              ) : (
                <ul className="space-y-2">
                  {visibleTools.map((tool) => (
                    <li key={tool.name} className="rounded-xl border border-border bg-card p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{tool.title}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">{tool.description}</p>
                        </div>
                        <Badge className={cn("shrink-0 rounded-md border-0 text-[10px]", RISK_CLS[tool.risk])}>
                          {RISK_LABEL[tool.risk] ?? tool.risk}
                        </Badge>
                      </div>
                      <Button
                        size="sm" variant="outline"
                        className="mt-2 h-7 gap-1 text-[11px]"
                        disabled={state.running === tool.name}
                        onClick={() => run(tool)}
                      >
                        {state.running === tool.name ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                        {state.running === tool.name ? "Executando…" : "Executar"}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </SheetContent>

      {/* Confirmação obrigatória para ações de risco (o Core exige) */}
      <AlertDialog open={!!state.pendingConfirm} onOpenChange={(o) => { if (!o) cancelConfirm(); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {state.pendingConfirm?.risk === "external"
                ? <><Sparkles className="h-4 w-4 text-primary" /> Processar com IA</>
                : <><ShieldAlert className="h-4 w-4 text-warning" /> Confirmar ação</>}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {state.pendingConfirm?.risk === "external" ? (
                <>
                  O conteúdo desta conversa será enviado à IA para gerar{" "}
                  <span className="font-medium text-foreground">{state.pendingConfirm?.title}</span>.
                  Nada é alterado e nenhuma mensagem é enviada ao cliente — o resultado fica só para você revisar.
                </>
              ) : (
                <>
                  A ação <span className="font-medium text-foreground">{state.pendingConfirm?.title}</span> faz alterações.
                  Deseja executar agora?
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelConfirm}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirm}>
              {state.pendingConfirm?.risk === "external" ? "Processar com IA" : "Confirmar e executar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  );
}
