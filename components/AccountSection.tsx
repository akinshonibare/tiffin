"use client";

import { useState } from "react";
import { useClerk, useUser } from "@clerk/nextjs";
import { Cloud, User as UserIcon } from "lucide-react";
import { isClerkConfigured } from "@/lib/convex";
import { AccountSheet } from "./AccountSheet";

export function AccountSection() {
  if (!isClerkConfigured()) {
    return (
      <div className="divide-y divide-[var(--color-line)] rounded-[22px] bg-[var(--color-surface)]">
        <div className="flex items-center gap-3 px-4 py-3 text-[var(--color-ink-3)]">
          <Cloud className="size-4" />
          <div className="flex-1 text-sm">
            Cloud sync isn't configured for this build.
          </div>
        </div>
      </div>
    );
  }
  return <Inner />;
}

function Inner() {
  const { openSignIn } = useClerk();
  const { isLoaded, isSignedIn, user } = useUser();
  const [sheetOpen, setSheetOpen] = useState(false);

  if (!isLoaded) {
    return (
      <div className="rounded-[22px] bg-[var(--color-surface)] px-4 py-4 text-sm text-[var(--color-ink-3)]">
        Loading…
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="divide-y divide-[var(--color-line)] rounded-[22px] bg-[var(--color-surface)]">
        <button
          type="button"
          onClick={() => openSignIn({})}
          className="flex w-full items-center gap-3 px-4 py-3 text-left"
        >
          <Cloud className="size-4" />
          <div className="flex-1">
            <div className="text-sm font-medium">Sign in to sync</div>
            <div className="text-xs text-[var(--color-ink-3)]">
              Move your data between devices, unlock AI features
            </div>
          </div>
          <span className="text-[var(--color-ink-3)]">›</span>
        </button>
      </div>
    );
  }

  const email = user?.primaryEmailAddress?.emailAddress;
  const name = user?.fullName ?? email ?? "Signed in";

  return (
    <>
      <div className="rounded-[22px] bg-[var(--color-surface)]">
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="flex w-full items-center gap-3 px-4 py-3 text-left"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-surface-2)]">
            <UserIcon className="size-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="truncate text-sm font-medium">{name}</div>
            {email && name !== email && (
              <div className="truncate text-xs text-[var(--color-ink-3)]">
                {email}
              </div>
            )}
          </div>
          <span className="text-[var(--color-ink-3)]">›</span>
        </button>
      </div>
      <AccountSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </>
  );
}
