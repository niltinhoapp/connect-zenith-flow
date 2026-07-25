import { createFileRoute } from "@tanstack/react-router";
import { Sparkles, Send, Paperclip, Plus, MessageSquare, Wand2, FileText, BarChart3, Users } from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/ia")({
  head: () => ({
    meta: [
      { title: "IA Copilot — ConnectWeb" },
      { name: "description", content: "Copilot IA integrado ao seu workspace." },
    ],
  }),
  component: IAPage,
});

const threads = [
  { t: "Resumo semanal de vendas", ago: "há 2h" },
  { t: "Redigir proposta para Nexus", ago: "há 5h" },
  { t: "Segmentar clientes inativos", ago: "Ontem" },
  { t: "Analisar churn Q4", ago: "3 dias" },
  { t: "Sugestão de fluxo de cobrança", ago: "5 dias" },
];

const prompts = [
  { i: Users, t: "Quais clientes têm maior risco de churn?" },
  { i: BarChart3, t: "Gere um resumo de performance da semana" },
  { i: FileText, t: "Escreva uma mensagem de follow-up para leads frios" },
  { i: Wand2, t: "Crie uma automação para pós-venda" },
];

function IAPage() {
  return (
    <AppLayout>
      <div className="grid h-[calc(100vh-8rem)] grid-cols-1 overflow-hidden rounded-2xl border border-border bg-card lg:grid-cols-[280px_1fr]">
        <aside className="flex min-h-0 flex-col border-r border-border">
          <div className="border-b border-border p-4">
            <Button className="h-9 w-full rounded-lg bg-primary hover:bg-primary/90">
              <Plus className="mr-1.5 h-4 w-4" /> Nova conversa
            </Button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Recentes
            </p>
            <ul className="space-y-0.5">
              {threads.map((th, i) => (
                <li key={th.t}>
                  <button
                    className={
                      "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition-colors " +
                      (i === 0 ? "bg-primary/10 text-foreground ring-1 ring-inset ring-primary/25" : "text-muted-foreground hover:bg-accent/40 hover:text-foreground")
                    }
                  >
                    <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                    <span className="min-w-0 flex-1 truncate">{th.t}</span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">{th.ago}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div className="border-t border-border p-3">
            <div className="rounded-lg border border-primary/25 bg-primary/5 p-3">
              <p className="text-xs font-semibold">Plano Pro</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">142.320 créditos restantes</p>
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
                <p className="text-[11px] text-muted-foreground">Conectado ao seu workspace</p>
              </div>
            </div>
            <Badge className="rounded-md border-0 bg-muted text-[11px] text-muted-foreground">gpt-4o</Badge>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-8">
            <div className="mx-auto max-w-3xl space-y-6">
              <div className="text-center">
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary/15 text-primary ring-1 ring-inset ring-primary/25">
                  <Sparkles className="h-6 w-6" />
                </div>
                <h2 className="mt-4 text-2xl font-semibold tracking-tight">Como posso ajudar hoje?</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Peça análises, escreva mensagens, crie automações ou segmente sua base.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {prompts.map((p) => (
                  <button
                    key={p.t}
                    className="group flex items-start gap-3 rounded-xl border border-border bg-background p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5"
                  >
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary/20">
                      <p.i className="h-4 w-4" />
                    </div>
                    <p className="text-sm text-foreground">{p.t}</p>
                  </button>
                ))}
              </div>

              {/* Example exchange */}
              <div className="mt-8 space-y-6">
                <div className="flex gap-3">
                  <Avatar className="h-8 w-8 border border-border">
                    <AvatarFallback className="bg-muted text-[10px] font-semibold">RA</AvatarFallback>
                  </Avatar>
                  <div className="max-w-[80%] rounded-2xl rounded-tl-md bg-muted/60 px-4 py-2.5 text-sm">
                    Me dá um resumo da performance da semana.
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/15 text-primary ring-1 ring-inset ring-primary/25">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div className="max-w-[80%] space-y-3 text-sm">
                    <p>Aqui vai o resumo dos últimos 7 dias, Rafael:</p>
                    <ul className="space-y-1.5 text-muted-foreground">
                      <li>• <span className="text-foreground">Receita:</span> R$ 128.4k <span className="text-success">(+12,4%)</span></li>
                      <li>• <span className="text-foreground">Novos clientes:</span> 342 <span className="text-success">(+8,1%)</span></li>
                      <li>• <span className="text-foreground">Conversão:</span> 24,8%, com destaque para o canal WhatsApp</li>
                      <li>• <span className="text-foreground">Alerta:</span> 3 automações apresentaram falhas em etapas críticas</li>
                    </ul>
                    <p className="text-muted-foreground">Quer que eu detalhe algum ponto ou crie um relatório em PDF?</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-border bg-background/60 p-4">
            <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border border-border bg-card p-2.5">
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                <Paperclip className="h-4 w-4 text-muted-foreground" />
              </Button>
              <textarea
                rows={1}
                placeholder="Pergunte qualquer coisa ao Copilot..."
                className="max-h-40 min-h-[24px] flex-1 resize-none bg-transparent px-1 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none"
              />
              <Button size="icon" className="h-8 w-8 shrink-0 rounded-lg bg-primary hover:bg-primary/90">
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <p className="mx-auto mt-2 max-w-3xl text-center text-[10px] text-muted-foreground">
              O Copilot pode cometer erros. Verifique informações importantes.
            </p>
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
