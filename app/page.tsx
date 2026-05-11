"use client";

import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { useMemo, useState } from "react";
import { getDB } from "@/lib/db";
import { money } from "@/lib/format";
import { currentMonthPeriod, monthPeriodFromKey } from "@/lib/budget";
import { TransactionRow } from "@/components/TransactionRow";
import { PageHeader } from "@/components/PageHeader";
import { AddTransactionSheet } from "@/components/AddTransactionSheet";
import type { Transaction } from "@/lib/types";

export default function HomePage() {
  const [editing, setEditing] = useState<Transaction | undefined>();
  const [editOpen, setEditOpen] = useState(false);

  const now = useMemo(() => new Date(), []);
  const month = useMemo(() => currentMonthPeriod(now), [now]);
  const prevKey = useMemo(() => {
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return d.toISOString().slice(0, 7);
  }, [now]);
  const prevMonth = useMemo(() => monthPeriodFromKey(prevKey), [prevKey]);

  const txs = useLiveQuery(
    () =>
      getDB()
        .transactions.where("date")
        .between(month.start, month.end, true, true)
        .reverse()
        .sortBy("date"),
    [month.start, month.end],
  );
  const prevTxs = useLiveQuery(
    () =>
      getDB()
        .transactions.where("date")
        .between(prevMonth.start, prevMonth.end, true, true)
        .toArray(),
    [prevMonth.start, prevMonth.end],
  );
  const budgets = useLiveQuery(() => getDB().budgets.toArray(), []);
  const categories = useLiveQuery(() => getDB().categories.toArray(), []);

  const total = (txs ?? []).reduce((a, t) => a + t.amount, 0);
  const prevTotal = (prevTxs ?? []).reduce((a, t) => a + t.amount, 0);
  const delta = total - prevTotal;
  const monthlyBudget = (budgets ?? [])
    .filter((b) => b.period === "monthly")
    .reduce((a, b) => a + b.amount, 0);
  const budgetPct = monthlyBudget > 0 ? Math.min(1, total / monthlyBudget) : 0;

  const byCat = useMemo(() => {
    const map = new Map<string, number>();
    (txs ?? []).forEach((t) => {
      if (!t.categoryId) return;
      map.set(t.categoryId, (map.get(t.categoryId) ?? 0) + t.amount);
    });
    return Array.from(map.entries())
      .map(([id, amount]) => ({
        id,
        amount,
        cat: categories?.find((c) => c.id === id),
      }))
      .filter((x) => x.cat)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 4);
  }, [txs, categories]);

  return (
    <div>
      <PageHeader eyebrow={month.label} title="Tiffin" />

      <section className="px-5">
        <div className="rounded-[28px] bg-[var(--color-surface)] p-6">
          <div className="text-[11px] uppercase tracking-wider text-[var(--color-ink-3)]">
            Spent this month
          </div>
          <div className="font-display mt-1 text-5xl tabular">
            {money(total)}
          </div>
          <div className="mt-1 text-sm text-[var(--color-ink-3)]">
            {prevTotal === 0 ? (
              <>vs {money(0)} last month</>
            ) : delta === 0 ? (
              <>same as last month</>
            ) : delta > 0 ? (
              <>
                <span className="text-[var(--color-warn)]">
                  {money(delta)} more
                </span>{" "}
                than last month
              </>
            ) : (
              <>
                <span className="text-[var(--color-accent)]">
                  {money(Math.abs(delta))} less
                </span>{" "}
                than last month
              </>
            )}
          </div>

          {monthlyBudget > 0 && (
            <div className="mt-5">
              <div className="mb-1.5 flex items-center justify-between text-xs text-[var(--color-ink-3)]">
                <span>Of {money(monthlyBudget)} monthly budget</span>
                <span className="tabular">
                  {Math.round(budgetPct * 100)}%
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[var(--color-surface-2)]">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${budgetPct * 100}%`,
                    background:
                      budgetPct >= 1
                        ? "var(--color-danger)"
                        : budgetPct > 0.85
                          ? "var(--color-warn)"
                          : "var(--color-accent)",
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </section>

      {byCat.length > 0 && (
        <section className="mt-6 px-5">
          <SectionHeader title="Top categories" />
          <div className="rounded-[22px] bg-[var(--color-surface)] p-2">
            {byCat.map((row) => {
              const pct = total > 0 ? row.amount / total : 0;
              return (
                <div key={row.id} className="flex items-center gap-3 p-3">
                  <span className="text-lg">{row.cat?.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <div className="truncate text-sm font-medium">
                        {row.cat?.name}
                      </div>
                      <div className="tabular text-sm">{money(row.amount)}</div>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--color-surface-2)]">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${pct * 100}%`,
                          background: row.cat?.color,
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="mt-6 px-5">
        <SectionHeader
          title="Recent activity"
          right={
            <Link
              href="/transactions"
              className="text-xs text-[var(--color-ink-3)] underline-offset-4 hover:underline"
            >
              See all
            </Link>
          }
        />
        <div className="divide-y divide-[var(--color-line)] rounded-[22px] bg-[var(--color-surface)] px-4">
          {(txs ?? []).length === 0 && (
            <div className="py-10 text-center text-sm text-[var(--color-ink-3)]">
              No expenses yet this month.
              <br />
              Tap <strong>Add expense</strong> to log your first.
            </div>
          )}
          {(txs ?? []).slice(0, 6).map((t) => (
            <TransactionRow
              key={t.id}
              tx={t}
              onClick={() => {
                setEditing(t);
                setEditOpen(true);
              }}
            />
          ))}
        </div>
      </section>

      <AddTransactionSheet
        open={editOpen}
        onClose={() => setEditOpen(false)}
        initial={editing}
      />
    </div>
  );
}

function SectionHeader({
  title,
  right,
}: {
  title: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="mb-2 flex items-end justify-between px-1">
      <h2 className="text-[11px] uppercase tracking-wider text-[var(--color-ink-3)]">
        {title}
      </h2>
      {right}
    </div>
  );
}
