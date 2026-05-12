"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Repeat, ChevronRight, Check, SkipForward } from "lucide-react";
import { Sheet } from "./Sheet";
import { showToast } from "./Toast";
import { getDB, uid } from "@/lib/db";
import { money } from "@/lib/format";
import { advanceDate, isDue, periodLabel } from "@/lib/recurrence";
import type { Recurrence } from "@/lib/types";

export function RecurringPendingCard() {
  const all = useLiveQuery(() => getDB().recurrences.toArray(), []);
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const due = useMemo(
    () => (all ?? []).filter((r) => isDue(r)),
    [all],
  );

  if (due.length === 0) return null;

  async function log(rec: Recurrence) {
    if (busyId) return;
    setBusyId(rec.id);
    const db = getDB();
    const today = new Date().toISOString().slice(0, 10);
    await db.transactions.add({
      id: uid("tx_"),
      amount: rec.amount,
      date: today,
      accountId: rec.accountId,
      cardId: rec.cardId,
      categoryId: rec.categoryId,
      merchant: rec.merchant ?? rec.name,
      tags: rec.tags,
      recurrenceId: rec.id,
      createdAt: Date.now(),
    });
    const next = advanceDate(rec.nextDue, rec.period);
    await db.recurrences.update(rec.id, { nextDue: next });
    showToast(`${rec.name} logged`, { emoji: "🔁", ms: 1400 });
    setBusyId(null);
  }

  async function skip(rec: Recurrence) {
    if (busyId) return;
    setBusyId(rec.id);
    const next = advanceDate(rec.nextDue, rec.period);
    await getDB().recurrences.update(rec.id, { nextDue: next });
    showToast(`${rec.name} skipped`, { ms: 1400 });
    setBusyId(null);
  }

  async function logAll() {
    for (const r of due) {
      await log(r);
    }
    setOpen(false);
  }

  return (
    <>
      <section className="mt-4 px-5">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="group flex w-full items-center gap-3 rounded-[22px] bg-[var(--color-surface)] p-4 text-left"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-accent-soft)] text-[var(--color-accent)]">
            <Repeat className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] uppercase tracking-wider text-[var(--color-ink-3)]">
              Recurring · due
            </div>
            <div className="font-display text-lg leading-tight">
              {due.length} item{due.length === 1 ? "" : "s"} ·{" "}
              {money(due.reduce((a, r) => a + r.amount, 0))}
            </div>
            <div className="mt-0.5 truncate text-xs text-[var(--color-ink-3)]">
              {due.map((r) => r.name).join(" · ")}
            </div>
          </div>
          <ChevronRight className="size-5 text-[var(--color-ink-3)] transition-transform group-hover:translate-x-0.5" />
        </button>
      </section>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Recurring · due"
        footer={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex-1 rounded-full border border-[var(--color-line)] py-3 text-sm"
            >
              Close
            </button>
            <button
              type="button"
              onClick={logAll}
              className="flex-1 rounded-full bg-[var(--color-ink)] py-3 text-sm font-medium text-[var(--color-bg)]"
            >
              Log all
            </button>
          </div>
        }
      >
        <p className="mb-3 text-sm text-[var(--color-ink-3)]">
          One tap to log each, or skip if it didn't happen. After confirming,
          the next due date advances automatically.
        </p>
        <div className="space-y-2 pb-2">
          <AnimatePresence>
            {due.map((r) => (
              <motion.div
                key={r.id}
                layout
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                className="rounded-[18px] bg-[var(--color-surface-2)] p-3"
              >
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">
                      {r.name}
                    </div>
                    <div className="text-xs text-[var(--color-ink-3)]">
                      {periodLabel(r.period)} · was due {r.nextDue}
                    </div>
                  </div>
                  <div className="font-display tabular text-base">
                    {money(r.amount)}
                  </div>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={busyId === r.id}
                    onClick={() => skip(r)}
                    className="flex items-center justify-center gap-1 rounded-full border border-[var(--color-line)] py-2 text-xs disabled:opacity-40"
                  >
                    <SkipForward className="size-3.5" /> Skip
                  </button>
                  <button
                    type="button"
                    disabled={busyId === r.id}
                    onClick={() => log(r)}
                    className="flex items-center justify-center gap-1 rounded-full bg-[var(--color-ink)] py-2 text-xs text-[var(--color-bg)] disabled:opacity-40"
                  >
                    <Check className="size-3.5" /> Log
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </Sheet>
    </>
  );
}
