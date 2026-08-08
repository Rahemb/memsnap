import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { ChevronLeft, ImagePlus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell, PageHeader } from "@/components/app/app-shell";
import { EmptyState } from "@/components/app/empty-state";
import { CardSkeleton, ScreenshotMasonry } from "@/components/app/screenshot-card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { fetchCollectionScreenshots } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/collections/$id")({
  head: () => ({
    meta: [
      { title: "Collection — Screenshot Inbox" },
      { name: "description", content: "Screenshots grouped into one collection." },
      { property: "og:title", content: "Collection — Screenshot Inbox" },
      { property: "og:description", content: "Screenshots grouped into one collection." },
    ],
  }),
  component: CollectionDetail,
});

function CollectionDetail() {
  const { id } = useParams({ from: "/_authenticated/collections/$id" });
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const collection = useQuery({
    queryKey: ["collection", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("collections")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const shots = useQuery({
    queryKey: ["collection-screenshots", id],
    queryFn: () => fetchCollectionScreenshots(id),
  });

  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("collections").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["collections"] });
      toast.success("Collection deleted");
      void navigate({ to: "/collections", replace: true });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const items = shots.data ?? [];

  return (
    <AppShell>
      <PageHeader
        title={collection.data?.name ?? "Collection"}
        subtitle={
          items.length ? `${items.length} ${items.length === 1 ? "screenshot" : "screenshots"}` : undefined
        }
        back={
          <Link
            to="/collections"
            aria-label="Back to collections"
            className="tap -ml-2 rounded-full p-2 text-muted-foreground"
          >
            <ChevronLeft className="size-5" />
          </Link>
        }
        action={
          <Button
            size="sm"
            variant="ghost"
            aria-label="Delete collection"
            className="size-9 rounded-full p-0 text-muted-foreground"
            disabled={remove.isPending}
            onClick={() => {
              if (window.confirm("Delete this collection? The screenshots stay in your inbox.")) {
                remove.mutate();
              }
            }}
          >
            {remove.isPending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
          </Button>
        }
      />

      <div className="mx-auto max-w-5xl px-4 py-5">
        {shots.isLoading ? <CardSkeleton /> : null}
        {!shots.isLoading && items.length ? <ScreenshotMasonry shots={items} /> : null}
        {!shots.isLoading && !items.length ? (
          <EmptyState
            icon={ImagePlus}
            title="Nothing in here yet"
            description="Open any screenshot and use “Collection” to add it here."
            action={
              <Button asChild className="h-12 rounded-xl px-6">
                <Link to="/home">Browse inbox</Link>
              </Button>
            }
          />
        ) : null}
      </div>
    </AppShell>
  );
}
