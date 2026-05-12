"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { Sheet } from "./Sheet";
import { getDB } from "@/lib/db";
import { money, longDate, monthLabel } from "@/lib/format";
import { BADGES, computeRecords, loadEarnedBadges } from "@/lib/easter";
import { useMemo } from "react";

export function RecordsSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const txs = useLiveQuery(
    () => (open ? getDB().transactions.toArray() : []),
    [open],
  );

  const records = useMemo(
    () => (txs ? computeRecords(txs) : null),
    [txs],
  );

  const earned = useMemo(() => (open ? loadEarnedBadges() : []), [open]);
  const earnedIds = new Set(earned.map((b) => b.id));

  return (
    <Sheet open={open} onClose={onClose} title="Personal records">
      {!records || txs?.length === 0 ? (
        <p className="py-8 text-center text-sm text-[var(--color-ink-3)]">
          No records yet — log a few expenses to see your highs.
        </p>
      ) : (
        <div className="space-y-3 pb-4">
          <Row
            label="Biggest single expense"
            value={
              records.biggestExpense
                ? `${money(records.biggestExpense.amount)} · ${
                    records.biggestExpense.merchant ?? "Expense"
                  }`
                : "—"
            }
            sub={
              records.biggestExpense
                ? longDate(records.biggestExpense.date)
                : undefined
            }
          />
          <Row
            label="Biggest day"
            value={
              records.biggestDay
                ? money(records.biggestDay.total)
                : "—"
            }
            sub={
              records.biggestDay
                ? longDate(records.biggestDay.date)
                : undefined
            }
          />
          <Row
            label="Biggest month"
            value={
              records.biggestMonth
                ? money(records.biggestMonth.total)
                : "—"
            }
            sub={
              records.biggestMonth
                ? monthLabel(records.biggestMonth.key)
                : undefined
            }
          />
          <Row
            label="Longest no-spend streak"
            value={`${records.longestNoSpend} day${
              records.longestNoSpend === 1 ? "" : "s"
            }`}
          />
          <Row
            label="Top merchant"
            value={
              records.topMerchant
                ? `${records.topMerchant.name}`
                : "—"
            }
            sub={
              records.topMerchant
                ? money(records.topMerchant.total)
                : undefined
            }
          />

          <div className="mt-6">
            <div className="mb-2 px-1 text-[11px] uppercase tracking-wider text-[var(--color-ink-3)]">
              Badges
            </div>
            <div className="grid grid-cols-3 gap-2">
              {Object.values(BADGES).map((b) => {
                const got = earnedIds.has(b.id);
                return (
                  <div
                    key={b.id}
                    className={
                      "flex flex-col items-center rounded-[16px] p-3 text-center transition-opacity " +
                      (got
                        ? "bg-[var(--color-surface-2)] opacity-100"
                        : "bg-[var(--color-surface-2)] opacity-35")
                    }
                  >
                    <div className="text-2xl">{got ? b.emoji : "🔒"}</div>
                    <div className="mt-1 text-[11px] font-medium leading-tight">
                      {b.title}
                    </div>
                    <div className="mt-0.5 text-[9px] leading-tight text-[var(--color-ink-3)]">
                      {b.description}
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-center text-[10px] text-[var(--color-ink-3)]">
              {earned.length} of {Object.keys(BADGES).length} earned
            </p>
          </div>
        </div>
      )}
    </Sheet>
  );
}

function Row({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-[18px] bg-[var(--color-surface-2)] p-4">
      <div className="text-[11px] uppercase tracking-wider text-[var(--color-ink-3)]">
        {label}
      </div>
      <div className="font-display mt-1 text-xl tabular leading-tight">
        {value}
      </div>
      {sub && (
        <div className="mt-0.5 text-xs text-[var(--color-ink-3)]">{sub}</div>
      )}
    </div>
  );
}
