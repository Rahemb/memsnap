import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2, LockKeyhole } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Choose a new password — Screenshot Inbox" },
      { name: "description", content: "Set a new password for your Screenshot Inbox account." },
      { property: "og:title", content: "Choose a new password — Screenshot Inbox" },
      { property: "og:description", content: "Set a new password for your account." },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password.length < 8) {
      toast.error("Use at least 8 characters");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Password updated");
    void navigate({ to: "/home", replace: true });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm">
        <span className="mb-6 flex size-12 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
          <LockKeyhole className="size-5" />
        </span>
        <h1 className="text-[26px] font-semibold tracking-tight">Choose a new password</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Open this page from the reset link in your email.
        </p>
        <form onSubmit={submit} className="mt-7 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-password">New password</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              className="h-12 rounded-xl text-base"
            />
          </div>
          <Button type="submit" disabled={busy} className="h-12 w-full rounded-xl">
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            Update password
          </Button>
        </form>
      </div>
    </div>
  );
}
