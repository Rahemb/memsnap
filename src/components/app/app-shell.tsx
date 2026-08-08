import { Link, useRouterState } from "@tanstack/react-router";
import { FolderOpen, Home, Inbox, Plus, Search, User } from "lucide-react";
import type { ReactNode } from "react";

import { BottomNav } from "@/components/app/bottom-nav";
import { cn } from "@/lib/utils";

const links = [
  { to: "/home", label: "Inbox", icon: Home },
  { to: "/search", label: "Search", icon: Search },
  { to: "/add", label: "Add", icon: Plus },
  { to: "/collections", label: "Collections", icon: FolderOpen },
  { to: "/profile", label: "Profile", icon: User },
] as const;

/** Mobile-first app frame: bottom tabs on phones, quiet sidebar on desktop. */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="min-h-screen bg-background md:flex">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-border bg-sidebar px-4 py-6 md:flex">
        <Link to="/home" className="mb-8 flex items-center gap-2 px-2">
          <span className="flex size-8 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Inbox className="size-4" />
          </span>
          <span className="text-[15px] font-semibold tracking-tight">Screenshot Inbox</span>
        </Link>

        <nav className="flex flex-col gap-1">
          {links.map(({ to, label, icon: Icon }) => {
            const active = pathname === to || pathname.startsWith(`${to}/`);
            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  "tap flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent/60",
                )}
              >
                <Icon className="size-[18px]" />
                {label}
              </Link>
            );
          })}
        </nav>

        <p className="mt-auto px-3 text-xs leading-relaxed text-muted-foreground">
          Everything you save stays private to your account.
        </p>
      </aside>

      <main className="min-w-0 flex-1 pb-nav md:pb-10">{children}</main>
      <BottomNav />
    </div>
  );
}

/** Sticky page header that mimics a native large-title bar. */
export function PageHeader({
  title,
  subtitle,
  action,
  back,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  back?: ReactNode;
}) {
  return (
    <header className="glass-bar sticky top-0 z-30 border-b border-border pt-safe">
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3.5">
        {back}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[22px] font-semibold tracking-tight">{title}</h1>
          {subtitle ? (
            <p className="truncate text-[13px] text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
        {action}
      </div>
    </header>
  );
}
