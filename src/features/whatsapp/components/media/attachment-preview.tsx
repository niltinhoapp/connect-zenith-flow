import { CheckCircle2, FileText, Loader2, Music, AlertTriangle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { AudioPlayer } from "./audio-player";
import { formatBytes, shortMime, type MediaKind } from "./media-utils";

export type AttachmentStatus = "idle" | "sending" | "success" | "error";

export interface DraftAttachment {
  id: string;
  kind: MediaKind;
  name: string;
  size: number;
  mime: string;
  url: string;
}

/**
 * AttachmentPreview — cartão de pré-visualização do anexo no composer.
 * Estados: idle / sending / success / error. Sem upload real.
 */
export function AttachmentPreview({
  attachment,
  status = "idle",
  errorMessage,
  onRemove,
}: {
  attachment: DraftAttachment;
  status?: AttachmentStatus;
  errorMessage?: string | null;
  onRemove: () => void;
}) {
  const busy = status === "sending";
  return (
    <div
      className={cn(
        "mb-2 flex w-full min-w-0 items-center gap-3 rounded-xl border bg-card px-3 py-2.5",
        status === "error" ? "border-destructive/40" : "border-border",
      )}
    >
      <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-lg border border-border bg-background">
        {attachment.kind === "image" ? (
          <img src={attachment.url} alt={attachment.name} className="h-full w-full object-cover" />
        ) : attachment.kind === "audio" ? (
          <Music className="h-4 w-4 text-primary" />
        ) : (
          <FileText className="h-4 w-4 text-primary" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium">{attachment.name}</p>
        <p className="truncate text-[10px] text-muted-foreground">
          {shortMime(attachment.mime)} · {formatBytes(attachment.size)}
        </p>
        {attachment.kind === "audio" && (
          <div className="mt-1.5 max-w-xs">
            <AudioPlayer src={attachment.url} />
          </div>
        )}
        {status === "error" && (
          <p className="mt-1 flex items-center gap-1 text-[10px] text-destructive">
            <AlertTriangle className="h-3 w-3 shrink-0" />
            {errorMessage || "Falha ao enviar o anexo."}
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {busy && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        {status === "success" && <CheckCircle2 className="h-3.5 w-3.5 text-success" />}
        <button
          type="button"
          onClick={onRemove}
          disabled={busy}
          aria-label="Remover anexo"
          className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
