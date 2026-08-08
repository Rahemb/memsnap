import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Car, ChefHat, Plane, ShoppingBag, Ticket, UtensilsCrossed } from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/onboarding")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Welcome — Screenshot Inbox" },
      {
        name: "description",
        content: "A one-minute tour of how Screenshot Inbox turns screenshots into searchable memories.",
      },
      { property: "og:title", content: "Welcome — Screenshot Inbox" },
      { property: "og:description", content: "How Screenshot Inbox works, in three screens." },
    ],
  }),
  component: Onboarding,
});

const chips = [
  { label: "Restaurant", icon: UtensilsCrossed },
  { label: "Product", icon: ShoppingBag },
  { label: "Travel", icon: Plane },
  { label: "Recipe", icon: ChefHat },
  { label: "Event", icon: Ticket },
  { label: "Car", icon: Car },
];

function Onboarding() {
  const [step, setStep] = useState(0);
  const navigate = useNavigate();
  const { session, loading } = useAuth();

  useEffect(() => {
    if (!loading && !session) void navigate({ to: "/auth", replace: true });
  }, [loading, session, navigate]);

  const finish = async () => {
    if (session?.user) {
      await supabase.from("profiles").update({ onboarded: true }).eq("id", session.user.id);
    }
    void navigate({ to: "/home", replace: true });
  };

  return (
    <div className="flex min-h-screen flex-col bg-background px-6 pt-safe">
      <div className="flex items-center justify-between py-4">
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === step ? "w-6 bg-primary" : "w-1.5 bg-border-strong",
              )}
            />
          ))}
        </div>
        <button onClick={finish} className="text-sm font-medium text-muted-foreground">
          Skip
        </button>
      </div>

      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center pb-10">
        {step === 0 ? (
          <div key="s0" className="animate-rise">
            <h1 className="text-[32px] leading-[1.1] font-semibold tracking-tight">
              Your screenshots
              <br />
              <span className="text-display italic text-primary">remember everything.</span>
            </h1>
            <p className="mt-4 text-[15.5px] leading-relaxed text-muted-foreground">
              Screenshot Inbox turns the screenshots that disappear into your camera roll into
              searchable memories you can actually find again.
            </p>
          </div>
        ) : null}

        {step === 1 ? (
          <div key="s1" className="animate-rise">
            <h1 className="text-[32px] leading-[1.1] font-semibold tracking-tight">
              Drop screenshots.
              <br />
              <span className="text-display italic text-primary">We organise them.</span>
            </h1>
            <p className="mt-4 text-[15.5px] leading-relaxed text-muted-foreground">
              Each screenshot is read for you — the place, the product, the price, the text inside it.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {chips.map(({ label, icon: Icon }) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3.5 py-2 text-[13px] font-medium"
                >
                  <Icon className="size-3.5 text-primary" />
                  {label}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div key="s2" className="animate-rise">
            <h1 className="text-[32px] leading-[1.1] font-semibold tracking-tight">
              Search the way
              <br />
              <span className="text-display italic text-primary">you remember.</span>
            </h1>
            <p className="mt-4 text-[15.5px] leading-relaxed text-muted-foreground">
              No folders, no tagging. Just describe it.
            </p>
            <div className="surface-card mt-6 p-4">
              <p className="text-[15px]">“that Italian restaurant I saved in London”</p>
              <p className="mt-2 text-[12.5px] text-muted-foreground">
                Your own words are enough.
              </p>
            </div>
          </div>
        ) : null}
      </div>

      <div className="mx-auto w-full max-w-sm pb-safe">
        <Button
          className="mb-6 h-13 w-full rounded-xl text-[15px]"
          onClick={() => (step === 2 ? void finish() : setStep(step + 1))}
        >
          {step === 2 ? "Start my inbox" : "Continue"}
          <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
