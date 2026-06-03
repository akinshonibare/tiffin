"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Sheet } from "./Sheet";
import { showToast } from "./Toast";
import { assembleLocalPayload, detectLocalData } from "@/lib/migration";
import {
  assembleDiffPayload,
  computeLocalDiff,
  computeLocalHash,
  diffPreviewLines,
  summarizeDiff,
  type CloudSnapshot,
  type DiffLine,
  type LocalDiff,
} from "@/lib/diff";
import type {
  Account,
  Budget,
  Card,
  Category,
  Recurrence,
  Transaction,
} from "@/lib/types";

const HASH_KEY = (userId: string) => `tiffin.lastReviewedHash.${userId}`;

function stripCloud<T extends { id: string }>(doc: any): T {
  const { clientId, userId: _u, _id, _creationTime, ...rest } = doc;
  void _u;
  void _id;
  void _creationTime;
  return { ...(rest as object), id: clientId } as T;
}

type Mode = "firstTime" | "reSync";

export function MigrationSheet() {
  const { isSignedIn, userId } = useAuth();
  const profile = useQuery(api.users.getProfile, isSignedIn ? {} : "skip");
  const markMigrated = useMutation(api.users.markMigrated);
  const replaceAll = useMutation(api.migration.replaceAll);
  const mergeLocal = useMutation(api.migration.mergeLocal);
  const applyLocalChanges = useMutation(api.migration.applyLocalChanges);

  const cloudAccounts = useQuery(api.accounts.list, isSignedIn ? {} : "skip");
  const cloudCards = useQuery(api.cards.list, isSignedIn ? {} : "skip");
  const cloudCategories = useQuery(api.categories.list, isSignedIn ? {} : "skip");
  const cloudBudgets = useQuery(api.budgets.list, isSignedIn ? {} : "skip");
  const cloudTransactions = useQuery(api.transactions.list, isSignedIn ? {} : "skip");
  const cloudRecurrences = useQuery(api.recurrences.list, isSignedIn ? {} : "skip");

  const cloudReady =
    profile !== undefined &&
    cloudAccounts !== undefined &&
    cloudCards !== undefined &&
    cloudCategories !== undefined &&
    cloudBudgets !== undefined &&
    cloudTransactions !== undefined &&
    cloudRecurrences !== undefined;

  const cloudSnapshot: CloudSnapshot | null = useMemo(() => {
    if (!cloudReady) return null;
    return {
      accounts: (cloudAccounts ?? []).map((d: any) => stripCloud<Account>(d)),
      cards: (cloudCards ?? []).map((d: any) => stripCloud<Card>(d)),
      categories: (cloudCategories ?? []).map((d: any) => stripCloud<Category>(d)),
      budgets: (cloudBudgets ?? []).map((d: any) => stripCloud<Budget>(d)),
      transactions: (cloudTransactions ?? []).map((d: any) =>
        stripCloud<Transaction>(d),
      ),
      recurrences: (cloudRecurrences ?? []).map((d: any) =>
        stripCloud<Recurrence>(d),
      ),
    };
  }, [
    cloudReady,
    cloudAccounts,
    cloudCards,
    cloudCategories,
    cloudBudgets,
    cloudTransactions,
    cloudRecurrences,
  ]);

  const [diff, setDiff] = useState<LocalDiff | null>(null);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("firstTime");
  const [busy, setBusy] = useState<null | "upload" | "merge" | "discard" | "apply">(
    null,
  );

  useEffect(() => {
    if (!isSignedIn || !userId) return;
    if (!cloudReady || !cloudSnapshot) return;
    if (open) return;

    const isFirstMigration = !profile?.migratedAt;

    let cancelled = false;
    (async () => {
      const counts = await detectLocalData();
      if (counts.total === 0) {
        if (isFirstMigration) markMigrated({}).catch(console.error);
        return;
      }

      const d = await computeLocalDiff(cloudSnapshot);
      if (!d.hasChanges) {
        if (isFirstMigration) markMigrated({}).catch(console.error);
        return;
      }

      if (!isFirstMigration) {
        const currentHash = await computeLocalHash();
        try {
          const lastHash = localStorage.getItem(HASH_KEY(userId));
          if (currentHash === lastHash) return;
        } catch {}
      }

      if (cancelled) return;
      setDiff(d);
      setMode(isFirstMigration ? "firstTime" : "reSync");
      setOpen(true);
    })().catch(console.error);

    return () => {
      cancelled = true;
    };
  }, [
    isSignedIn,
    userId,
    profile,
    cloudReady,
    cloudSnapshot,
    open,
    markMigrated,
  ]);

  async function rememberReviewed() {
    if (!userId) return;
    try {
      const h = await computeLocalHash();
      localStorage.setItem(HASH_KEY(userId), h);
    } catch {}
  }

  async function handleUpload() {
    setBusy("upload");
    try {
      const payload = await assembleLocalPayload();
      await replaceAll(payload);
      await rememberReviewed();
      showToast("Local data uploaded to your account", { emoji: "☁️" });
      setOpen(false);
      setDiff(null);
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
      await rememberReviewed();
      showToast("Local data merged with cloud", { emoji: "🔀" });
      setOpen(false);
      setDiff(null);
    } catch (err) {
      console.error(err);
      showToast("Merge failed — try again", { emoji: "⚠️" });
    } finally {
      setBusy(null);
    }
  }

  async function handleApply() {
    if (!diff) return;
    setBusy("apply");
    try {
      const payload = await assembleDiffPayload(diff);
      await applyLocalChanges(payload);
      await rememberReviewed();
      showToast("Local changes synced to your account", { emoji: "☁️" });
      setOpen(false);
      setDiff(null);
    } catch (err) {
      console.error(err);
      showToast("Sync failed — try again", { emoji: "⚠️" });
    } finally {
      setBusy(null);
    }
  }

  async function handleDiscard() {
    setBusy("discard");
    try {
      if (mode === "firstTime") {
        await markMigrated({});
      }
      await rememberReviewed();
      showToast(
        mode === "firstTime"
          ? "Local data kept on-device"
          : "Local changes discarded — cloud kept as-is",
        { emoji: "📦" },
      );
      setOpen(false);
      setDiff(null);
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(null);
    }
  }

  if (!open || !diff) return null;

  const summary = summarizeDiff(diff);
  const preview = diffPreviewLines(diff);
  const totalChanges = diff.totalAdded + diff.totalChanged;

  if (mode === "firstTime") {
    return (
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Sync your local data?"
      >
        <p className="mb-4 text-sm text-[var(--color-ink-3)]">
          You have data on this device that isn&apos;t in your account yet. Pick
          what to do — your local data stays put until you decide.
        </p>
        <SummaryCard summary={summary} total={totalChanges} />
        <DiffPreview lines={preview} />
        <div className="mt-4 space-y-2">
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

  return (
    <Sheet
      open={open}
      onClose={() => setOpen(false)}
      title="Local changes detected"
    >
      <p className="mb-4 text-sm text-[var(--color-ink-3)]">
        You made changes on this device while signed out. Review them and decide
        whether to update your account.
      </p>
      <SummaryCard summary={summary} total={totalChanges} />
      <DiffPreview lines={preview} />
      <div className="mt-4 space-y-2">
        <Choice
          title="Update cloud with these changes"
          hint="Apply the local edits above to your cloud account."
          onClick={handleApply}
          loading={busy === "apply"}
          primary
        />
        <Choice
          title="Keep cloud as-is"
          hint="Discard the local edits; pull cloud data only."
          onClick={handleDiscard}
          loading={busy === "discard"}
        />
      </div>
    </Sheet>
  );
}

function SummaryCard({
  summary,
  total,
}: {
  summary: string[];
  total: number;
}) {
  return (
    <div className="mb-3 rounded-[14px] bg-[var(--color-surface-2)] p-3">
      <div className="text-sm font-medium">
        {total} local change{total === 1 ? "" : "s"}
      </div>
      {summary.length > 0 && (
        <ul className="mt-1 space-y-0.5 text-xs text-[var(--color-ink-3)]">
          {summary.map((l, i) => (
            <li key={i}>• {l}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DiffPreview({ lines }: { lines: DiffLine[] }) {
  if (lines.length === 0) return null;
  return (
    <details className="rounded-[14px] border border-[var(--color-line)] p-3">
      <summary className="cursor-pointer text-xs uppercase tracking-wider text-[var(--color-ink-3)]">
        Show details
      </summary>
      <ul className="mt-2 space-y-1 text-xs">
        {lines.map((it, i) => (
          <li key={i} className="flex gap-2">
            <span
              className={
                "w-3 shrink-0 font-mono " +
                (it.kind === "+" ? "text-emerald-600" : "text-amber-600")
              }
              aria-hidden
            >
              {it.kind}
            </span>
            <span className="text-[var(--color-ink-3)]">{it.entity}:</span>
            <span className="truncate">{it.label}</span>
          </li>
        ))}
      </ul>
    </details>
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
