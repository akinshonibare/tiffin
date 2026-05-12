"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Receipt,
  Wallet,
  PieChart,
  Plus,
  Settings as SettingsIcon,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { AddTransactionSheet } from "./AddTransactionSheet";

const TABS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/transactions", label: "Activity", icon: Receipt },
  { href: "/budgets", label: "Budgets", icon: Wallet },
  { href: "/summary", label: "Insights", icon: PieChart },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [addOpen, setAddOpen] = useState(false);
  const immersive = pathname.startsWith("/play");
  const hideFab = immersive || pathname.startsWith("/settings");

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col">
      <main className={cn("flex-1", immersive ? "pb-6" : "pb-32")}>
        {children}
      </main>

      {!hideFab && (
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          aria-label="Add expense"
          style={{
            bottom: "calc(env(safe-area-inset-bottom) + 6rem)",
          }}
          className="fixed left-1/2 z-30 -translate-x-1/2 rounded-full bg-[var(--color-ink)] px-5 py-3.5 text-[var(--color-bg)] shadow-[0_10px_30px_-10px_rgba(0,0,0,0.5)] active:scale-95 transition-transform"
        >
          <span className="flex items-center gap-2 text-sm font-medium">
            <Plus className="size-4" strokeWidth={2.4} />
            Add expense
          </span>
        </button>
      )}

      {!immersive && (
      <nav
        aria-label="Primary"
        className="fixed bottom-0 left-1/2 z-20 w-full max-w-xl -translate-x-1/2 border-t border-[var(--color-line)] bg-[var(--color-surface)]/85 backdrop-blur safe-bottom"
      >
        <ul className="grid grid-cols-5">
          {TABS.map((t) => {
            const active =
              t.href === "/"
                ? pathname === "/"
                : pathname.startsWith(t.href);
            const Icon = t.icon;
            return (
              <li key={t.href} className="contents">
                <Link
                  href={t.href}
                  prefetch
                  className={cn(
                    "flex flex-col items-center gap-1 pt-3 pb-1 text-[11px]",
                    active
                      ? "text-[var(--color-ink)]"
                      : "text-[var(--color-ink-3)]",
                  )}
                >
                  <Icon
                    className="size-5"
                    strokeWidth={active ? 2.2 : 1.8}
                  />
                  <span>{t.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      )}

      <AddTransactionSheet open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}
