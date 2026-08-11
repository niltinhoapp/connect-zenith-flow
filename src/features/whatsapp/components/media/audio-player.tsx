import { useEffect, useRef, useState } from "react";
import { Play, Pause, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";

function mmss(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * AudioPlayer — player compacto reutilizável (bolha da conversa e preview do composer).
 * Puramente visual: consome uma URL local/objeto, sem storage.
 */
export function AudioPlayer({
  src,
  tone = "neutral",
  className,
  onError,
}: {
  src: string;
  tone?: "neutral" | "onPrimary";
  className?: string;
  onError?: () => void;
}) {
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    setPlaying(false);
    setCurrent(0);
  }, [src]);

  const pct = duration > 0 ? Math.min(100, (current / duration) * 100) : 0;
  const onPrimary = tone === "onPrimary";

  const toggle = () => {
    const el = ref.current;
    if (!el) return;
    if (el.paused) {
      void el.play();
      setPlaying(true);
    } else {
      el.pause();
      setPlaying(false);
    }
  };

  return (
    <div className={cn("flex w-full min-w-0 items-center gap-2.5", className)}>
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "Pausar áudio" : "Reproduzir áudio"}
        className={cn(
          "grid h-8 w-8 shrink-0 place-items-center rounded-full transition-colors",
          onPrimary
            ? "bg-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/30"
            : "bg-primary/15 text-primary hover:bg-primary/25",
        )}
      >
        {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
      </button>

      <div className="min-w-0 flex-1">
        <div
          className={cn(
            "h-1.5 w-full overflow-hidden rounded-full",
            onPrimary ? "bg-primary-foreground/25" : "bg-border",
          )}
        >
          <div
            className={cn(
              "h-full rounded-full",
              onPrimary ? "bg-primary-foreground" : "bg-primary",
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div
          className={cn(
            "mt-1 flex items-center justify-between text-[10px] tabular-nums",
            onPrimary ? "text-primary-foreground/70" : "text-muted-foreground",
          )}
        >
          <span>{mmss(current)}</span>
          <span className="flex items-center gap-1">
            <Volume2 className="h-3 w-3" />
            {mmss(duration)}
          </span>
        </div>
      </div>

      <audio
        ref={ref}
        src={src}
        preload="metadata"
        className="hidden"
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onEnded={() => {
          setPlaying(false);
          setCurrent(0);
        }}
        onError={onError}
      />
    </div>
  );
}
