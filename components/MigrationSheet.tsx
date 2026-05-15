"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Sheet } from "./Sheet";
import { showToast } from "./Toast";
import { assembleLocalPayload, detectLocalData, type LocalCounts } from "@/lib/migration";

export function MigrationSheet() {
  const { isSignedIn } = useAuth();
  const profile = useQuery(api.users.getProfile, isSignedIn ? {} : "skip");
  const markMigrated = useMutation(api.users.markMigrated);
  const replaceAll = useMutation(api.migration.replaceAll);
  const mergeLocal = useMutation(api.migration.mergeLocal);

  const [counts, setCounts] = useState<LocalCounts | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<null | "upload" | "merge" | "discard">(null);

  useEffect(() => {
    if (!isSignedIn) return;
    if (profile === undefined) return;
    if (profile && profile.migratedAt) return;
    detectLocalData()
      .then((c) => {
        if (c.total > 0) {
          setCounts(c);
          setOpen(true);
        } else {
          markMigrated({}).catch(console.error);
        }
      })
      .catch(console.error);
  }, [isSignedIn, profile, markMigrated]);

  async function handleUpload() {
    setBusy("upload");
    try {
      const payload = await assembleLocalPayload();
      await replaceAll(payload);
      showToast("Local data uploaded to your account", { emoji: "☁️" });
      setOpen(false);
    } catch (err) {
      console.error(err);
      showToast("Upload failed — try again", { emoji: "⚠️" });
    } finally {
      setBusy(null);
    }
  }

  async function handleMerge() {
    setBusy("merge");
    try {
      const payload = await assembleLocalPayload();
      await mergeLocal(payload);
      showToast("Local data merged with cloud", { emoji: "🔀" });
      setOpen(false);
    } catch (err) {
      console.error(err);
      showToast("Merge failed — try again", { emoji: "⚠️" });
    } finally {
      setBusy(null);
    }
  }

  async function handleDiscard() {
    setBusy("discard");
    try {
      await markMigrated({});
      showToast("Local data kept on-device", { emoji: "📦" });
      setOpen(false);
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(null);
    }
  }

  if (!open || !counts) return null;

  return (
    <Sheet open={open} onClose={() => setOpen(false)} title="Sync your local data?">
      <p className="mb-4 text-sm text-[var(--color-ink-3)]">
        You have data on this device that isn't in your account yet. Pick what
        to do — your local data stays put until you decide.
      </p>
      <div className="mb-4 grid grid-cols-3 gap-2">
        <Stat label="Logged" value={counts.transactions} />
        <Stat label="Categories" value={counts.categories} />
        <Stat label="Accounts" value={counts.accounts} />
      </div>
      <div className="space-y-2">
        <Choice
          title="Upload local data"
          hint="Replace anything in your cloud account with what's on this device."
          onClick={handleUpload}
          loading={busy === "upload"}
          primary
        />
        <Choice
          title="Merge with cloud"
          hint="Insert local rows that aren't already in the cloud; cloud wins on conflicts."
          onClick={handleMerge}
          loading={busy === "merge"}
        />
        <Choice
          title="Discard local"
          hint="Pull cloud data only. Your local copy stays here untouched."
          onClick={handleDiscard}
          loading={busy === "discard"}
        />
      </div>
    </Sheet>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[14px] bg-[var(--color-surface-2)] p-2 text-center">
      <div className="font-display text-lg tabular">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-[var(--color-ink-3)]">
        {label}
      </div>
    </div>
  );
}

function Choice({
  title,
  hint,
  onClick,
  loading,
  primary,
}: {
  title: string;
  hint: string;
  onClick: () => void;
  loading?: boolean;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className={
        "w-full rounded-[18px] px-4 py-3 text-left disabled:opacity-40 " +
        (primary
          ? "bg-[var(--color-ink)] text-[var(--color-bg)]"
          : "border border-[var(--color-line)] bg-[var(--color-surface)]")
      }
    >
      <div className="text-sm font-medium">{loading ? "Working…" : title}</div>
      <div
        className={
          "mt-0.5 text-xs " +
          (primary ? "opacity-70" : "text-[var(--color-ink-3)]")
        }
      >
        {hint}
      </div>
    </button>
  );
}
