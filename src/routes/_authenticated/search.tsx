import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ArrowUp, Loader2, Search as SearchIcon, Sparkles } from "lucide-react";

import { AppShell, PageHeader } from "@/components/app/app-shell";
import { EmptyState, SectionHeader } from "@/components/app/empty-state";
import { CardSkeleton, ScreenshotMasonry } from "@/components/app/screenshot-card";
import { Button } from "@/components/ui/button";
import { askScreenshots, semanticSearch } from "@/lib/ai.functions";
import { fetchScreenshots, keywordSearch } from "@/lib/queries";
import type { Screenshot } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/search")({
  head: () => ({
    meta: [
      { title: "Search your screenshots — Screenshot Inbox" },
      {
        name: "description",
        content:
          "Find any screenshot by describing what you remember, or ask a question about everything you saved.",
      },
      { property: "og:title", content: "Search your screenshots — Screenshot Inbox" },
      {
        property: "og:description",
        content: "Describe what you remember and find the screenshot again.",
      },
    ],
  }),
  component: SearchPage,
});

const EXAMPLES = [
  "italian restaurant london",
  "black shoes",
  "hotels in turkey",
  "movies to watch",
];

type Mode = "find" | "ask";

function SearchPage() {
  const [mode, setMode] = useState<Mode>("find");
  const [term, setTerm] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [answer, setAnswer] = useState<{ text: string; shots: Screenshot[] } | null>(null);

  const runSemantic = useServerFn(semanticSearch);
  const runAsk = useServerFn(askScreenshots);

  const results = useQuery({
    queryKey: ["search", submitted],
    enabled: mode === "find" && submitted.length > 0,
    queryFn: async () => {
      const [keyword, semantic] = await Promise.all([
        keywordSearch(submitted),
        runSemantic({ data: { query: submitted, limit: 24 } }).catch(() => null),
      ]);

      const merged = new Map<string, Screenshot>(keyword.map((shot) => [shot.id, shot]));
      const missing = (semantic?.matches ?? [])
        .map((match) => match.id)
        .filter((id) => !merged.has(id));
      if (missing.length) {
        for (const shot of await fetchScreenshots({ ids: missing })) merged.set(shot.id, shot);
      }
      return [...merged.values()];
    },
  });

  const ask = useMutation({
    mutationFn: async (question: string) => {
      const result = await runAsk({ data: { question } });
      const shots = result.screenshotIds.length
        ? await fetchScreenshots({ ids: result.screenshotIds })
        : [];
      return { text: result.answer || "I couldn't find an answer in your screenshots.", shots };
    },
    onSuccess: (data) => setAnswer(data),
    onError: () =>
      setAnswer({ text: "Asking isn't available right now — try searching instead.", shots: [] }),
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const cleaned = term.trim();
    if (!cleaned) return;
    if (mode === "find") {
      setSubmitted(cleaned);
    } else {
      setAnswer(null);
      ask.mutate(cleaned);
    }
  };

  const shots = results.data ?? [];

  return (
    <AppShell>
      <PageHeader
        title={mode === "find" ? "Search" : "Ask"}
        subtitle={mode === "find" ? "Describe what you remember" : "Ask about everything you saved"}
      />

      <div className="mx-auto max-w-3xl px-4 py-4">
        <div className="flex gap-1 rounded-full bg-muted p-1">
          {(
            [
              { key: "find", label: "Search", icon: SearchIcon },
              { key: "ask", label: "Ask", icon: Sparkles },
            ] as const
          ).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setMode(key)}
              className={cn(
                "tap flex flex-1 items-center justify-center gap-1.5 rounded-full py-2.5 text-[13.5px] font-medium",
                mode === key ? "bg-surface text-foreground shadow-soft" : "text-muted-foreground",
              )}
            >
              <Icon className="size-3.5" />
              {label}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="mt-4 flex items-center gap-2">
          <input
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            enterKeyHint="search"
            placeholder={
              mode === "find" ? "that pasta place in Rome" : "which restaurants did I save in London?"
            }
            className="h-13 min-w-0 flex-1 rounded-2xl border border-border bg-surface px-4 text-[15px] outline-none placeholder:text-muted-foreground focus:border-ring"
          />
          <Button
            type="submit"
            disabled={ask.isPending || results.isFetching}
            className="size-13 shrink-0 rounded-2xl p-0"
            aria-label="Search"
          >
            {ask.isPending || results.isFetching ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ArrowUp className="size-4" />
            )}
          </Button>
        </form>

        {!submitted && !answer ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {EXAMPLES.map((example) => (
              <button
                key={example}
                onClick={() => {
                  setTerm(example);
                  if (mode === "find") setSubmitted(example);
                  else ask.mutate(example);
                }}
                className="tap rounded-full border border-border bg-surface px-3.5 py-2 text-[13px] text-muted-foreground"
              >
                {example}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="mx-auto max-w-3xl px-4 pb-8">
        {mode === "ask" ? (
          <>
            {ask.isPending ? (
              <div className="surface-card flex items-center gap-3 p-4">
                <Loader2 className="size-4 animate-spin text-primary" />
                <p className="text-[13.5px] text-muted-foreground">Looking through your inbox…</p>
              </div>
            ) : null}

            {answer ? (
              <div className="animate-rise space-y-5">
                <div className="surface-card p-4">
                  <p className="whitespace-pre-line text-[15px] leading-relaxed">{answer.text}</p>
                </div>
                {answer.shots.length ? (
                  <section>
                    <SectionHeader title="From these screenshots" />
                    <ScreenshotMasonry shots={answer.shots} />
                  </section>
                ) : null}
              </div>
            ) : null}

            {!answer && !ask.isPending ? (
              <EmptyState
                icon={Sparkles}
                title="Ask about your inbox"
                description="Try “what restaurants did I save in Paris?” or “which shoes did I want to buy?”"
              />
            ) : null}
          </>
        ) : (
          <>
            {results.isFetching ? <CardSkeleton count={4} /> : null}

            {!results.isFetching && submitted && shots.length ? (
              <>
                <SectionHeader
                  title={`${shots.length} ${shots.length === 1 ? "result" : "results"}`}
                  hint={`for “${submitted}”`}
                />
                <ScreenshotMasonry shots={shots} />
              </>
            ) : null}

            {!results.isFetching && submitted && !shots.length ? (
              <EmptyState
                icon={SearchIcon}
                title="Nothing matched"
                description="Try fewer words, or a detail you remember from the screenshot itself."
                action={
                  <Button asChild variant="outline" className="h-11 rounded-xl px-5">
                    <Link to="/home">Back to inbox</Link>
                  </Button>
                }
              />
            ) : null}

            {!submitted ? (
              <EmptyState
                icon={SearchIcon}
                title="Search how you remember"
                description="Names, places, prices or even the words inside the screenshot all work."
              />
            ) : null}
          </>
        )}
      </div>
    </AppShell>
  );
}
