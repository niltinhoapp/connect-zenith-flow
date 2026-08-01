/**
 * Utilitários visuais de mídia do inbox (somente UI — sem upload/storage real).
 */
export type MediaKind = "image" | "audio" | "document";

export const MAX_MEDIA_BYTES = 16 * 1024 * 1024; // 16MB (limite visual)

export const ACCEPTED_MEDIA =
  "image/png,image/jpeg,image/webp,image/gif,application/pdf,audio/mpeg,audio/ogg,audio/wav,audio/webm,audio/mp4";

export function detectKind(mime: string): MediaKind | null {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("audio/")) return "audio";
  if (mime === "application/pdf") return "document";
  return null;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function shortMime(mime: string): string {
  const sub = mime.split("/")[1] ?? mime;
  return sub.replace("vnd.openxmlformats-officedocument.", "").toUpperCase();
}

export interface MediaValidation {
  ok: boolean;
  error?: string;
}

export function validateMediaFile(file: File): MediaValidation {
  const kind = detectKind(file.type);
  if (!kind) {
    return { ok: false, error: "Formato não suportado. Envie imagem, PDF ou áudio." };
  }
  if (file.size > MAX_MEDIA_BYTES) {
    return {
      ok: false,
      error: `Arquivo acima do limite de ${formatBytes(MAX_MEDIA_BYTES)}.`,
    };
  }
  return { ok: true };
}
