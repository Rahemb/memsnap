import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Inbox, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { lovable } from "@/integrations/lovable/index";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in — Screenshot Inbox" },
      {
        name: "description",
        content:
          "Sign in to Screenshot Inbox to save screenshots and find them later by describing what you remember.",
      },
      { property: "og:title", content: "Sign in — Screenshot Inbox" },
      {
        property: "og:description",
        content: "Your private, searchable screenshot memory.",
      },
    ],
  }),
  component: AuthPage,
});

type Mode = "signin" | "signup" | "forgot";

const schema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(8, "Use at least 8 characters"),
});

function AuthPage() {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<null | "confirm" | "reset">(null);
  const navigate = useNavigate();
  const { session, loading } = useAuth();

  useEffect(() => {
    if (!loading && session) void navigate({ to: "/home", replace: true });
  }, [loading, session, navigate]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      if (mode === "forgot") {
        const parsedEmail = z.string().email().safeParse(email);
        if (!parsedEmail.success) throw new Error("Enter a valid email address");
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setSent("reset");
        return;
      }

      const parsed = schema.safeParse({ email, password });
      if (!parsed.success) throw new Error(parsed.error.issues[0]!.message);

      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { display_name: name.trim() || undefined },
          },
        });
        if (error) throw error;
        if (!data.session) {
          setSent("confirm");
          return;
        }
        void navigate({ to: "/onboarding", replace: true });
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      void navigate({ to: "/home", replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setBusy(false);
      toast.error("Could not sign in with Google");
      return;
    }
    if (result.redirected) return;
    void navigate({ to: "/home", replace: true });
  };

  if (sent) {
    return (
      <Shell>
        <h1 className="text-[26px] font-semibold tracking-tight">Check your email</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {sent === "confirm"
            ? `We sent a confirmation link to ${email}. Open it to finish setting up your inbox.`
            : `We sent a password reset link to ${email}.`}
        </p>
        <Button
          variant="outline"
          className="mt-6 h-12 w-full rounded-xl"
          onClick={() => {
            setSent(null);
            setMode("signin");
          }}
        >
          Back to sign in
        </Button>
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 className="text-[26px] font-semibold tracking-tight">
        {mode === "signup"
          ? "Create your inbox"
          : mode === "forgot"
            ? "Reset your password"
            : "Welcome back"}
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {mode === "forgot"
          ? "We'll email you a link to choose a new password."
          : "Your screenshots stay private to your account."}
      </p>

      <form onSubmit={submit} className="mt-7 space-y-4">
        {mode === "signup" ? (
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              placeholder="Your name"
              className="h-12 rounded-xl text-base"
            />
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="h-12 rounded-xl text-base"
          />
        </div>

        {mode !== "forgot" ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              {mode === "signin" ? (
                <button
                  type="button"
                  onClick={() => setMode("forgot")}
                  className="text-xs font-medium text-primary"
                >
                  Forgot?
                </button>
              ) : null}
            </div>
            <Input
              id="password"
              type="password"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              className="h-12 rounded-xl text-base"
            />
          </div>
        ) : null}

        <Button type="submit" disabled={busy} className="h-12 w-full rounded-xl text-[15px]">
          {busy ? <Loader2 className="size-4 animate-spin" /> : null}
          {mode === "signup" ? "Create account" : mode === "forgot" ? "Send reset link" : "Sign in"}
        </Button>
      </form>

      {mode !== "forgot" ? (
        <>
          <div className="my-6 flex items-center gap-3 text-[11px] uppercase tracking-wide text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            or
            <span className="h-px flex-1 bg-border" />
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={google}
            className="h-12 w-full rounded-xl text-[15px]"
          >
            Continue with Google
          </Button>
        </>
      ) : null}

      <p className="mt-7 text-center text-sm text-muted-foreground">
        {mode === "signup" ? "Already have an account?" : "New to Screenshot Inbox?"}{" "}
        <button
          type="button"
          className="font-medium text-primary"
          onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
        >
          {mode === "signup" ? "Sign in" : "Create one"}
        </button>
      </p>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background px-6 pt-safe">
      <div className="flex items-center py-4">
        <Link
          to="/"
          className="tap -ml-2 flex size-10 items-center justify-center rounded-full text-muted-foreground active:scale-95"
          aria-label="Back"
        >
          <ArrowLeft className="size-5" />
        </Link>
      </div>
      <div className="mx-auto w-full max-w-sm flex-1 pb-16">
        <span className="mb-6 flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <Inbox className="size-6" />
        </span>
        {children}
      </div>
    </div>
  );
}
