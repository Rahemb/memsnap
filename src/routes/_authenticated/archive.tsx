import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Archive, ChevronLeft } from "lucide-react";

import { AppShell, PageHeader } from "@/components/app/app-shell";
import { EmptyState } from "@/components/app/empty-state";
import { CardSkeleton, ScreenshotMasonry } from "@/components/app/screenshot-card";
import { Button } from "@/components/ui/button";
import { fetchScreenshots } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/archive")({
  head: () => ({
    meta: [
      { title: "Archived — Screenshot Inbox" },
      { name: "description", content: "Screenshots you archived, kept out of your main inbox." },
      { property: "og:title", content: "Archived — Screenshot Inbox" },
      { property: "og:description", content: "Screenshots you archived but kept." },
    ],
  }),
  component: ArchivePage,
});

function ArchivePage() {
  const shots = useQuery({
    queryKey: ["screenshots", "archived"],
    queryFn: () => fetchScreenshots({ archived: true }),
  });

  const items = shots.data ?? [];

  return (
    <AppShell>
      <PageHeader
        title="Archived"
        subtitle={items.length ? `${items.length} kept aside` : undefined}
        back={
          <Link
            to="/profile"
            aria-label="Back"
            className="tap -ml-2 rounded-full p-2 text-muted-foreground"
          >
            <ChevronLeft className="size-5" />
          </Link>
        }
      />

      <div className="mx-auto max-w-5xl px-4 py-5">
        {shots.isLoading ? <CardSkeleton /> : null}
        {!shots.isLoading && items.length ? <ScreenshotMasonry shots={items} /> : null}
        {!shots.isLoading && !items.length ? (
          <EmptyState
            icon={Archive}
            title="Nothing archived"
            description="Archiving hides a screenshot from your inbox without deleting it."
            action={
              <Button asChild className="h-12 rounded-xl px-6">
                <Link to="/home">Back to inbox</Link>
              </Button>
            }
          />
        ) : null}
      </div>
    </AppShell>
  );
}
