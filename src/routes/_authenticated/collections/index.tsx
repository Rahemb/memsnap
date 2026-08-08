import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { FolderOpen, FolderPlus, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { AppShell, PageHeader } from "@/components/app/app-shell";
import { EmptyState, SectionHeader } from "@/components/app/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSignedUrl } from "@/hooks/use-signed-url";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { categoryMeta } from "@/lib/categories";
import { fetchCollectionSuggestions, fetchCollections, type CollectionWithCount } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/collections/")({
  head: () => ({
    meta: [
      { title: "Collections — Screenshot Inbox" },
      {
        name: "description",
        content: "Group saved screenshots into collections for a trip, a wishlist or a plan.",
      },
      { property: "og:title", content: "Collections — Screenshot Inbox" },
      { property: "og:description", content: "Group saved screenshots into trips, wishlists and plans." },
    ],
  }),
  component: CollectionsPage,
});

function CollectionsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  const collections = useQuery({ queryKey: ["collections"], queryFn: fetchCollections });
  const suggestions = useQuery({
    queryKey: ["collection-suggestions"],
    queryFn: fetchCollectionSuggestions,
  });

  const create = useMutation({
    mutationFn: async (input: { name: string; ids?: string[] }) => {
      if (!user) throw new Error("Please sign in again.");
      const trimmed = input.name.trim();
      if (!trimmed) throw new Error("Give the collection a name.");
      const { data, error } = await supabase
        .from("collections")
        .insert({ user_id: user.id, name: trimmed })
        .select("id")
        .single();
      if (error) throw error;
      if (input.ids?.length) {
        const { error: linkError } = await supabase.from("collection_items").insert(
          input.ids.map((screenshot_id) => ({
            collection_id: data.id,
            screenshot_id,
            user_id: user.id,
          })),
        );
        if (linkError) throw linkError;
      }
    },
    onSuccess: () => {
      setName("");
      setCreating(false);
      void queryClient.invalidateQueries({ queryKey: ["collections"] });
      void queryClient.invalidateQueries({ queryKey: ["collection-suggestions"] });
      toast.success("Collection created");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const buildFromSuggestion = useMutation({
    mutationFn: async (suggestion: { kind: "city" | "category"; value: string }) => {
      if (!user) throw new Error("Please sign in again.");
      const column = suggestion.kind === "city" ? "city" : "category";
      const { data: shots, error } = await supabase
        .from("screenshots")
        .select("id")
        .eq(column, suggestion.value)
        .eq("is_archived", false);
      if (error) throw error;
      await create.mutateAsync({
        name: suggestion.kind === "city" ? suggestion.value : categoryMeta(suggestion.value).label,
        ids: (shots ?? []).map((s) => s.id),
      });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const list = collections.data ?? [];

  return (
    <AppShell>
      <PageHeader
        title="Collections"
        subtitle="Trips, wishlists, plans"
        action={
          <Button
            size="sm"
            variant="outline"
            className="h-9 rounded-full px-3"
            onClick={() => setCreating((open) => !open)}
          >
            <FolderPlus className="size-4" />
            New
          </Button>
        }
      />

      <div className="mx-auto max-w-4xl space-y-7 px-4 py-5">
        {creating ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              create.mutate({ name });
            }}
            className="animate-rise flex gap-2"
          >
            <Input
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Lisbon trip"
              className="h-12 rounded-xl text-base"
            />
            <Button type="submit" disabled={create.isPending} className="h-12 rounded-xl px-5">
              {create.isPending ? <Loader2 className="size-4 animate-spin" /> : "Create"}
            </Button>
          </form>
        ) : null}

        {suggestions.data?.length ? (
          <section>
            <SectionHeader
              title="Suggested collections"
              hint="Based on what you've been saving"
              action={<Sparkles className="size-4 text-muted-foreground" />}
            />
            <div className="space-y-2">
              {suggestions.data.map((suggestion) => (
                <div
                  key={`${suggestion.kind}-${suggestion.value}`}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14.5px] font-medium">
                      {suggestion.kind === "city"
                        ? suggestion.value
                        : categoryMeta(suggestion.value).label}
                    </p>
                    <p className="text-[12.5px] text-muted-foreground">
                      {suggestion.count} screenshots{suggestion.kind === "city" ? " from here" : ""}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-9 shrink-0 rounded-full px-3.5"
                    disabled={buildFromSuggestion.isPending}
                    onClick={() => buildFromSuggestion.mutate(suggestion)}
                  >
                    Create
                  </Button>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {collections.isLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton-shimmer h-40 rounded-2xl bg-muted" />
            ))}
          </div>
        ) : null}

        {!collections.isLoading && list.length ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {list.map((collection) => (
              <CollectionTile key={collection.id} collection={collection} />
            ))}
          </div>
        ) : null}

        {!collections.isLoading && !list.length ? (
          <EmptyState
            icon={FolderOpen}
            title="No collections yet"
            description="Collections are handy for a trip, a wishlist or a project — group anything you saved."
            action={
              <Button className="h-12 rounded-xl px-6" onClick={() => setCreating(true)}>
                Create a collection
              </Button>
            }
          />
        ) : null}
      </div>
    </AppShell>
  );
}

function CollectionTile({ collection }: { collection: CollectionWithCount }) {
  const cover = useSignedUrl(collection.cover);

  return (
    <Link
      to="/collections/$id"
      params={{ id: collection.id }}
      className="tap block overflow-hidden rounded-2xl border border-border bg-surface shadow-soft active:scale-[0.985]"
    >
      <div className="relative aspect-[4/3] w-full bg-muted">
        {cover ? (
          <img src={cover} alt="" className="size-full object-cover" loading="lazy" />
        ) : (
          <span className="flex size-full items-center justify-center">
            <FolderOpen className="size-6 text-muted-foreground" />
          </span>
        )}
      </div>
      <div className="px-3 py-2.5">
        <p className="truncate text-[13.5px] font-medium">{collection.name}</p>
        <p className="text-[12px] text-muted-foreground">
          {collection.count} {collection.count === 1 ? "item" : "items"}
        </p>
      </div>
    </Link>
  );
}
