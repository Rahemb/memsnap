import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Archive, LogOut, Monitor, Moon, ShieldCheck, Sun } from "lucide-react";
import { toast } from "sonner";

import { AppShell, PageHeader } from "@/components/app/app-shell";
import { SectionHeader } from "@/components/app/empty-state";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { fetchStats } from "@/lib/queries";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Your account — Screenshot Inbox" },
      {
        name: "description",
        content: "Your account, appearance, storage and privacy settings for Screenshot Inbox.",
      },
      { property: "og:title", content: "Your account — Screenshot Inbox" },
      { property: "og:description", content: "Account, appearance and privacy settings." },
    ],
  }),
  component: ProfilePage,
});

function formatBytes(bytes: number) {
  if (!bytes) return "0 MB";
  const mb = bytes / 1_048_576;
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb.toFixed(1)} MB`;
}

function ProfilePage() {
  const { user } = useAuth();
  const { mode, setMode } = useTheme();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const stats = useQuery({ queryKey: ["stats"], queryFn: fetchStats });

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    toast.success("Signed out");
    void navigate({ to: "/auth", replace: true });
  };

  const initial = (user?.email ?? "?").charAt(0).toUpperCase();

  return (
    <AppShell>
      <PageHeader title="You" subtitle="Account and settings" />

      <div className="mx-auto max-w-2xl space-y-7 px-4 py-5">
        <div className="surface-card flex items-center gap-4 p-4">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary text-[20px] font-semibold text-primary-foreground">
            {initial}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold">{user?.email}</p>
            <p className="text-[12.5px] text-muted-foreground">Private inbox</p>
          </div>
        </div>

        <section>
          <SectionHeader title="Your library" />
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Screenshots" value={String(stats.data?.screenshots ?? 0)} />
            <Stat label="Collections" value={String(stats.data?.collections ?? 0)} />
            <Stat label="Storage" value={formatBytes(stats.data?.bytes ?? 0)} />
          </div>
        </section>

        <section>
          <SectionHeader title="Appearance" />
          <div className="flex gap-1 rounded-full bg-muted p-1">
            {(
              [
                { key: "light", label: "Light", icon: Sun },
                { key: "dark", label: "Dark", icon: Moon },
                { key: "system", label: "Auto", icon: Monitor },
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
        </section>

        <section>
          <SectionHeader title="Manage" />
          <div className="surface-card divide-y divide-border">
            <Link
              to="/archive"
              className="tap flex items-center gap-3 px-4 py-3.5 text-[14.5px] font-medium"
            >
              <Archive className="size-4 text-muted-foreground" />
              Archived screenshots
            </Link>
            <div className="flex items-start gap-3 px-4 py-3.5">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" />
              <p className="text-[13px] leading-relaxed text-muted-foreground">
                Your screenshots are stored privately and are only readable by your own account. They
                are never shown to other people, and deleting one removes both the image and its
                details.
              </p>
            </div>
          </div>
        </section>

        <Button
          variant="outline"
          className="h-12 w-full rounded-xl text-destructive"
          onClick={() => void signOut()}
        >
          <LogOut className="size-4" />
          Sign out
        </Button>
      </div>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface-card p-3.5">
      <p className="text-[19px] font-semibold tracking-tight">{value}</p>
      <p className="mt-0.5 text-[12px] text-muted-foreground">{label}</p>
    </div>
  );
}
