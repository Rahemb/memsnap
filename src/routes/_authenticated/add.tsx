import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { AlertCircle, CheckCircle2, ImagePlus, Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";

import { AppShell, PageHeader } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { analyzeScreenshot } from "@/lib/ai.functions";
import { findDuplicate, imageFingerprint, uploadScreenshot } from "@/lib/upload";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/add")({
  head: () => ({
    meta: [
      { title: "Add screenshots — Screenshot Inbox" },
      {
        name: "description",
        content: "Add screenshots and let them be titled, categorised and made searchable for you.",
      },
      { property: "og:title", content: "Add screenshots — Screenshot Inbox" },
      { property: "og:description", content: "Add screenshots and let them organise themselves." },
    ],
  }),
  component: AddPage,
});

type Item = {
  key: string;
  file: File;
  preview: string;
  state: "queued" | "uploading" | "analyzing" | "done" | "duplicate" | "error";
  message?: string;
  id?: string;
};

const STATE_LABEL: Record<Item["state"], string> = {
  queued: "Waiting",
  uploading: "Uploading",
  analyzing: "Reading it",
  done: "Saved",
  duplicate: "Already saved",
  error: "Failed",
};

function AddPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const analyze = useServerFn(analyzeScreenshot);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const patch = (key: string, next: Partial<Item>) =>
    setItems((prev) => prev.map((item) => (item.key === key ? { ...item, ...next } : item)));

  const addFiles = (files: FileList | File[]) => {
    const picked = Array.from(files)
      .filter((file) => file.type.startsWith("image/"))
      .slice(0, 30);
    if (!picked.length) {
      toast.error("Pick image files");
      return;
    }
    setItems((prev) => [
      ...prev,
      ...picked.map((file) => ({
        key: `${file.name}-${file.size}-${crypto.randomUUID()}`,
        file,
        preview: URL.createObjectURL(file),
        state: "queued" as const,
      })),
    ]);
  };

  const run = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Please sign in again.");
      const pending = items.filter((item) => item.state === "queued" || item.state === "error");

      for (const item of pending) {
        try {
          patch(item.key, { state: "uploading", message: undefined });
          const fingerprint = await imageFingerprint(item.file);
          const existing = await findDuplicate(user.id, fingerprint);
          if (existing) {
            patch(item.key, { state: "duplicate", id: existing.id });
            continue;
          }

          const { id } = await uploadScreenshot(user.id, item.file, fingerprint);
          patch(item.key, { state: "analyzing", id });
          void queryClient.invalidateQueries({ queryKey: ["screenshots"] });

          const result = await analyze({ data: { screenshotId: id } });
          if (result.ok) {
            patch(item.key, { state: "done" });
          } else {
            patch(item.key, { state: "error", message: result.message, id });
          }
        } catch (error) {
          patch(item.key, {
            state: "error",
            message: error instanceof Error ? error.message : "Something went wrong.",
          });
        }
      }

      void queryClient.invalidateQueries({ queryKey: ["screenshots"] });
      void queryClient.invalidateQueries({ queryKey: ["processing"] });
      void queryClient.invalidateQueries({ queryKey: ["category-counts"] });
    },
  });

  const done = items.filter((item) => item.state === "done" || item.state === "duplicate").length;
  const pending = items.filter((item) => item.state === "queued" || item.state === "error").length;

  return (
    <AppShell>
      <PageHeader title="Add screenshots" subtitle="They'll be read and filed automatically" />

      <div className="mx-auto max-w-2xl px-4 py-5">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(event) => {
            if (event.target.files) addFiles(event.target.files);
            event.target.value = "";
          }}
        />

        <button
          onClick={() => inputRef.current?.click()}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            if (event.dataTransfer.files) addFiles(event.dataTransfer.files);
          }}
          className={cn(
            "tap flex w-full flex-col items-center rounded-3xl border-2 border-dashed px-6 py-12 text-center transition-colors",
            dragging ? "border-primary bg-accent" : "border-border-strong bg-surface",
          )}
        >
          <span className="flex size-14 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
            <ImagePlus className="size-6" />
          </span>
          <span className="mt-4 text-[15.5px] font-semibold">Choose screenshots</span>
          <span className="mt-1.5 max-w-xs text-[13px] leading-relaxed text-muted-foreground">
            Pick up to 30 at a time from your camera roll, or drop them here on desktop.
          </span>
        </button>

        {items.length ? (
          <>
            <div className="mt-5 space-y-2">
              {items.map((item) => (
                <div
                  key={item.key}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-2.5"
                >
                  <img
                    src={item.preview}
                    alt=""
                    className="size-14 shrink-0 rounded-xl object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-medium">{item.file.name}</p>
                    <p
                      className={cn(
                        "mt-0.5 flex items-center gap-1.5 text-[12px]",
                        item.state === "error" ? "text-destructive" : "text-muted-foreground",
                      )}
                    >
                      {item.state === "uploading" || item.state === "analyzing" ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : null}
                      {item.state === "done" ? <CheckCircle2 className="size-3 text-success" /> : null}
                      {item.state === "error" ? <AlertCircle className="size-3" /> : null}
                      {STATE_LABEL[item.state]}
                      {item.message ? ` · ${item.message}` : ""}
                    </p>
                  </div>
                  {item.id && (item.state === "done" || item.state === "duplicate") ? (
                    <Link
                      to="/s/$id"
                      params={{ id: item.id }}
                      className="shrink-0 px-2 text-[12.5px] font-medium text-primary"
                    >
                      View
                    </Link>
                  ) : null}
                  {item.state === "queued" ? (
                    <button
                      onClick={() =>
                        setItems((prev) => prev.filter((other) => other.key !== item.key))
                      }
                      aria-label="Remove"
                      className="tap shrink-0 rounded-full p-2 text-muted-foreground"
                    >
                      <X className="size-4" />
                    </button>
                  ) : null}
                </div>
              ))}
            </div>

            <div className="mt-5 flex gap-2 pb-4">
              <Button
                onClick={() => run.mutate()}
                disabled={run.isPending || !pending}
                className="h-13 flex-1 rounded-xl text-[15px]"
              >
                {run.isPending ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                {run.isPending ? "Working…" : `Add ${pending || ""}`.trim()}
              </Button>
              {done ? (
                <Button
                  variant="outline"
                  className="h-13 rounded-xl px-5"
                  onClick={() => void navigate({ to: "/home" })}
                >
                  Done
                </Button>
              ) : null}
            </div>
          </>
        ) : null}

        <p className="mt-6 text-[12.5px] leading-relaxed text-muted-foreground">
          Screenshots often contain personal details, so yours are stored privately and only ever
          read to build your own searchable inbox.
        </p>
      </div>
    </AppShell>
  );
}
