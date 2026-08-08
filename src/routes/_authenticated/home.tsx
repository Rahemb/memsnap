import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Clock3, FolderOpen, ImagePlus, Inbox, Loader2, Search, Sparkles } from "lucide-react";

import { AppShell, PageHeader } from "@/components/app/app-shell";
import { EmptyState, SectionHeader } from "@/components/app/empty-state";
import {
  CardSkeleton,
  ScreenshotMasonry,
  ScreenshotRow,
} from "@/components/app/screenshot-card";
import { Button } from "@/components/ui/button";
import { categoryMeta } from "@/lib/categories";
import {
  PAGE_SIZE,
  fetchCategoryCounts,
  fetchCollections,
  fetchProcessing,
  fetchRediscover,
  fetchScreenshots,
} from "@/lib/queries";
import { isProcessing } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({
    meta: [
      { title: "Your inbox — Screenshot Inbox" },
      {
        name: "description",
        content: "Everything you saved, quietly organised by what it actually is.",
      },
      { property: "og:title", content: "Your inbox — Screenshot Inbox" },
      { property: "og:description", content: "Everything you saved, quietly organised." },
    ],
  }),
  component: HomePage,
});

function greeting() {
  const hour = new Date().getHours();
  if (hour < 5) return "Still up";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function HomePage() {
  const [category, setCategory] = useState<string | null>(null);
  const [pages, setPages] = useState(1);
  const queryClient = useQueryClient();

  const screenshots = useQuery({
    queryKey: ["screenshots", category, pages],
    queryFn: async () => {
      const chunks = await Promise.all(
        Array.from({ length: pages }, (_, page) => fetchScreenshots({ page, category })),
      );
      return chunks.flat();
    },
  });

  const processing = useQuery({ queryKey: ["processing"], queryFn: fetchProcessing });
  const rediscover = useQuery({ queryKey: ["rediscover"], queryFn: fetchRediscover });
  const collections = useQuery({ queryKey: ["collections"], queryFn: fetchCollections });
  const categories = useQuery({ queryKey: ["category-counts"], queryFn: fetchCategoryCounts });

  const active = useMemo(
    () => (processing.data ?? []).filter((s) => isProcessing(s.status)),
    [processing.data],
  );

  // While anything is still being read, keep the inbox fresh without manual refresh.
  useEffect(() => {
    if (!active.length) return;
    const timer = window.setInterval(() => {
      void queryClient.invalidateQueries({ queryKey: ["processing"] });
      void queryClient.invalidateQueries({ queryKey: ["screenshots"] });
    }, 4000);
    return () => window.clearInterval(timer);
  }, [active.length, queryClient]);

  const shots = screenshots.data ?? [];
  const hasMore = shots.length >= pages * PAGE_SIZE;
  const failed = (processing.data ?? []).filter((s) => s.status === "failed");

  return (
    <AppShell>
      <PageHeader title="Your inbox" subtitle={greeting()} />

      <div className="mx-auto max-w-5xl px-4 pt-4">
        <Link
          to="/search"
          className="tap flex items-center gap-2.5 rounded-2xl border border-border bg-surface px-4 py-3.5 text-[14.5px] text-muted-foreground shadow-soft"
        >
          <Search className="size-4" />
          Search or ask about anything you saved
        </Link>

        {active.length || failed.length ? (
          <div className="surface-card mt-4 flex items-center gap-3 p-4">
            {active.length ? (
              <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
            ) : (
              <Sparkles className="size-4 shrink-0 text-destructive" />
            )}
            <p className="text-[13.5px] leading-snug">
              {active.length
                ? `Reading ${active.length} ${active.length === 1 ? "screenshot" : "screenshots"} — details appear as they finish.`
                : `${failed.length} ${failed.length === 1 ? "screenshot needs" : "screenshots need"} another try.`}
            </p>
          </div>
        ) : null}

        {categories.data?.length ? (
          <div className="no-scrollbar -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1">
            <Chip active={category === null} onClick={() => setCategory(null)} label="All" />
            {categories.data.map(({ category: key, count }) => {
              const meta = categoryMeta(key);
              return (
                <Chip
                  key={key}
                  active={category === key}
                  onClick={() => {
                    setCategory(key);
                    setPages(1);
                  }}
                  label={`${meta.label} · ${count}`}
                  icon={<meta.icon className={cn("size-3.5", meta.tone)} />}
                />
              );
            })}
          </div>
        ) : null}
      </div>

      <div className="mx-auto max-w-5xl space-y-8 px-4 py-6">
        {!category && rediscover.data?.length ? (
          <section>
            <SectionHeader
              title="Rediscover"
              hint="Saved a while ago and not opened since"
              action={<Clock3 className="size-4 text-muted-foreground" />}
            />
            <ScreenshotRow shots={rediscover.data} />
          </section>
        ) : null}

        {!category && collections.data?.length ? (
          <section>
            <SectionHeader
              title="Collections"
              action={
                <Link to="/collections" className="text-[13px] font-medium text-primary">
                  See all
                </Link>
              }
            />
            <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
              {collections.data.slice(0, 6).map((collection) => (
                <Link
                  key={collection.id}
                  to="/collections/$id"
                  params={{ id: collection.id }}
                  className="tap w-40 shrink-0 rounded-2xl border border-border bg-surface p-4 shadow-soft"
                >
                  <FolderOpen className="size-5 text-primary" />
                  <p className="mt-3 truncate text-[13.5px] font-medium">{collection.name}</p>
                  <p className="text-[12px] text-muted-foreground">
                    {collection.count} {collection.count === 1 ? "item" : "items"}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <section>
          <SectionHeader
            title={category ? categoryMeta(category).label : "Recently added"}
            {...(category ? { hint: "Filtered by category" } : {})}
          />

          {screenshots.isLoading ? <CardSkeleton /> : null}

          {!screenshots.isLoading && shots.length ? (
            <>
              <ScreenshotMasonry shots={shots} />
              {hasMore ? (
                <div className="mt-4 flex justify-center">
                  <Button
                    variant="outline"
                    className="h-11 rounded-xl px-6"
                    onClick={() => setPages((p) => p + 1)}
                  >
                    Load more
                  </Button>
                </div>
              ) : null}
            </>
          ) : null}

          {!screenshots.isLoading && !shots.length ? (
            <EmptyState
              icon={category ? Inbox : ImagePlus}
              title={category ? "Nothing here yet" : "Your inbox is empty"}
              description={
                category
                  ? "Nothing you've saved falls into this category yet."
                  : "Add your first screenshot and it will be read, titled and filed for you."
              }
              action={
                <Button asChild className="h-12 rounded-xl px-6">
                  <Link to="/add">Add screenshots</Link>
                </Button>
              }
            />
          ) : null}
        </section>
      </div>
    </AppShell>
  );
}

function Chip({
  label,
  active,
  onClick,
  icon,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "tap inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13px] font-medium",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-surface text-muted-foreground",
      )}
    >
      {icon}
      {label}
    </button>
  );
}
