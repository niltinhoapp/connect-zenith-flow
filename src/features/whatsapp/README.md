# Módulo WhatsApp (F3.1)

Integração com a **WhatsApp Cloud API** (Meta), atrás da interface `WhatsAppProvider`
(trocável por Evolution sem alterar o módulo). Consome só o `@/core`; fala com
outros módulos apenas por **Event Bus** (`whatsapp.*`).

## Camadas

```
UI (F3.1.1) → hooks → InboxApplicationService / MessagingApplicationService
                          → RPC (wa_send_message, assign_conversation, …)
                          → Repositories (conversations, messages)
Worker → job whatsapp.send → wa_send_context → WhatsAppProvider (Meta) → wa_mark_sent/failed
Webhook (F3.1.2) → wa_ingest_inbound / wa_apply_status → publish_event (outbox)
```

## Fluxo de envio (assíncrono, idempotente, com cota)

1. `MessagingApplicationService.sendText/sendTemplate` → RPC **`wa_send_message`**.
2. A RPC: `has_permission(whatsapp.send)` → **`try_consume_quota('messages')`** (atômico)
   → cria `messages` (pending) → **`enqueue_job('whatsapp.send')`** (idempotency `whatsapp.send:<id>`).
3. O **Worker** consome: `wa_send_context` (traz o token, só `service_role`) →
   `claim_idempotency` (despacho único) → `WhatsAppProvider.send*` → `wa_mark_sent`
   (grava `wa_message_id`) ou `wa_mark_failed`. Erro 4xx = permanente; rede/5xx = retry.
4. Status de entrega (sent/delivered/read/failed) chegam por webhook →
   `wa_apply_status` → `publish_event('whatsapp.message.<status>')`.

## Tabelas

`whatsapp_accounts` · `whatsapp_credentials` (segredo, sem SELECT p/ cliente) ·
`whatsapp_phone_numbers` · `whatsapp_templates` · `whatsapp_media` ·
`conversations` (janela de 24h) · `messages` (idempotência por `wa_message_id`) ·
`message_status_events` · `whatsapp_webhook_events`.

## Eventos (Event Bus)

`whatsapp.message.received/sent/delivered/read/failed` ·
`whatsapp.conversation.opened/assigned/closed` · `whatsapp.template.approved/rejected`.

## Permissões

`whatsapp.read` · `whatsapp.send` · `whatsapp.assign` · `whatsapp.templates.manage` · `whatsapp.connect`.

## Multi-tenant

Todo acesso é escopado pela `organizationId` ativa e protegido por RLS. O servidor
deriva a org da sessão — nunca confie num org id vindo do cliente. Credenciais
(token) ficam em `whatsapp_credentials`, sem policy de SELECT para `authenticated`.

## Status

- **F3.1.0 (feito):** schema + RLS + RPCs + seeds + job_types; domínio
  (Conversation/Message/WaContact) + repositories + Application Services;
  `WhatsAppProvider` (Meta adapter + Evolution stub) + handler `whatsapp.send`.
- **F3.1.1 (próximo):** Inbox UI + hooks (lista, thread, envio, atribuição).
- **F3.1.2:** Embedded Signup + endpoint de webhook (verify + ingestão) + sync de templates.
  Requer credenciais Meta (System User token, app secret) por organização.
