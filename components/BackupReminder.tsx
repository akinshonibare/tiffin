"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { Download, X } from "lucide-react";
import { getDB } from "@/lib/db";
import { showToast } from "./Toast";

const DAYS = { biweekly: 14, monthly: 30 } as const;

export function BackupReminder() {
  const settings = useLiveQuery(() => getDB().settings.get("singleton"), []);
  const [dismissed, setDismissed] = useState(false);

  if (!settings) return null;
  const cadence = settings.backupCadence ?? "off";
  if (cadence === "off" || dismissed) return null;

  const last = settings.lastExportAt;
  if (last) {
    const days =
      (Date.now() - new Date(last).getTime()) / (1000 * 60 * 60 * 24);
    if (days < DAYS[cadence]) return null;
  }

  async function exportNow() {
    const db = getDB();
    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      accounts: await db.accounts.toArray(),
      cards: await db.cards.toArray(),
      categories: await db.categories.toArray(),
      budgets: await db.budgets.toArray(),
      transactions: await db.transactions.toArray(),
      recurrences: await db.recurrences.toArray(),
      settings: await db.settings.toArray(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tiffin-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    await db.settings.update("singleton", {
      lastExportAt: new Date().toISOString(),
    });
    showToast("Backup downloaded", { emoji: "💾", ms: 1600 });
  }

  const label =
    cadence === "biweekly"
      ? "Two weeks since your last backup"
      : "A month since your last backup";

  return (
    <section className="mt-4 px-5">
      <div className="relative flex items-center gap-3 overflow-hidden rounded-[22px] border border-[var(--color-line)] bg-[var(--color-surface)] p-4">
        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => setDismissed(true)}
          className="absolute right-2 top-2 rounded-full p-1 text-[var(--color-ink-3)] hover:bg-[var(--color-surface-2)]"
        >
          <X className="size-3.5" />
        </button>
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-surface-2)] text-[var(--color-ink-2)]">
          💾
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] uppercase tracking-wider text-[var(--color-ink-3)]">
            Backup reminder
          </div>
          <div className="text-sm font-medium leading-tight">{label}</div>
          <div className="text-xs text-[var(--color-ink-3)]">
            One tap to save a JSON snapshot.
          </div>
        </div>
        <button
          type="button"
          onClick={exportNow}
          className="flex items-center gap-1 rounded-full bg-[var(--color-ink)] px-3 py-1.5 text-xs text-[var(--color-bg)]"
        >
          <Download className="size-3.5" /> Export
        </button>
      </div>
    </section>
  );
}
