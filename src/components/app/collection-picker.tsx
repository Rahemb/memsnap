import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, FolderPlus, Loader2, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { fetchCollections } from "@/lib/queries";

/** Adds/removes one screenshot from the person's collections. */
export function CollectionPicker({
  screenshotId,
  open,
  onOpenChange,
}: {
  screenshotId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");

  const collections = useQuery({
    queryKey: ["collections"],
    queryFn: fetchCollections,
    enabled: open,
  });

  const membership = useQuery({
    queryKey: ["collection-membership", screenshotId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("collection_items")
        .select("collection_id")
        .eq("screenshot_id", screenshotId);
      if (error) throw error;
      return (data ?? []).map((r) => r.collection_id);
    },
    enabled: open,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["collections"] });
    void queryClient.invalidateQueries({ queryKey: ["collection-membership", screenshotId] });
    void queryClient.invalidateQueries({ queryKey: ["collection-screenshots"] });
  };

  const toggle = useMutation({
    mutationFn: async (collectionId: string) => {
      if (!user) throw new Error("Please sign in again.");
      const inside = membership.data?.includes(collectionId);
      if (inside) {
        const { error } = await supabase
          .from("collection_items")
          .delete()
          .eq("collection_id", collectionId)
          .eq("screenshot_id", screenshotId);
        if (error) throw error;
        return "removed" as const;
      }
      const { error } = await supabase.from("collection_items").insert({
        collection_id: collectionId,
        screenshot_id: screenshotId,
        user_id: user.id,
      });
      if (error) throw error;
      return "added" as const;
    },
    onSuccess: (result) => {
      invalidate();
      toast.success(result === "added" ? "Added to collection" : "Removed from collection");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Please sign in again.");
      const trimmed = name.trim();
      if (!trimmed) throw new Error("Give the collection a name.");
      const { data, error } = await supabase
        .from("collections")
        .insert({ user_id: user.id, name: trimmed, cover_screenshot_id: screenshotId })
        .select("id")
        .single();
      if (error) throw error;
      const link = await supabase
        .from("collection_items")
        .insert({ collection_id: data.id, screenshot_id: screenshotId, user_id: user.id });
      if (link.error) throw link.error;
    },
    onSuccess: () => {
      setName("");
      invalidate();
      toast.success("Collection created");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-3xl">
        <DialogHeader>
          <DialogTitle className="text-[18px]">Save to a collection</DialogTitle>
          <DialogDescription>Group screenshots that belong to the same plan or idea.</DialogDescription>
        </DialogHeader>

        <div className="max-h-64 space-y-1.5 overflow-y-auto">
          {collections.isLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            </div>
          ) : null}
          {collections.data?.map((collection) => {
            const inside = membership.data?.includes(collection.id) ?? false;
            return (
              <button
                key={collection.id}
                onClick={() => toggle.mutate(collection.id)}
                className="tap flex w-full items-center justify-between rounded-xl border border-border px-3.5 py-3 text-left text-sm hover:bg-accent"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">{collection.name}</span>
                  <span className="text-[12px] text-muted-foreground">
                    {collection.count} {collection.count === 1 ? "item" : "items"}
                  </span>
                </span>
                {inside ? <Check className="size-4 shrink-0 text-primary" /> : null}
              </button>
            );
          })}
          {collections.data && !collections.data.length ? (
            <p className="px-1 py-2 text-[13px] text-muted-foreground">
              No collections yet — create your first one below.
            </p>
          ) : null}
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            create.mutate();
          }}
          className="flex gap-2"
        >
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="New collection"
            className="h-11 rounded-xl"
          />
          <Button type="submit" disabled={create.isPending} className="h-11 rounded-xl px-4">
            {create.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CollectionPickerTrigger({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="outline" onClick={onClick} className="h-11 flex-1 rounded-xl">
      <FolderPlus className="size-4" />
      Collection
    </Button>
  );
}
