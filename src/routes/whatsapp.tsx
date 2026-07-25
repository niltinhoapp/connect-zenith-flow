import { createFileRoute } from "@tanstack/react-router";
import { Search, Send, Paperclip, Smile, Phone, Video, MoreVertical, Check, CheckCheck, Circle, Zap } from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/whatsapp")({
  head: () => ({
    meta: [
      { title: "WhatsApp — ConnectWeb" },
      { name: "description", content: "Central omnichannel de WhatsApp com automações e IA." },
    ],
  }),
  component: WhatsAppPage,
});

const chats = [
  { n: "Mariana Costa", last: "Perfeito, vamos assinar hoje.", ago: "14:22", unread: 2, online: true, tag: "Cliente" },
  { n: "Diego Ramos", last: "Consegue enviar a proposta?", ago: "13:58", unread: 0, online: true, tag: "Lead" },
  { n: "Ana Beatriz", last: "Recebi a fatura, obrigada!", ago: "12:04", unread: 0, tag: "Cliente" },
  { n: "Rafael Andrade", last: "IA respondeu automaticamente", ago: "10:41", unread: 0, tag: "Bot" },
  { n: "Fernanda Lopes", last: "Marcar para amanhã?", ago: "09:12", unread: 5, online: true, tag: "VIP" },
  { n: "Studio Byte", last: "Enviamos os assets 🎨", ago: "Ontem", unread: 0 },
  { n: "Grão Digital", last: "Aguardando aprovação", ago: "Ontem", unread: 0 },
  { n: "Casa Verde", last: "Tudo certo por aqui.", ago: "Seg", unread: 0 },
];

const messages = [
  { me: false, t: "Oi Rafael! Vi a demo da automação — top demais.", ts: "14:12" },
  { me: false, t: "Consigo aplicar isso ainda hoje para o time de suporte?", ts: "14:12" },
  { me: true, t: "Com certeza, Mariana! Já preparei um template pronto pro seu caso.", ts: "14:15", status: "read" },
  { me: true, t: "Te envio o link em seguida.", ts: "14:15", status: "read" },
  { me: false, t: "Perfeito, vamos assinar hoje.", ts: "14:22" },
];

function WhatsAppPage() {
  return (
    <AppLayout>
      <div className="grid h-[calc(100vh-8rem)] grid-cols-1 overflow-hidden rounded-2xl border border-border bg-card lg:grid-cols-[320px_1fr_300px]">
        {/* Chats */}
        <aside className="flex min-h-0 flex-col border-r border-border">
          <div className="border-b border-border p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Conversas</h2>
              <Badge className="rounded-md border-0 bg-primary/15 text-[10px] font-semibold text-primary">
                7 abertas
              </Badge>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Buscar conversa..." className="h-9 rounded-lg border-border bg-background pl-8 text-sm" />
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {chats.map((c, i) => (
              <button
                key={c.n}
                className={cn(
                  "flex w-full items-center gap-3 border-b border-border/60 px-4 py-3 text-left transition-colors hover:bg-accent/40",
                  i === 0 && "bg-primary/5",
                )}
              >
                <div className="relative shrink-0">
                  <Avatar className="h-10 w-10 border border-border">
                    <AvatarFallback className="bg-muted text-xs font-semibold">
                      {c.n.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                    </AvatarFallback>
                  </Avatar>
                  {c.online && (
                    <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-success ring-2 ring-card" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium">{c.n}</p>
                    <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">{c.ago}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-xs text-muted-foreground">{c.last}</p>
                    {c.unread > 0 && (
                      <span className="grid h-4 min-w-4 shrink-0 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                        {c.unread}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </aside>

        {/* Conversation */}
        <section className="flex min-h-0 flex-col">
          <header className="flex items-center justify-between border-b border-border px-5 py-3">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10 border border-border">
                <AvatarFallback className="bg-primary/15 text-xs font-semibold text-primary">MC</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-semibold">Mariana Costa</p>
                <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span className="h-1.5 w-1.5 rounded-full bg-success" /> Online agora
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-9 w-9"><Phone className="h-4 w-4 text-muted-foreground" /></Button>
              <Button variant="ghost" size="icon" className="h-9 w-9"><Video className="h-4 w-4 text-muted-foreground" /></Button>
              <Button variant="ghost" size="icon" className="h-9 w-9"><MoreVertical className="h-4 w-4 text-muted-foreground" /></Button>
            </div>
          </header>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-6 subtle-grid">
            {messages.map((m, i) => (
              <div key={i} className={cn("flex", m.me ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[70%] rounded-2xl px-4 py-2.5 text-sm",
                    m.me
                      ? "rounded-br-md bg-primary text-primary-foreground"
                      : "rounded-bl-md border border-border bg-card text-foreground",
                  )}
                >
                  <p>{m.t}</p>
                  <div className={cn("mt-1 flex items-center justify-end gap-1 text-[10px]", m.me ? "text-primary-foreground/70" : "text-muted-foreground")}>
                    {m.ts}
                    {m.me && (m.status === "read" ? <CheckCheck className="h-3 w-3" /> : <Check className="h-3 w-3" />)}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-border bg-background/60 p-3">
            <div className="mb-2 flex flex-wrap gap-1.5 px-1">
              {["Enviar proposta", "Agendar reunião", "Boas-vindas", "Cobrança"].map((s) => (
                <button key={s} className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground">
                  {s}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2">
              <Button variant="ghost" size="icon" className="h-8 w-8"><Paperclip className="h-4 w-4 text-muted-foreground" /></Button>
              <Input placeholder="Digite uma mensagem..." className="h-8 border-0 bg-transparent p-0 text-sm focus-visible:ring-0" />
              <Button variant="ghost" size="icon" className="h-8 w-8"><Smile className="h-4 w-4 text-muted-foreground" /></Button>
              <Button size="icon" className="h-8 w-8 rounded-lg bg-primary hover:bg-primary/90"><Send className="h-4 w-4" /></Button>
            </div>
          </div>
        </section>

        {/* Contact panel */}
        <aside className="hidden min-h-0 flex-col border-l border-border lg:flex">
          <div className="flex flex-col items-center border-b border-border p-6 text-center">
            <Avatar className="h-16 w-16 border border-border">
              <AvatarFallback className="bg-primary/15 text-lg font-semibold text-primary">MC</AvatarFallback>
            </Avatar>
            <p className="mt-3 text-sm font-semibold">Mariana Costa</p>
            <p className="text-xs text-muted-foreground">Nexus Ltda. · Pro</p>
            <div className="mt-3 flex gap-1.5">
              <Badge className="rounded-md border-0 bg-success/10 text-[10px] text-success ring-1 ring-inset ring-success/25">Ativo</Badge>
              <Badge className="rounded-md border-0 bg-primary/10 text-[10px] text-primary">VIP</Badge>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-5">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Automações ativas</p>
            <ul className="mb-6 space-y-2">
              {["Boas-vindas · Ativa", "Roteamento IA · Ativa", "Renovação Q1 · Agendada"].map((a) => (
                <li key={a} className="flex items-center gap-2 rounded-lg border border-border bg-card p-2.5 text-xs">
                  <Zap className="h-3.5 w-3.5 text-primary" /> {a}
                </li>
              ))}
            </ul>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Métricas</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { l: "Msgs (30d)", v: "148" },
                { l: "Resposta", v: "1m 12s" },
                { l: "CSAT", v: "4.9" },
                { l: "NPS", v: "72" },
              ].map((k) => (
                <div key={k.l} className="rounded-lg border border-border bg-card p-3">
                  <p className="text-[10px] text-muted-foreground">{k.l}</p>
                  <p className="mt-0.5 text-sm font-semibold tabular-nums">{k.v}</p>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </AppLayout>
  );
}
