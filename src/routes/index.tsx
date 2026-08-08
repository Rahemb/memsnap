import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { ArrowRight, Inbox, Search, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Screenshot Inbox — Save anything, find it later" },
      {
        name: "description",
        content:
          "Screenshot Inbox turns forgotten screenshots into a searchable personal memory. Save restaurants, products, hotels and recipes, then find them by describing what you remember.",
      },
      { property: "og:title", content: "Screenshot Inbox — Save anything, find it later" },
      {
        property: "og:description",
        content:
          "Your screenshots remember everything. Add them once and find them later by describing what you remember.",
      },
    ],
  }),
  component: Landing,
});

const examples = [
  "that Italian restaurant I saved in London",
  "black shoes I wanted",
  "hotels from my Turkey trip",
  "movies I wanted to watch",
];

function Landing() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && session) void navigate({ to: "/home", replace: true });
  }, [loading, session, navigate]);

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-4xl items-center justify-between px-5 pt-safe">
        <div className="flex items-center gap-2 py-4">
          <span className="flex size-8 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Inbox className="size-4" />
          </span>
          <span className="text-[15px] font-semibold tracking-tight">Screenshot Inbox</span>
        </div>
        <Link to="/auth" className="text-sm font-medium text-primary">
          Sign in
        </Link>
      </header>

      <main className="mx-auto max-w-4xl px-5 pb-20">
        <section className="animate-rise pt-10 md:pt-20">
          <p className="text-[12.5px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Your visual memory
          </p>
          <h1 className="mt-4 max-w-2xl text-[38px] leading-[1.05] font-semibold tracking-tight md:text-6xl">
            Your screenshots
            <br />
            <span className="text-display italic text-primary">remember everything.</span>
          </h1>
          <p className="mt-5 max-w-md text-[15.5px] leading-relaxed text-muted-foreground">
            Restaurants, products, hotels, recipes, things you want to do later. Add a screenshot and
            find it again by describing what you remember.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild className="h-13 rounded-xl px-6 text-[15px]">
              <Link to="/auth">
                Start my inbox
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </section>

        <section className="mt-14 grid gap-3 sm:grid-cols-3">
          {[
            {
              icon: Inbox,
              title: "Drop screenshots",
              body: "Add one or a hundred. Titles, categories and details are filled in for you.",
            },
            {
              icon: Sparkles,
              title: "Quietly organised",
              body: "Restaurant, product, travel, recipe, event — grouped without you sorting a thing.",
            },
            {
              icon: Search,
              title: "Search how you remember",
              body: "Describe it in your own words instead of scrolling your camera roll.",
            },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="surface-card p-5">
              <Icon className="size-5 text-primary" />
              <h2 className="mt-3 text-[15px] font-semibold tracking-tight">{title}</h2>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground">{body}</p>
            </div>
          ))}
        </section>

        <section className="surface-card mt-4 p-5">
          <h2 className="text-[15px] font-semibold tracking-tight">Things you'll be able to ask</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {examples.map((example) => (
              <li
                key={example}
                className="rounded-full bg-muted px-3.5 py-2 text-[13px] text-muted-foreground"
              >
                “{example}”
              </li>
            ))}
          </ul>
        </section>

        <p className="mt-10 text-[13px] leading-relaxed text-muted-foreground">
          Screenshots can hold personal information, so everything you add stays private to your own
          account. You can export or delete it at any time.
        </p>
      </main>
    </div>
  );
}
