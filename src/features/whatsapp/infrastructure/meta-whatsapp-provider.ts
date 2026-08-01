import type {
  WhatsAppProvider,
  WhatsAppCredentials,
  WhatsAppSendResult,
  WhatsAppWebhookBatch,
  WhatsAppInboundMessage,
  WhatsAppStatusUpdate,
} from "@/core/integrations/providers/types";

const GRAPH_VERSION = "v21.0";

type Json = Record<string, unknown>;

function graphUrl(phoneNumberId: string): string {
  return `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`;
}

async function postGraph(cred: WhatsAppCredentials, body: Json): Promise<WhatsAppSendResult> {
  const res = await fetch(graphUrl(cred.phoneNumberId), {
    method: "POST",
    headers: { Authorization: `Bearer ${cred.accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", ...body }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    messages?: { id: string }[];
    error?: { message?: string };
  };
  if (!res.ok) {
    throw new Error(`meta ${res.status}: ${data?.error?.message ?? "erro no envio"}`);
  }
  const externalId = data.messages?.[0]?.id;
  if (!externalId) throw new Error("meta: resposta sem message id");
  return { externalId };
}

/** Coerção segura de qualquer valor a Record. */
function obj(v: unknown): Json {
  return v && typeof v === "object" ? (v as Json) : {};
}
function arr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

/**
 * MetaWhatsAppProvider — adapter da WhatsApp Cloud API (Meta) atrás da interface
 * WhatsAppProvider. Stateless: recebe as credenciais por chamada (resolvidas pelo
 * worker via service_role). Trocável por Evolution sem alterar os módulos.
 */
export class MetaWhatsAppProvider implements WhatsAppProvider {
  readonly kind = "whatsapp" as const;
  readonly vendor = "meta";

  sendText(input: {
    credentials: WhatsAppCredentials;
    to: string;
    body: string;
  }): Promise<WhatsAppSendResult> {
    return postGraph(input.credentials, {
      to: input.to,
      type: "text",
      text: { preview_url: false, body: input.body },
    });
  }

  sendTemplate(input: {
    credentials: WhatsAppCredentials;
    to: string;
    templateName: string;
    language: string;
    components?: unknown[];
  }): Promise<WhatsAppSendResult> {
    return postGraph(input.credentials, {
      to: input.to,
      type: "template",
      template: {
        name: input.templateName,
        language: { code: input.language },
        ...(input.components?.length ? { components: input.components } : {}),
      },
    });
  }

  async markRead(input: { credentials: WhatsAppCredentials; externalId: string }): Promise<void> {
    const res = await fetch(graphUrl(input.credentials.phoneNumberId), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.credentials.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        status: "read",
        message_id: input.externalId,
      }),
    });
    if (!res.ok) throw new Error(`meta markRead ${res.status}`);
  }

  async uploadMedia(input: {
    credentials: WhatsAppCredentials;
    bytes: Uint8Array;
    mime: string;
    filename?: string;
  }): Promise<{ mediaId: string }> {
    const form = new FormData();
    form.append("messaging_product", "whatsapp");
    form.append("type", input.mime);
    // Blob a partir do binário (funciona no worker/edge; sem depender de fs).
    form.append(
      "file",
      new Blob([input.bytes as unknown as BlobPart], { type: input.mime }),
      input.filename ?? "file",
    );
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${input.credentials.phoneNumberId}/media`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${input.credentials.accessToken}` },
        body: form,
      },
    );
    const data = (await res.json().catch(() => ({}))) as {
      id?: string;
      error?: { message?: string };
    };
    if (!res.ok || !data.id)
      throw new Error(`meta upload ${res.status}: ${data?.error?.message ?? "sem id"}`);
    return { mediaId: data.id };
  }

  sendMedia(input: {
    credentials: WhatsAppCredentials;
    to: string;
    type: "image" | "audio" | "document";
    mediaId: string;
    caption?: string | null;
    filename?: string | null;
  }): Promise<WhatsAppSendResult> {
    const mediaObj: Record<string, unknown> = { id: input.mediaId };
    if (input.caption && (input.type === "image" || input.type === "document"))
      mediaObj.caption = input.caption;
    if (input.filename && input.type === "document") mediaObj.filename = input.filename;
    return postGraph(input.credentials, { to: input.to, type: input.type, [input.type]: mediaObj });
  }

  async downloadMedia(input: {
    credentials: WhatsAppCredentials;
    mediaId: string;
  }): Promise<{ bytes: Uint8Array; mime: string }> {
    const auth = { Authorization: `Bearer ${input.credentials.accessToken}` };
    const metaRes = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${input.mediaId}`, {
      headers: auth,
    });
    const meta = (await metaRes.json().catch(() => ({}))) as { url?: string; mime_type?: string };
    if (!metaRes.ok || !meta.url) throw new Error(`meta media meta ${metaRes.status}`);
    const binRes = await fetch(meta.url, { headers: auth });
    if (!binRes.ok) throw new Error(`meta media download ${binRes.status}`);
    return {
      bytes: new Uint8Array(await binRes.arrayBuffer()),
      mime: meta.mime_type ?? "application/octet-stream",
    };
  }

  parseWebhook(payload: unknown): WhatsAppWebhookBatch {
    const messages: WhatsAppInboundMessage[] = [];
    const statuses: WhatsAppStatusUpdate[] = [];

    for (const entry of arr(obj(payload).entry)) {
      for (const change of arr(obj(entry).changes)) {
        const value = obj(obj(change).value);
        const phoneNumberId = String(obj(value.metadata).phone_number_id ?? "");
        const contacts = arr(value.contacts).map(obj);
        const contactName = contacts.length
          ? String(obj(contacts[0].profile).name ?? "") || null
          : null;

        for (const raw of arr(value.messages).map(obj)) {
          const type = String(raw.type ?? "text") as WhatsAppInboundMessage["type"];
          messages.push({
            from: String(raw.from ?? ""),
            contactName,
            externalId: String(raw.id ?? ""),
            type,
            body: extractBody(raw, type),
            mediaId: extractMediaId(raw, type),
            phoneNumberId,
            raw,
          });
        }

        for (const raw of arr(value.statuses).map(obj)) {
          const status = String(raw.status ?? "") as WhatsAppStatusUpdate["status"];
          if (!["sent", "delivered", "read", "failed"].includes(status)) continue;
          statuses.push({
            externalId: String(raw.id ?? ""),
            status,
            occurredAt: tsToIso(raw.timestamp),
            raw,
          });
        }
      }
    }
    return { messages, statuses };
  }
}

function extractBody(raw: Json, type: string): string | null {
  if (type === "text") return String(obj(raw.text).body ?? "") || null;
  if (type === "button") return String(obj(raw.button).text ?? "") || null;
  const caption = obj((raw as Json)[type]).caption;
  return caption ? String(caption) : null;
}

function extractMediaId(raw: Json, type: string): string | null {
  if (!["image", "document", "audio", "video", "sticker"].includes(type)) return null;
  const id = obj((raw as Json)[type]).id;
  return id ? String(id) : null;
}

function tsToIso(ts: unknown): string {
  const n = Number(ts);
  return Number.isFinite(n) && n > 0 ? new Date(n * 1000).toISOString() : new Date().toISOString();
}
