import { useState } from "react";
import { Download, FileText, ImageOff, Loader2, AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { AudioPlayer } from "./audio-player";
import { formatBytes, shortMime, type MediaKind } from "./media-utils";

export interface MessageMedia {
  kind: MediaKind;
  url: string;
  name: string;
  size?: number;
  mime?: string;
  /** estado visual do carregamento da mídia */
  state?: "ready" | "loading" | "error";
}

/**
 * MessageMediaBubble — conteúdo de mídia dentro da bolha da conversa.
 * Mantém raios/bordas/tokens do balão; apenas o miolo muda por tipo.
 */
export function MessageMediaBubble({
  media,
  mine,
}: {
  media: MessageMedia;
  mine: boolean;
}) {
  const [status, setStatus] = useState<"ready" | "loading" | "error">(
    media.state ?? (media.kind === "image" ? "loading" : "ready"),
  );
  const [open, setOpen] = useState(false);

  const surface = mine
    ? "border-primary-foreground/20 bg-primary-foreground/10"
    : "border-border bg-background/60";
  const subtle = mine ? "text-primary-foreground/70" : "text-muted-foreground";

  if (status === "error") {
    return (
      <div
        className={cn(
          "flex items-center gap-2 rounded-xl border px-3 py-2.5 text-[11px]",
          surface,
          mine ? "text-primary-foreground/80" : "text-destructive",
        )}
      >
        {media.kind === "image" ? (
          <ImageOff className="h-4 w-4 shrink-0" />
        ) : (
          <AlertTriangle className="h-4 w-4 shrink-0" />
        )}
        <span className="min-w-0 truncate">Falha ao carregar mídia — toque para tentar de novo</span>
      </div>
    );
  }

  if (media.kind === "image") {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            "relative block w-full overflow-hidden rounded-xl border",
            surface,
            "max-w-[min(18rem,100%)]",
          )}
        >
          {status === "loading" && (
            <div className="absolute inset-0 grid place-items-center bg-card/70">
              <Loader2 className={cn("h-4 w-4 animate-spin", subtle)} />
            </div>
          )}
          <img
            src={media.url}
            alt={media.name}
            loading="lazy"
            onLoad={() => setStatus("ready")}
            onError={() => setStatus("error")}
            className="block h-auto max-h-64 w-full object-cover"
          />
        </button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-[min(56rem,95vw)] border-border bg-card">
            <DialogHeader>
              <DialogTitle className="truncate text-sm font-medium">{media.name}</DialogTitle>
            </DialogHeader>
            <img
              src={media.url}
              alt={media.name}
              className="max-h-[70vh] w-full rounded-xl object-contain"
            />
          </DialogContent>
        </Dialog>
      </>
    );
  }

  if (media.kind === "audio") {
    return (
      <div
        className={cn("w-[min(16rem,100%)] rounded-xl border px-3 py-2.5", surface)}
      >
        <AudioPlayer
          src={media.url}
          tone={mine ? "onPrimary" : "neutral"}
          onError={() => setStatus("error")}
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex w-[min(17rem,100%)] items-center gap-3 rounded-xl border px-3 py-2.5",
        surface,
      )}
    >
      <div
        className={cn(
          "grid h-9 w-9 shrink-0 place-items-center rounded-lg",
          mine ? "bg-primary-foreground/15 text-primary-foreground" : "bg-primary/15 text-primary",
        )}
      >
        <FileText className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium">{media.name}</p>
        <p className={cn("text-[10px]", subtle)}>
          {media.mime ? shortMime(media.mime) : "PDF"}
          {media.size ? ` · ${formatBytes(media.size)}` : ""}
        </p>
      </div>
      <a
        href={media.url}
        download={media.name}
        aria-label={`Baixar ${media.name}`}
        className={cn(
          "grid h-8 w-8 shrink-0 place-items-center rounded-lg transition-colors",
          mine
            ? "text-primary-foreground/80 hover:bg-primary-foreground/15"
            : "text-muted-foreground hover:bg-accent hover:text-foreground",
        )}
      >
        <Download className="h-3.5 w-3.5" />
      </a>
    </div>
  );
}
