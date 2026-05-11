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
  const accounts = useLiveQuery(() => getDB().accounts.toArray(), []);

  const total = (txs ?? []).reduce((a, t) => a + t.amount, 0);

  const byAccount = useMemo(() => {
    const map = new Map<string, number>();
    (txs ?? []).forEach((t) => {
      const key = t.accountId ?? "__none__";
      map.set(key, (map.get(key) ?? 0) + t.amount);
    });
    return Array.from(map.entries())
      .map(([id, amount]) => {
        const acct = accounts?.find((a) => a.id === id);
        return {
          id,
          amount,
          name: acct?.name ?? "Unassigned",
          bank: acct?.bank,
          color: acct?.color ?? "#94a3b8",
          type: acct?.type,
          last4: acct?.last4,
        };
      })
      .sort((a, b) => b.amount - a.amount);
  }, [txs, accounts]);

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

      {byAccount.length > 0 && (
        <section className="mt-4 px-5">
          <div className="mb-2 px-1 text-[11px] uppercase tracking-wider text-[var(--color-ink-3)]">
            By account
          </div>
          <div className="divide-y divide-[var(--color-line)] rounded-[22px] bg-[var(--color-surface)] px-4">
            {byAccount.map((row) => (
              <div
                key={row.id}
                className="flex items-center gap-3 py-3 text-sm"
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: row.color }}
                />
                <span className="truncate">{row.name}</span>
                {row.type === "credit" && (
                  <span className="rounded-full bg-[var(--color-surface-2)] px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-[var(--color-ink-3)]">
                    Credit
                  </span>
                )}
                {row.last4 && (
                  <span className="text-xs text-[var(--color-ink-3)]">
                    ·{row.last4}
                  </span>
                )}
                <span className="ml-auto tabular">{money(row.amount)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

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
