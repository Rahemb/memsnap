import { Link } from "@tanstack/react-router";
import { AlertCircle, Loader2 } from "lucide-react";

import { useSignedUrl } from "@/hooks/use-signed-url";
import { categoryMeta, sourceLabel } from "@/lib/categories";
import { displayTitle, isProcessing, STATUS_LABEL, type Screenshot, type ScreenshotStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

function relativeDate(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`;
  return `${Math.floor(days / 30)} months ago`;
}

export function ScreenshotCard({ shot }: { shot: Screenshot }) {
  const url = useSignedUrl(shot.thumbnail_path ?? shot.storage_path);
  const meta = categoryMeta(shot.category);
  const source = sourceLabel(shot.source_platform);
  const processing = isProcessing(shot.status);
  const ratio = shot.width && shot.height ? shot.width / shot.height : 0.62;

  return (
    <Link
      to="/s/$id"
      params={{ id: shot.id }}
      className="tap group block overflow-hidden rounded-2xl border border-border bg-surface shadow-soft active:scale-[0.985]"
    >
      <div className="relative w-full overflow-hidden bg-muted" style={{ aspectRatio: ratio }}>
        {url ? (
          <img
            src={url}
            alt={displayTitle(shot)}
            loading="lazy"
            decoding="async"
            className={cn(
              "size-full object-cover transition-opacity duration-500",
              processing && "opacity-60",
            )}
          />
        ) : (
          <div className="skeleton-shimmer size-full bg-muted" />
        )}

        {processing ? (
          <span className="absolute left-2 top-2 inline-flex items-center gap-1.5 rounded-full bg-background/90 px-2.5 py-1 text-[11px] font-medium text-foreground backdrop-blur">
            <Loader2 className="size-3 animate-spin" />
            {STATUS_LABEL[shot.status as ScreenshotStatus] ?? "Working"}
          </span>
        ) : null}

        {shot.status === "failed" ? (
          <span className="absolute left-2 top-2 inline-flex items-center gap-1.5 rounded-full bg-destructive px-2.5 py-1 text-[11px] font-medium text-destructive-foreground">
            <AlertCircle className="size-3" />
            Needs a retry
          </span>
        ) : null}
      </div>

      <div className="space-y-1 px-3 pb-3 pt-2.5">
        <p className="line-clamp-2 text-[13.5px] font-medium leading-snug">{displayTitle(shot)}</p>
        <div className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
          <meta.icon className={cn("size-3.5 shrink-0", meta.tone)} />
          <span className="truncate">{meta.label}</span>
          {shot.city ? <span className="truncate">· {shot.city}</span> : null}
          {source ? <span className="truncate">· {source}</span> : null}
        </div>
        <p className="text-[11px] text-muted-foreground/80">{relativeDate(shot.created_at)}</p>
      </div>
    </Link>
  );
}

/** CSS-column masonry — smooth on mobile, no layout library needed. */
export function ScreenshotMasonry({ shots }: { shots: Screenshot[] }) {
  return (
    <div className="columns-2 gap-3 [column-fill:balance] md:columns-3 xl:columns-4">
      {shots.map((shot) => (
        <div key={shot.id} className="mb-3 break-inside-avoid">
          <ScreenshotCard shot={shot} />
        </div>
      ))}
    </div>
  );
}

export function ScreenshotRow({ shots }: { shots: Screenshot[] }) {
  return (
    <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1">
      {shots.map((shot) => (
        <div key={shot.id} className="w-[46%] shrink-0 snap-start sm:w-44">
          <ScreenshotCard shot={shot} />
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="columns-2 gap-3 md:columns-3 xl:columns-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="skeleton-shimmer mb-3 break-inside-avoid rounded-2xl bg-muted"
          style={{ height: 150 + ((i * 37) % 90) }}
        />
      ))}
    </div>
  );
}
