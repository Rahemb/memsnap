import { Link, useRouterState } from "@tanstack/react-router";
import { FolderOpen, Home, Plus, Search, User } from "lucide-react";

import { cn } from "@/lib/utils";

const items = [
  { to: "/home", label: "Home", icon: Home },
  { to: "/search", label: "Search", icon: Search },
  { to: "/collections", label: "Collections", icon: FolderOpen },
  { to: "/profile", label: "Profile", icon: User },
] as const;

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isActive = (to: string) => pathname === to || pathname.startsWith(`${to}/`);

  return (
    <nav
      aria-label="Main"
      className="glass-bar fixed inset-x-0 bottom-0 z-40 border-t border-border pb-safe md:hidden"
    >
      <div className="relative mx-auto grid max-w-lg grid-cols-5 items-end px-2 pt-1.5 pb-1.5">
        {items.slice(0, 2).map((item) => (
          <NavButton key={item.to} {...item} active={isActive(item.to)} />
        ))}

        <div className="flex justify-center">
          <Link
            to="/add"
            aria-label="Add screenshots"
            className={cn(
              "tap -mt-6 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lift active:scale-95",
              isActive("/add") && "ring-4 ring-accent",
            )}
          >
            <Plus className="size-7" strokeWidth={2.4} />
          </Link>
        </div>

        {items.slice(2).map((item) => (
          <NavButton key={item.to} {...item} active={isActive(item.to)} />
        ))}
      </div>
    </nav>
  );
}

function NavButton({
  to,
  label,
  icon: Icon,
  active,
}: {
  to: string;
  label: string;
  icon: typeof Home;
  active: boolean;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "tap flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-medium active:scale-95",
        active ? "text-primary" : "text-muted-foreground",
      )}
    >
      <Icon className="size-[22px]" strokeWidth={active ? 2.4 : 1.9} />
      {label}
    </Link>
  );
}
