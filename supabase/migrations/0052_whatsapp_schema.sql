-- 0052_whatsapp_schema.sql — Módulo F3.1 · WhatsApp Cloud API. Idempotente.
-- Modelo de dados do módulo WhatsApp: conta (WABA) + números, templates, mídia,
-- conversas, mensagens, eventos de status e envelopes de webhook.
-- Multi-tenant por organization_id; RLS em 0055; RPCs em 0053; seeds em 0054.
--
-- SEGURANÇA: o access token da Meta NÃO fica em whatsapp_accounts (que membros
-- podem ler). Fica em whatsapp_credentials, sem policy de select p/ authenticated
-- (só service_role — worker/webhook). Assim o token nunca chega ao cliente.

-- ── Conta WhatsApp Business (WABA) ───────────────────────────────────────────
create table if not exists public.whatsapp_accounts (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  provider         text not null default 'meta' check (provider in ('meta','evolution')),
  waba_id          text,                                    -- WhatsApp Business Account ID (Meta)
  business_id      text,                                    -- Meta Business Manager ID
  name             text,
  status           text not null default 'connected'
                     check (status in ('connected','disconnected','error','pending')),
  webhook_verify_token text,                                -- verificação do webhook (por org)
  connected_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz
);
comment on table public.whatsapp_accounts is 'F3.1: conta WABA por organização. Token fica em whatsapp_credentials.';
create index if not exists idx_wa_accounts_org on public.whatsapp_accounts(organization_id) where deleted_at is null;
create unique index if not exists uq_wa_accounts_waba on public.whatsapp_accounts(organization_id, waba_id) where waba_id is not null;

-- ── Credenciais (segredo) — só service_role lê (sem policy select p/ authenticated)
create table if not exists public.whatsapp_credentials (
  account_id       uuid primary key references public.whatsapp_accounts(id) on delete cascade,
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  access_token     text,                                    -- System User token (Meta). Sensível.
  app_secret       text,
  rotated_at       timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
comment on table public.whatsapp_credentials is 'F3.1: segredos da conta WhatsApp. Sem policy de SELECT p/ authenticated — só service_role.';
create index if not exists idx_wa_credentials_org on public.whatsapp_credentials(organization_id);

-- ── Números de telefone sob a WABA ───────────────────────────────────────────
create table if not exists public.whatsapp_phone_numbers (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references public.organizations(id) on delete cascade,
  account_id            uuid not null references public.whatsapp_accounts(id) on delete cascade,
  phone_number_id       text not null,                      -- Phone Number ID (Meta)
  display_phone_number  text,                               -- +55 11 9....
  verified_name         text,
  quality_rating        text,                               -- GREEN/YELLOW/RED
  status                text not null default 'active'
                          check (status in ('active','inactive','flagged','pending')),
  is_default            boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index if not exists idx_wa_numbers_org on public.whatsapp_phone_numbers(organization_id);
create index if not exists idx_wa_numbers_account on public.whatsapp_phone_numbers(account_id);
create unique index if not exists uq_wa_numbers_pnid on public.whatsapp_phone_numbers(organization_id, phone_number_id);

-- ── Templates (definição data-driven em jsonb) ───────────────────────────────
create table if not exists public.whatsapp_templates (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  account_id       uuid references public.whatsapp_accounts(id) on delete set null,
  external_id      text,                                    -- ID do template na Meta
  name             text not null,
  language         text not null default 'pt_BR',
  category         text not null default 'UTILITY'
                     check (category in ('MARKETING','UTILITY','AUTHENTICATION')),
  status           text not null default 'pending'
                     check (status in ('pending','approved','rejected','paused','disabled')),
  components       jsonb not null default '[]'::jsonb,      -- header/body/footer/buttons
  rejected_reason  text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz
);
create index if not exists idx_wa_templates_org on public.whatsapp_templates(organization_id) where deleted_at is null;
create unique index if not exists uq_wa_templates_name on public.whatsapp_templates(organization_id, name, language);

-- ── Mídia (imagens/PDFs/áudios) ──────────────────────────────────────────────
create table if not exists public.whatsapp_media (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations(id) on delete cascade,
  external_media_id text,                                   -- media id na Meta
  direction         text not null check (direction in ('inbound','outbound')),
  mime_type         text,
  filename          text,
  size_bytes        bigint,
  sha256            text,
  storage_path      text,                                   -- caminho no Storage
  status            text not null default 'pending'
                      check (status in ('pending','stored','failed')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists idx_wa_media_org on public.whatsapp_media(organization_id);

-- ── Conversas (thread por contato/número) ────────────────────────────────────
create table if not exists public.conversations (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references public.organizations(id) on delete cascade,
  account_id            uuid references public.whatsapp_accounts(id) on delete set null,
  phone_number_id       uuid references public.whatsapp_phone_numbers(id) on delete set null,
  contact_wa_id         text not null,                      -- número do contato (wa_id)
  contact_name          text,
  customer_id           uuid references public.customers(id) on delete set null,  -- vínculo CRM
  status                text not null default 'open'
                          check (status in ('open','pending','closed')),
  assigned_to           uuid references auth.users(id) on delete set null,
  unread_count          int not null default 0,
  last_message_at       timestamptz,
  last_message_preview  text,
  last_inbound_at       timestamptz,                        -- base da janela de 24h
  window_expires_at     timestamptz,                        -- janela de atendimento (24h)
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  deleted_at            timestamptz
);
comment on table public.conversations is 'F3.1: thread de conversa WhatsApp por contato. window_expires_at = janela de 24h.';
create index if not exists idx_conversations_org on public.conversations(organization_id) where deleted_at is null;
create index if not exists idx_conversations_status on public.conversations(organization_id, status) where deleted_at is null;
create index if not exists idx_conversations_assigned on public.conversations(assigned_to) where deleted_at is null;
create index if not exists idx_conversations_customer on public.conversations(customer_id);
create index if not exists idx_conversations_last_msg on public.conversations(organization_id, last_message_at desc) where deleted_at is null;
create unique index if not exists uq_conversations_contact on public.conversations(organization_id, phone_number_id, contact_wa_id);

-- ── Mensagens ────────────────────────────────────────────────────────────────
create table if not exists public.messages (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  conversation_id  uuid not null references public.conversations(id) on delete cascade,
  direction        text not null check (direction in ('inbound','outbound')),
  wa_message_id    text,                                    -- ID na Meta (idempotência)
  type             text not null default 'text'
                     check (type in ('text','image','document','audio','video','sticker',
                                     'template','location','contacts','interactive','reaction','system')),
  body             text,
  media_id         uuid references public.whatsapp_media(id) on delete set null,
  template_id      uuid references public.whatsapp_templates(id) on delete set null,
  status           text not null default 'pending'
                     check (status in ('pending','sent','delivered','read','failed','received')),
  sender           text,                                    -- wa_id (inbound) ou agente
  sent_by          uuid references auth.users(id) on delete set null,  -- agente (outbound)
  payload          jsonb not null default '{}'::jsonb,      -- envelope neutro/bruto
  error            jsonb,
  payload_version  int not null default 1,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
comment on table public.messages is 'F3.1: mensagens. wa_message_id único por org (idempotência de ingestão/envio).';
create index if not exists idx_messages_conversation on public.messages(conversation_id, created_at);
create index if not exists idx_messages_org on public.messages(organization_id);
create index if not exists idx_messages_status on public.messages(organization_id, status) where direction = 'outbound';
create unique index if not exists uq_messages_wamid on public.messages(organization_id, wa_message_id) where wa_message_id is not null;

-- ── Eventos de status (sent/delivered/read/failed) — timeline/auditoria ──────
create table if not exists public.message_status_events (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  message_id       uuid not null references public.messages(id) on delete cascade,
  status           text not null check (status in ('sent','delivered','read','failed')),
  occurred_at      timestamptz not null default now(),
  raw              jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now()
);
create index if not exists idx_msg_status_message on public.message_status_events(message_id, occurred_at);
create index if not exists idx_msg_status_org on public.message_status_events(organization_id);
create unique index if not exists uq_msg_status on public.message_status_events(message_id, status);

-- ── Envelopes de webhook (idempotência + auditoria da ingestão) ──────────────
create table if not exists public.whatsapp_webhook_events (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid references public.organizations(id) on delete cascade,  -- resolvido após lookup
  provider         text not null default 'meta',
  event_type       text,                                    -- message | status | template | ...
  external_id      text,                                    -- id p/ dedup (wamid / status id)
  payload          jsonb not null default '{}'::jsonb,
  status           text not null default 'received'
                     check (status in ('received','processed','failed','ignored')),
  error            text,
  received_at      timestamptz not null default now(),
  processed_at     timestamptz
);
create index if not exists idx_wa_webhook_org on public.whatsapp_webhook_events(organization_id);
create index if not exists idx_wa_webhook_status on public.whatsapp_webhook_events(status);
create unique index if not exists uq_wa_webhook_external on public.whatsapp_webhook_events(provider, external_id) where external_id is not null;

-- ── Triggers updated_at ──────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array[
    'whatsapp_accounts','whatsapp_credentials','whatsapp_phone_numbers','whatsapp_templates',
    'whatsapp_media','conversations','messages'
  ] loop
    execute format('drop trigger if exists trg_%s_updated_at on public.%I', t, t);
    execute format(
      'create trigger trg_%s_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      t, t);
  end loop;
end $$;
