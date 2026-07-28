# Edge Functions — WhatsApp (F3.1)

Infraestrutura **real** (sem mocks) da integração oficial da Meta. Quando você
tiver as credenciais, é só configurar os secrets e validar o fluxo.

## Funções

| Função | JWT | Papel |
| --- | --- | --- |
| `whatsapp-webhook` | não | Recebe mensagens/status da Meta (GET verify + POST). Valida `X-Hub-Signature-256`, roteia ao tenant e persiste via RPC. |
| `whatsapp-connect` | sim | Conecta uma WABA à organização (Embedded Signup `code` **ou** token manual). Assina o webhook e grava conta/número/credencial. |

## 1. Secrets (uma vez)

```bash
supabase secrets set \
  META_APP_ID=xxxxxxxxxxxx \
  META_APP_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx \
  WHATSAPP_APP_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx \
  WHATSAPP_WEBHOOK_VERIFY_TOKEN=uma-string-secreta-sua \
  WHATSAPP_GRAPH_VERSION=v21.0
```

> `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` já são
> injetados automaticamente nas functions.

## 2. Deploy

```bash
supabase functions deploy whatsapp-webhook --no-verify-jwt
supabase functions deploy whatsapp-connect
```

URL do webhook (registrar no painel da Meta > WhatsApp > Configuration):

```
https://<PROJECT_REF>.functions.supabase.co/whatsapp-webhook
```

- **Callback URL:** a URL acima
- **Verify token:** o mesmo `WHATSAPP_WEBHOOK_VERIFY_TOKEN`
- **Campos:** assine `messages`

## 3. Validação do fluxo completo

1. **Conectar WABA** — POST para `whatsapp-connect` com o JWT de um usuário
   `owner`/`admin` (permissão `whatsapp.connect`):

   ```bash
   curl -X POST https://<REF>.functions.supabase.co/whatsapp-connect \
     -H "Authorization: Bearer <JWT_DO_USUARIO>" \
     -H "Content-Type: application/json" \
     -d '{"organizationId":"<ORG>","mode":"manual",
          "accessToken":"<SYSTEM_USER_TOKEN>",
          "wabaId":"<WABA_ID>","phoneNumberId":"<PHONE_NUMBER_ID>"}'
   ```

   (Modo Embedded Signup: `{"mode":"embedded","code":"<CODE>","wabaId":...,"phoneNumberId":...}`.)
   → grava `whatsapp_accounts` + `whatsapp_phone_numbers` + `whatsapp_credentials`.

2. **Receber webhook** — envie uma mensagem do seu celular para o número.
   A Meta chama `whatsapp-webhook` → `wa_ingest_inbound` → a conversa aparece na
   Inbox (evento `whatsapp.message.received`).

3. **Enrolar o worker** (envio/relay): `npm run worker` (usa `.env` local com a
   service role). Ele consome os jobs `whatsapp.send` e o outbox.

4. **Enviar mensagem** — pela Inbox (ou `wa_send_message`) → job `whatsapp.send`
   → worker → Graph API → grava `wa_message_id` (`sent`).

5. **Receber status** — a Meta chama o webhook com `sent/delivered/read` →
   `wa_apply_status` → ticks atualizam na UI. Tudo persiste em `messages` +
   `message_status_events`.

## Arquitetura (sem mock)

```
Meta ──(webhook)──> whatsapp-webhook ──RPC──> wa_ingest_inbound / wa_apply_status ──> DB ──> Event Bus
UI  ──> wa_send_message ──> job whatsapp.send ──> worker ──> Graph API ──> wa_mark_sent/failed ──> DB
Embedded Signup ──> whatsapp-connect ──> wa_store_connection ──> conta+número+credencial (token só service_role)
```
