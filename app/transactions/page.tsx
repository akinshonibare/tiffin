"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { getDB } from "@/lib/db";
import { money } from "@/lib/format";
import { monthPeriodFromKey, signedAmount } from "@/lib/budget";
import { PageHeader } from "@/components/PageHeader";
import { MonthPicker } from "@/components/MonthPicker";
import { TransactionRow } from "@/components/TransactionRow";
import { AddTransactionSheet } from "@/components/AddTransactionSheet";
import { PullHint } from "@/components/PullHint";
import { cn } from "@/lib/utils";
import { dejaVuIds, EMPTY_ACTIVITY, pickDeterministic } from "@/lib/easter";
import type { Transaction } from "@/lib/types";

type Filter =
  | { kind: "all" }
  | { kind: "account"; id: string }
  | { kind: "card"; id: string }
  | { kind: "tag"; name: string }
  | { kind: "unassigned" };

export default function TransactionsPage() {
  const [monthKey, setMonthKey] = useState(() =>
    new Date().toISOString().slice(0, 7),
  );
  const [editing, setEditing] = useState<Transaction | undefined>();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>({ kind: "all" });

  const period = useMemo(() => monthPeriodFromKey(monthKey), [monthKey]);

  const allMonthTxs = useLiveQuery(
    () =>
      getDB()
        .transactions.where("date")
        .between(period.start, period.end, true, true)
        .reverse()
        .sortBy("date"),
    [period.start, period.end],
  );
  const accounts = useLiveQuery(() => getDB().accounts.toArray(), []);
  const cards = useLiveQuery(() => getDB().cards.toArray(), []);

  const txs = useMemo(() => {
    const all = allMonthTxs ?? [];
    if (filter.kind === "all") return all;
    if (filter.kind === "unassigned") return all.filter((t) => !t.accountId);
    if (filter.kind === "account")
      return all.filter((t) => t.accountId === filter.id);
    if (filter.kind === "tag")
      return all.filter((t) => t.tags?.includes(filter.name));
    return all.filter((t) => t.cardId === filter.id);
  }, [allMonthTxs, filter]);

  const tagsInMonth = useMemo(() => {
    const m = new Map<string, number>();
    (allMonthTxs ?? []).forEach((t) =>
      t.tags?.forEach((tag) => m.set(tag, (m.get(tag) ?? 0) + 1)),
    );
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [allMonthTxs]);

  const total = txs.reduce((a, t) => a + signedAmount(t), 0);

  const byAccount = useMemo(() => {
    const map = new Map<string, number>();
    (allMonthTxs ?? []).forEach((t) => {
      const key = t.accountId ?? "__none__";
      map.set(key, (map.get(key) ?? 0) + signedAmount(t));
    });
    return Array.from(map.entries())
      .map(([id, amount]) => {
        const acct = accounts?.find((a) => a.id === id);
        return {
          id,
          amount,
          name: acct?.name ?? "Unassigned",
          color: acct?.color ?? "#94a3b8",
          type: acct?.type,
          last4: acct?.last4,
        };
      })
      .sort((a, b) => b.amount - a.amount);
  }, [allMonthTxs, accounts]);

  const cardsForFilter = useMemo(() => {
    if (filter.kind !== "account") return [];
    return (cards ?? []).filter(
      (c) => !c.archived && c.accountId === filter.id,
    );
  }, [cards, filter]);

  const cardTotals = useMemo(() => {
    if (filter.kind !== "account") return new Map<string, number>();
    const m = new Map<string, number>();
    (allMonthTxs ?? [])
      .filter((t) => t.accountId === filter.id)
      .forEach((t) => {
        if (!t.cardId) return;
        m.set(t.cardId, (m.get(t.cardId) ?? 0) + signedAmount(t));
      });
    return m;
  }, [allMonthTxs, filter]);

  const grouped = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    txs.forEach((t) => {
      const arr = map.get(t.date) ?? [];
      arr.push(t);
      map.set(t.date, arr);
    });
    return Array.from(map.entries());
  }, [txs]);

  const dejaSet = useMemo(() => dejaVuIds(allMonthTxs ?? []), [allMonthTxs]);
  const emptyCopy = useMemo(
    () => pickDeterministic(EMPTY_ACTIVITY, period.start),
    [period.start],
  );

  const filterLabel = useMemo(() => {
    if (filter.kind === "all") return null;
    if (filter.kind === "unassigned") return "Unassigned";
    if (filter.kind === "tag") return `#${filter.name}`;
    if (filter.kind === "account") {
      const a = accounts?.find((x) => x.id === filter.id);
      return a?.name ?? "Account";
    }
    const c = cards?.find((x) => x.id === filter.id);
    return c?.nickname ?? "Card";
  }, [filter, accounts, cards]);

  return (
    <div>
      <PageHeader
        eyebrow="Activity"
        title="Expenses"
        right={<MonthPicker value={monthKey} onChange={setMonthKey} />}
      />
      <section className="px-5">
        <div className="rounded-[22px] bg-[var(--color-surface)] p-5">
          <div className="flex items-center justify-between">
            <div className="text-[11px] uppercase tracking-wider text-[var(--color-ink-3)]">
              {filterLabel ? `Spent · ${filterLabel}` : "Spent"}
            </div>
            {filter.kind !== "all" && (
              <button
                type="button"
                onClick={() => setFilter({ kind: "all" })}
                className="flex items-center gap-1 rounded-full bg-[var(--color-surface-2)] px-2 py-1 text-[10px] uppercase tracking-wider text-[var(--color-ink-2)]"
              >
                <X className="size-3" /> Clear
              </button>
            )}
          </div>
          <div className="font-display mt-1 text-4xl tabular">
            {money(total)}
          </div>
          <div className="mt-1 text-sm text-[var(--color-ink-3)]">
            {txs.length} transaction{txs.length === 1 ? "" : "s"}
          </div>
        </div>
      </section>

      {byAccount.length > 0 && (
        <section className="mt-4 px-5">
          <div className="mb-2 px-1 text-[11px] uppercase tracking-wider text-[var(--color-ink-3)]">
            Filter by account
          </div>
          <div className="-mx-5 overflow-x-auto px-5">
            <div className="flex gap-2 pb-1">
              <FilterPill
                active={filter.kind === "all"}
                onClick={() => setFilter({ kind: "all" })}
                label="All"
                amount={(allMonthTxs ?? []).reduce(
                  (a, t) => a + signedAmount(t),
                  0,
                )}
              />
              {byAccount.map((row) => {
                const active =
                  (row.id === "__none__" && filter.kind === "unassigned") ||
                  (filter.kind === "account" && filter.id === row.id);
                const isUnassigned = row.id === "__none__";
                return (
                  <FilterPill
                    key={row.id}
                    active={active}
                    onClick={() =>
                      setFilter(
                        isUnassigned
                          ? { kind: "unassigned" }
                          : { kind: "account", id: row.id },
                      )
                    }
                    label={row.name}
                    color={row.color}
                    sub={row.last4 ? `·${row.last4}` : undefined}
                    amount={row.amount}
                    tag={row.type === "credit" ? "Credit" : undefined}
                  />
                );
              })}
            </div>
          </div>
        </section>
      )}

      {filter.kind === "account" && cardsForFilter.length > 0 && (
        <section className="mt-2 px-5">
          <div className="mb-2 px-1 text-[11px] uppercase tracking-wider text-[var(--color-ink-3)]">
            Cards on this account
          </div>
          <div className="-mx-5 overflow-x-auto px-5">
            <div className="flex gap-2 pb-1">
              <FilterPill
                active={true}
                onClick={() => {}}
                label="All cards"
              />
              {cardsForFilter.map((c) => (
                <FilterPill
                  key={c.id}
                  active={false}
                  onClick={() => setFilter({ kind: "card", id: c.id })}
                  label={c.nickname}
                  color={c.color}
                  sub={c.last4 ? `·${c.last4}` : undefined}
                  amount={cardTotals.get(c.id) ?? 0}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {tagsInMonth.length > 0 && filter.kind !== "card" && (
        <section className="mt-2 px-5">
          <div className="mb-2 px-1 text-[11px] uppercase tracking-wider text-[var(--color-ink-3)]">
            Filter by tag
          </div>
          <div className="-mx-5 overflow-x-auto px-5">
            <div className="flex gap-2 pb-1">
              {tagsInMonth.map(([name, count]) => {
                const active =
                  filter.kind === "tag" && filter.name === name;
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() =>
                      setFilter(
                        active ? { kind: "all" } : { kind: "tag", name },
                      )
                    }
                    className={cn(
                      "shrink-0 rounded-full border px-3 py-1.5 text-sm whitespace-nowrap transition-colors",
                      active
                        ? "border-[var(--color-ink)] bg-[var(--color-ink)] text-[var(--color-bg)]"
                        : "border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-ink-2)]",
                    )}
                  >
                    #{name}{" "}
                    <span
                      className={cn(
                        "text-xs",
                        active ? "opacity-80" : "text-[var(--color-ink-3)]",
                      )}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {filter.kind === "card" && (
        <section className="mt-2 px-5">
          <button
            type="button"
            onClick={() => {
              const card = cards?.find((c) => c.id === filter.id);
              if (card)
                setFilter({ kind: "account", id: card.accountId });
              else setFilter({ kind: "all" });
            }}
            className="text-xs text-[var(--color-ink-3)] hover:underline"
          >
            ← Back to account
          </button>
        </section>
      )}

      <section className="mt-5 px-5">
        {grouped.length === 0 && (
          <div className="rounded-[22px] bg-[var(--color-surface)] py-10 text-center text-sm text-[var(--color-ink-3)]">
            {filter.kind === "all"
              ? emptyCopy
              : `No expenses on ${filterLabel} this month.`}
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
                  dejaVu={dejaSet.has(t.id)}
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
      <PullHint />
    </div>
  );
}

function FilterPill({
  active,
  onClick,
  label,
  sub,
  amount,
  color,
  tag,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  sub?: string;
  amount?: number;
  color?: string;
  tag?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors",
        active
          ? "border-[var(--color-ink)] bg-[var(--color-ink)] text-[var(--color-bg)]"
          : "border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-ink-2)]",
      )}
    >
      {color && (
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ background: color }}
        />
      )}
      <span className="whitespace-nowrap">{label}</span>
      {sub && (
        <span
          className={cn(
            "text-xs",
            active ? "opacity-80" : "text-[var(--color-ink-3)]",
          )}
        >
          {sub}
        </span>
      )}
      {tag && (
        <span
          className={cn(
            "rounded-full px-1.5 py-0.5 text-[10px] uppercase tracking-wider",
            active
              ? "bg-white/15 text-[var(--color-bg)]"
              : "bg-[var(--color-surface-2)] text-[var(--color-ink-3)]",
          )}
        >
          {tag}
        </span>
      )}
      {amount !== undefined && (
        <span
          className={cn(
            "tabular text-xs",
            active ? "opacity-90" : "text-[var(--color-ink-3)]",
          )}
        >
          {money(amount, { whole: amount >= 1000 })}
        </span>
      )}
    </button>
  );
}
