/**
 * Detecção de mídia numa mensagem inbound da Cloud API (formato neutro).
 * A Edge Function `whatsapp-webhook` aplica a MESMA regra (mantidas em sincronia)
 * para decidir quando chamar `wa_register_inbound_media`.
 */
export const INBOUND_MEDIA_TYPES = ["image", "audio", "document", "video", "sticker"] as const;

export interface InboundMediaRef {
  id: string;
  mime: string;
  filename: string | null;
}

export function pickInboundMedia(
  msg: Record<string, unknown> | null | undefined,
  type: string,
): InboundMediaRef | null {
  if (!INBOUND_MEDIA_TYPES.includes(type as (typeof INBOUND_MEDIA_TYPES)[number])) return null;
  const m = (msg?.[type] ?? {}) as Record<string, unknown>;
  const id = m.id ? String(m.id) : "";
  if (!id) return null;
  return {
    id,
    mime: m.mime_type ? String(m.mime_type) : "",
    filename: m.filename ? String(m.filename) : null,
  };
}
