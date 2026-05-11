"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useMemo, useState } from "react";
import { getDB } from "@/lib/db";
import { money } from "@/lib/format";
import { monthPeriodFromKey } from "@/lib/budget";
import { PageHeader } from "@/components/PageHeader";
import { MonthPicker } from "@/components/MonthPicker";
import { TransactionRow } from "@/components/TransactionRow";
import { AddTransactionSheet } from "@/components/AddTransactionSheet";
import type { Transaction } from "@/lib/types";

export default function TransactionsPage() {
  const [monthKey, setMonthKey] = useState(() =>
    new Date().toISOString().slice(0, 7),
  );
  const [editing, setEditing] = useState<Transaction | undefined>();
  const [open, setOpen] = useState(false);

  const period = useMemo(() => monthPeriodFromKey(monthKey), [monthKey]);

  const txs = useLiveQuery(
    () =>
      getDB()
        .transactions.where("date")
        .between(period.start, period.end, true, true)
        .reverse()
        .sortBy("date"),
    [period.start, period.end],
  );

  const total = (txs ?? []).reduce((a, t) => a + t.amount, 0);

  const grouped = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    (txs ?? []).forEach((t) => {
      const arr = map.get(t.date) ?? [];
      arr.push(t);
      map.set(t.date, arr);
    });
    return Array.from(map.entries());
  }, [txs]);

  return (
    <div>
      <PageHeader
        eyebrow="Activity"
        title="Expenses"
        right={<MonthPicker value={monthKey} onChange={setMonthKey} />}
      />
      <section className="px-5">
        <div className="rounded-[22px] bg-[var(--color-surface)] p-5">
          <div className="text-[11px] uppercase tracking-wider text-[var(--color-ink-3)]">
            Spent
          </div>
          <div className="font-display mt-1 text-4xl tabular">
            {money(total)}
          </div>
          <div className="mt-1 text-sm text-[var(--color-ink-3)]">
            {(txs ?? []).length} transaction
            {(txs ?? []).length === 1 ? "" : "s"}
          </div>
        </div>
      </section>

      <section className="mt-5 px-5">
        {grouped.length === 0 && (
          <div className="rounded-[22px] bg-[var(--color-surface)] py-10 text-center text-sm text-[var(--color-ink-3)]">
            Nothing logged for this month.
          </div>
        )}
        {grouped.map(([date, items]) => (
          <div key={date} className="mb-5">
            <div className="mb-1 px-1 text-[11px] uppercase tracking-wider text-[var(--color-ink-3)]">
              {new Date(date).toLocaleDateString("en-CA", {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
            </div>
            <div className="divide-y divide-[var(--color-line)] rounded-[22px] bg-[var(--color-surface)] px-4">
              {items.map((t) => (
                <TransactionRow
                  key={t.id}
                  tx={t}
                  onClick={() => {
                    setEditing(t);
                    setOpen(true);
                  }}
                />
              ))}
            </div>
          </div>
        ))}
      </section>

      <AddTransactionSheet
        open={open}
        onClose={() => setOpen(false)}
        initial={editing}
      />
    </div>
  );
}
