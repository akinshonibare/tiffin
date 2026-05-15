"use client";

import { useState } from "react";
import { useAuth, useClerk, useUser } from "@clerk/nextjs";
import { useMutation } from "convex/react";
import { Trash2, LogOut, ShieldAlert } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Sheet } from "./Sheet";
import { showToast } from "./Toast";
import { wipeUserDB } from "@/lib/db";

export function AccountSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { user } = useUser();
  const { userId } = useAuth();
  const { signOut } = useClerk();
  const deleteSelf = useMutation(api.users.deleteSelf);

  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  const email = user?.primaryEmailAddress?.emailAddress;
  const name = user?.fullName ?? email ?? "Signed in";

  async function handleSignOut() {
    setBusy(true);
    try {
      if (userId) {
        await wipeUserDB(userId).catch(console.error);
      }
      await signOut({ redirectUrl: "/" });
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!user) return;
    setBusy(true);
    try {
      // 1. Wipe Convex data
      await deleteSelf({}).catch((err) => {
        console.error("convex delete failed", err);
        throw err;
      });
      // 2. Wipe local cache
      if (userId) {
        await wipeUserDB(userId).catch(console.error);
      }
      // 3. Delete the Clerk user (signs them out as a side effect)
      await user.delete();
      // Clerk redirects automatically after self-delete
      window.location.href = "/";
    } catch (err) {
      console.error(err);
      showToast("Couldn't delete account — try again", { emoji: "⚠️" });
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Account">
      <div className="mb-4 rounded-[18px] bg-[var(--color-surface-2)] p-4">
        <div className="text-sm font-medium">{name}</div>
        {email && name !== email && (
          <div className="mt-0.5 text-xs text-[var(--color-ink-3)]">
            {email}
          </div>
        )}
      </div>

      <div className="divide-y divide-[var(--color-line)] rounded-[18px] bg-[var(--color-surface-2)]">
        <button
          type="button"
          onClick={handleSignOut}
          disabled={busy}
          className="flex w-full items-center gap-3 px-4 py-3 text-left disabled:opacity-40"
        >
          <LogOut className="size-4 text-[var(--color-ink-3)]" />
          <div className="flex-1 text-sm font-medium">Sign out</div>
        </button>
        <button
          type="button"
          onClick={() => setConfirm(true)}
          disabled={busy}
          className="flex w-full items-center gap-3 px-4 py-3 text-left text-[var(--color-danger)] disabled:opacity-40"
        >
          <Trash2 className="size-4" />
          <div className="flex-1">
            <div className="text-sm font-medium">Delete account</div>
            <div className="text-xs text-[var(--color-ink-3)]">
              Removes everything from the cloud and this device
            </div>
          </div>
        </button>
      </div>

      {confirm && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-5">
          <div className="w-full max-w-sm rounded-[22px] bg-[var(--color-surface)] p-5">
            <div className="mb-2 flex items-center gap-2">
              <ShieldAlert className="size-5 text-[var(--color-danger)]" />
              <h3 className="text-lg font-medium">Delete your account?</h3>
            </div>
            <p className="text-sm text-[var(--color-ink-3)]">
              This permanently removes all your Tiffin data — transactions,
              budgets, categories, and history — from the cloud. Your local
              cache on this device is wiped too. This can't be undone.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setConfirm(false)}
                disabled={busy}
                className="flex-1 rounded-full border border-[var(--color-line)] py-2.5 text-sm disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={busy}
                className="flex-1 rounded-full bg-[var(--color-danger)] py-2.5 text-sm font-medium text-white disabled:opacity-40"
              >
                {busy ? "Deleting…" : "Delete everything"}
              </button>
            </div>
          </div>
        </div>
      )}
    </Sheet>
  );
}
