import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import {
  Archive,
  ArchiveRestore,
  CalendarDays,
  ChevronLeft,
  ExternalLink,
  FolderPlus,
  Loader2,
  MapPin,
  RefreshCw,
  Tag,
  Trash2,
  Type as TypeIcon,
} from "lucide-react";
import { toast } from "sonner";

import { AppShell, PageHeader } from "@/components/app/app-shell";
import { CollectionPicker } from "@/components/app/collection-picker";
import { Button } from "@/components/ui/button";
import { useSignedUrl } from "@/hooks/use-signed-url";
import { analyzeScreenshot } from "@/lib/ai.functions";
import { supabase } from "@/integrations/supabase/client";
import { categoryMeta, sourceLabel } from "@/lib/categories";
import { fetchScreenshot } from "@/lib/queries";
import { displayTitle, isProcessing, placeLine, STATUS_LABEL, type ScreenshotStatus } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/s/$id")({
  head: () => ({
    meta: [
      { title: "Screenshot — Screenshot Inbox" },
      { name: "description", content: "Everything read from this screenshot, in one place." },
      { property: "og:title", content: "Screenshot — Screenshot Inbox" },
      { property: "og:description", content: "Everything read from this screenshot." },
    ],
  }),
  component: ScreenshotDetail,
});

function ScreenshotDetail() {
  const { id } = useParams({ from: "/_authenticated/s/$id" });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [pickerOpen, setPickerOpen] = useState(false);
  const retry = useServerFn(analyzeScreenshot);

  const shotQuery = useQuery({
    queryKey: ["screenshot", id],
    queryFn: () => fetchScreenshot(id),
    refetchInterval: (query) =>
      query.state.data && isProcessing(query.state.data.status) ? 3500 : false,
  });

  const shot = shotQuery.data;
  const url = useSignedUrl(shot?.storage_path);

  useEffect(() => {
    if (!shot) return;
    void supabase
      .from("screenshots")
      .update({ last_viewed_at: new Date().toISOString() })
      .eq("id", shot.id);
  }, [shot?.id]);

  const invalidateLists = () => {
    void queryClient.invalidateQueries({ queryKey: ["screenshots"] });
    void queryClient.invalidateQueries({ queryKey: ["category-counts"] });
    void queryClient.invalidateQueries({ queryKey: ["rediscover"] });
  };

  const toggleArchive = useMutation({
    mutationFn: async () => {
      if (!shot) return;
      const { error } = await supabase
        .from("screenshots")
        .update({ is_archived: !shot.is_archived })
        .eq("id", shot.id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["screenshot", id] });
      invalidateLists();
      toast.success(shot?.is_archived ? "Back in your inbox" : "Archived");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const destroy = useMutation({
    mutationFn: async () => {
      if (!shot) return;
      const paths = [shot.storage_path, shot.thumbnail_path].filter(Boolean) as string[];
      await supabase.storage.from("screenshots").remove(paths);
      const { error } = await supabase.from("screenshots").delete().eq("id", shot.id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateLists();
      toast.success("Screenshot deleted");
      void navigate({ to: "/home", replace: true });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const reanalyze = useMutation({
    mutationFn: async () => {
      const result = await retry({ data: { screenshotId: id } });
      if (!result.ok) throw new Error(result.message);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["screenshot", id] });
      invalidateLists();
      toast.success("Updated");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (shotQuery.isLoading) {
    return (
      <AppShell>
        <PageHeader title="Screenshot" />
        <div className="mx-auto max-w-3xl px-4 py-5">
          <div className="skeleton-shimmer aspect-[3/4] w-full rounded-3xl bg-muted" />
        </div>
      </AppShell>
    );
  }

  if (!shot) {
    return (
      <AppShell>
        <PageHeader title="Not found" />
        <div className="mx-auto max-w-sm px-6 py-16 text-center">
          <p className="text-[15px] text-muted-foreground">
            This screenshot is no longer in your inbox.
          </p>
          <Button asChild className="mt-6 h-12 rounded-xl px-6">
            <Link to="/home">Back to inbox</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  const meta = categoryMeta(shot.category);
  const place = placeLine(shot);
  const source = sourceLabel(shot.source_platform);
  const processing = isProcessing(shot.status);
  const tags = (shot.tags ?? []) as string[];
  const actions = (shot.suggested_actions ?? []) as string[];

  return (
    <AppShell>
      <PageHeader
        title={displayTitle(shot)}
        subtitle={processing ? STATUS_LABEL[shot.status as ScreenshotStatus] : meta.label}
        back={
          <button
            onClick={() => void navigate({ to: "/home" })}
            aria-label="Back"
            className="tap -ml-2 rounded-full p-2 text-muted-foreground"
          >
            <ChevronLeft className="size-5" />
          </button>
        }
      />

      <div className="mx-auto max-w-3xl space-y-5 px-4 py-5">
        <div className="overflow-hidden rounded-3xl border border-border bg-muted shadow-soft">
          {url ? (
            <img src={url} alt={displayTitle(shot)} className="w-full object-contain" />
          ) : (
            <div className="skeleton-shimmer aspect-[3/4] w-full" />
          )}
        </div>

        {processing ? (
          <div className="surface-card flex items-center gap-3 p-4">
            <Loader2 className="size-4 animate-spin text-primary" />
            <p className="text-[13.5px] text-muted-foreground">
              Reading this screenshot — details will fill in shortly.
            </p>
          </div>
        ) : null}

        {shot.status === "failed" ? (
          <div className="surface-card space-y-3 p-4">
            <p className="text-[13.5px] leading-relaxed">
              This one couldn't be read{shot.error_message ? `: ${shot.error_message}` : "."}
            </p>
            <Button
              variant="outline"
              className="h-11 w-full rounded-xl"
              disabled={reanalyze.isPending}
              onClick={() => reanalyze.mutate()}
            >
              {reanalyze.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              Try again
            </Button>
          </div>
        ) : null}

        {shot.summary ? (
          <div className="surface-card p-4">
            <p className="text-[15px] leading-relaxed">{shot.summary}</p>
          </div>
        ) : null}

        <div className="flex gap-2">
          <Button
            variant="outline"
            className="h-11 flex-1 rounded-xl"
            onClick={() => setPickerOpen(true)}
          >
            <FolderPlus className="size-4" />
            Collection
          </Button>
          <Button
            variant="outline"
            className="h-11 flex-1 rounded-xl"
            disabled={toggleArchive.isPending}
            onClick={() => toggleArchive.mutate()}
          >
            {shot.is_archived ? (
              <ArchiveRestore className="size-4" />
            ) : (
              <Archive className="size-4" />
            )}
            {shot.is_archived ? "Restore" : "Archive"}
          </Button>
        </div>

        <dl className="surface-card divide-y divide-border">
          <Detail icon={<meta.icon className={`size-4 ${meta.tone}`} />} label="Category" value={meta.label} />
          {shot.subcategory ? (
            <Detail icon={<Tag className="size-4 text-muted-foreground" />} label="Type" value={shot.subcategory} />
          ) : null}
          {place ? (
            <Detail icon={<MapPin className="size-4 text-muted-foreground" />} label="Place" value={place} />
          ) : null}
          {shot.restaurant_name ? (
            <Detail label="Restaurant" value={shot.restaurant_name} />
          ) : null}
          {shot.brand ? <Detail label="Brand" value={shot.brand} /> : null}
          {shot.product_name ? <Detail label="Product" value={shot.product_name} /> : null}
          {shot.price ? (
            <Detail label="Price" value={`${shot.price}${shot.currency ? ` ${shot.currency}` : ""}`} />
          ) : null}
          {shot.event_date ? (
            <Detail
              icon={<CalendarDays className="size-4 text-muted-foreground" />}
              label="Date"
              value={new Date(shot.event_date).toLocaleDateString()}
            />
          ) : null}
          {source ? <Detail label="Saved from" value={source} /> : null}
          <Detail label="Added" value={new Date(shot.created_at).toLocaleDateString()} />
        </dl>

        {shot.website ? (
          <Button asChild variant="outline" className="h-12 w-full rounded-xl">
            <a href={shot.website} target="_blank" rel="noreferrer noopener">
              <ExternalLink className="size-4" />
              Open link
            </a>
          </Button>
        ) : null}

        {tags.length ? (
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-muted px-3 py-1.5 text-[12.5px] text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
        ) : null}

        {actions.length ? (
          <div className="surface-card p-4">
            <h2 className="text-[14px] font-semibold tracking-tight">What you could do next</h2>
            <ul className="mt-2 space-y-1.5">
              {actions.map((action) => (
                <li key={action} className="text-[13.5px] leading-relaxed text-muted-foreground">
                  · {action}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {shot.detected_text ? (
          <details className="surface-card p-4">
            <summary className="flex cursor-pointer items-center gap-2 text-[14px] font-semibold tracking-tight">
              <TypeIcon className="size-4 text-muted-foreground" />
              Text inside the screenshot
            </summary>
            <p className="mt-3 whitespace-pre-line text-[13px] leading-relaxed text-muted-foreground">
              {shot.detected_text}
            </p>
          </details>
        ) : null}

        <div className="flex gap-2 pb-4">
          <Button
            variant="outline"
            className="h-11 flex-1 rounded-xl"
            disabled={reanalyze.isPending || processing}
            onClick={() => reanalyze.mutate()}
          >
            {reanalyze.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            Re-read
          </Button>
          <Button
            variant="outline"
            className="h-11 flex-1 rounded-xl text-destructive"
            disabled={destroy.isPending}
            onClick={() => {
              if (window.confirm("Delete this screenshot permanently?")) destroy.mutate();
            }}
          >
            {destroy.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Trash2 className="size-4" />
            )}
            Delete
          </Button>
        </div>
      </div>

      <CollectionPicker screenshotId={shot.id} open={pickerOpen} onOpenChange={setPickerOpen} />
    </AppShell>
  );
}

function Detail({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <dt className="flex w-28 shrink-0 items-center gap-2 text-[13px] text-muted-foreground">
        {icon}
        {label}
      </dt>
      <dd className="min-w-0 flex-1 text-[13.5px] font-medium">{value}</dd>
    </div>
  );
}
