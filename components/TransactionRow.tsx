"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { getDB } from "@/lib/db";
import { money, shortDate } from "@/lib/format";
import type { Transaction } from "@/lib/types";

export function TransactionRow({
  tx,
  onClick,
}: {
  tx: Transaction;
  onClick?: () => void;
}) {
  const category = useLiveQuery(
    () => (tx.categoryId ? getDB().categories.get(tx.categoryId) : undefined),
    [tx.categoryId],
  );
  const account = useLiveQuery(
    () => (tx.accountId ? getDB().accounts.get(tx.accountId) : undefined),
    [tx.accountId],
  );

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 py-3 text-left active:bg-[var(--color-surface-2)]/60 transition-colors"
    >
      <div
        className="flex h-10 w-10 items-center justify-center rounded-full text-lg"
        style={{
          background: (category?.color ?? "#94a3b8") + "22",
        }}
      >
        <span>{category?.icon ?? "✨"}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">
          {tx.merchant || category?.name || "Expense"}
        </div>
        <div className="truncate text-xs text-[var(--color-ink-3)]">
          {shortDate(tx.date)}
          {account ? ` · ${account.name}` : ""}
          {tx.note ? ` · ${tx.note}` : ""}
        </div>
      </div>
      <div className="tabular text-sm font-medium">
        −{money(tx.amount)}
      </div>
    </button>
  );
}
