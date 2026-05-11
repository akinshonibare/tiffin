"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useMemo, useState } from "react";
import { Plus, Pencil } from "lucide-react";
import { getDB, uid } from "@/lib/db";
import { money, isoToday } from "@/lib/format";
import { periodForBudget, sumInRange } from "@/lib/budget";
import { PageHeader } from "@/components/PageHeader";
import { BudgetRing } from "@/components/BudgetRing";
import { Sheet } from "@/components/Sheet";
import { cn } from "@/lib/utils";
import type { Budget, BudgetPeriod, Category } from "@/lib/types";

export default function BudgetsPage() {
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Budget | undefined>();

  const budgets = useLiveQuery(() => getDB().budgets.toArray(), []);
  const categories = useLiveQuery(() => getDB().categories.toArray(), []);
  const txs = useLiveQuery(() => getDB().transactions.toArray(), []);

  const usedCatIds = useMemo(
    () => new Set((budgets ?? []).map((b) => b.categoryId)),
    [budgets],
  );

  const totalBudgetMonthly = (budgets ?? [])
    .filter((b) => b.period === "monthly")
    .reduce((a, b) => a + b.amount, 0);
  const totalBudgetBiweekly = (budgets ?? [])
    .filter((b) => b.period === "biweekly")
    .reduce((a, b) => a + b.amount, 0);

  return (
    <div>
      <PageHeader
        eyebrow="Budgets"
        title="Categories"
        right={
          <button
            type="button"
            onClick={() => {
              setEditing(undefined);
              setEditorOpen(true);
            }}
            className="flex items-center gap-1 rounded-full bg-[var(--color-ink)] px-3 py-1.5 text-xs text-[var(--color-bg)]"
          >
            <Plus className="size-3.5" /> Budget
          </button>
        }
      />

      <section className="px-5">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-[22px] bg-[var(--color-surface)] p-4">
            <div className="text-[11px] uppercase tracking-wider text-[var(--color-ink-3)]">
              Monthly
            </div>
            <div className="font-display mt-1 text-2xl tabular">
              {money(totalBudgetMonthly)}
            </div>
          </div>
          <div className="rounded-[22px] bg-[var(--color-surface)] p-4">
            <div className="text-[11px] uppercase tracking-wider text-[var(--color-ink-3)]">
              Biweekly
            </div>
            <div className="font-display mt-1 text-2xl tabular">
              {money(totalBudgetBiweekly)}
            </div>
          </div>
        </div>
      </section>

      <section className="mt-5 px-5">
        {(budgets ?? []).length === 0 && (
          <div className="rounded-[22px] bg-[var(--color-surface)] py-10 text-center text-sm text-[var(--color-ink-3)]">
            No budgets yet.
            <br />
            Tap <strong>Budget</strong> to set one per category.
          </div>
        )}
        <div className="space-y-3">
          {(budgets ?? []).map((b) => {
            const cat = categories?.find((c) => c.id === b.categoryId);
            const period = periodForBudget(b);
            const spent = sumInRange(
              (txs ?? []).filter((t) => t.categoryId === b.categoryId),
              period.start,
              period.end,
            );
            const pct = b.amount > 0 ? spent / b.amount : 0;
            const remaining = Math.max(0, b.amount - spent);
            const over = spent > b.amount;
            const color = over
              ? "var(--color-danger)"
              : pct > 0.85
                ? "var(--color-warn)"
                : (cat?.color ?? "var(--color-accent)");
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => {
                  setEditing(b);
                  setEditorOpen(true);
                }}
                className="flex w-full items-center gap-4 rounded-[22px] bg-[var(--color-surface)] p-4 text-left"
              >
                <BudgetRing pct={pct} size={64} stroke={6} color={color}>
                  <span className="tabular">{Math.round(pct * 100)}%</span>
                </BudgetRing>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span>{cat?.icon}</span>
                    <div className="truncate font-medium">{cat?.name}</div>
                    <span className="ml-auto text-[10px] uppercase tracking-wider text-[var(--color-ink-3)]">
                      {b.period}
                    </span>
                  </div>
                  <div className="mt-0.5 text-xs text-[var(--color-ink-3)]">
                    {period.label}
                  </div>
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span className="tabular">
                      {money(spent)}{" "}
                      <span className="text-[var(--color-ink-3)]">
                        / {money(b.amount)}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "tabular text-xs",
                        over
                          ? "text-[var(--color-danger)]"
                          : "text-[var(--color-ink-3)]",
                      )}
                    >
                      {over
                        ? `${money(spent - b.amount)} over`
                        : `${money(remaining)} left`}
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--color-surface-2)]">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(100, pct * 100)}%`,
                        background: color,
                      }}
                    />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <BudgetEditor
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        editing={editing}
        categories={categories ?? []}
        usedCategoryIds={usedCatIds}
      />
    </div>
  );
}

function BudgetEditor({
  open,
  onClose,
  editing,
  categories,
  usedCategoryIds,
}: {
  open: boolean;
  onClose: () => void;
  editing?: Budget;
  categories: Category[];
  usedCategoryIds: Set<string>;
}) {
  const [categoryId, setCategoryId] = useState<string | undefined>();
  const [amount, setAmount] = useState("");
  const [period, setPeriod] = useState<BudgetPeriod>("monthly");
  const [anchorDate, setAnchorDate] = useState<string>(isoToday());
  const [rollover, setRollover] = useState(false);

  useMemoSync(() => {
    if (!open) return;
    if (editing) {
      setCategoryId(editing.categoryId);
      setAmount(String(editing.amount));
      setPeriod(editing.period);
      setAnchorDate(editing.anchorDate);
      setRollover(!!editing.rollover);
    } else {
      const firstAvail = categories.find((c) => !usedCategoryIds.has(c.id));
      setCategoryId(firstAvail?.id);
      setAmount("");
      setPeriod("monthly");
      setAnchorDate(isoToday());
      setRollover(false);
    }
  }, [open, editing?.id]);

  const amt = Number(amount);
  const valid = !!categoryId && amt > 0;

  async function save() {
    if (!valid) return;
    const db = getDB();
    if (editing) {
      await db.budgets.update(editing.id, {
        categoryId: categoryId!,
        amount: amt,
        period,
        anchorDate,
        rollover,
      });
    } else {
      await db.budgets.add({
        id: uid("bgt_"),
        categoryId: categoryId!,
        amount: amt,
        period,
        anchorDate,
        rollover,
        createdAt: Date.now(),
      });
    }
    onClose();
  }

  async function remove() {
    if (!editing) return;
    await getDB().budgets.delete(editing.id);
    onClose();
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={editing ? "Edit budget" : "New budget"}
      footer={
        <div className="flex gap-2">
          {editing && (
            <button
              type="button"
              onClick={remove}
              className="flex-1 rounded-full border border-[var(--color-line)] py-3 text-sm text-[var(--color-danger)]"
            >
              Remove
            </button>
          )}
          <button
            type="button"
            disabled={!valid}
            onClick={save}
            className="flex-1 rounded-full bg-[var(--color-ink)] py-3 text-sm font-medium text-[var(--color-bg)] disabled:opacity-40"
          >
            {editing ? "Save" : "Create budget"}
          </button>
        </div>
      }
    >
      <div className="mb-4">
        <div className="mb-1.5 text-[11px] uppercase tracking-wider text-[var(--color-ink-3)]">
          Category
        </div>
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => {
            const disabled =
              !editing &&
              usedCategoryIds.has(c.id) &&
              c.id !== categoryId;
            return (
              <button
                key={c.id}
                type="button"
                disabled={disabled}
                onClick={() => setCategoryId(c.id)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm",
                  categoryId === c.id
                    ? "border-[var(--color-ink)] bg-[var(--color-ink)] text-[var(--color-bg)]"
                    : disabled
                      ? "border-[var(--color-line)] text-[var(--color-ink-3)] opacity-50"
                      : "border-[var(--color-line)]",
                )}
              >
                <span>{c.icon}</span>
                <span>{c.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mb-4">
        <div className="mb-1.5 text-[11px] uppercase tracking-wider text-[var(--color-ink-3)]">
          Amount (CAD)
        </div>
        <input
          type="number"
          inputMode="decimal"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          className="font-display w-full rounded-2xl bg-[var(--color-surface-2)] px-4 py-3 text-2xl tabular outline-none"
        />
      </div>

      <div className="mb-4">
        <div className="mb-1.5 text-[11px] uppercase tracking-wider text-[var(--color-ink-3)]">
          Period
        </div>
        <div className="grid grid-cols-2 gap-2">
          {(["monthly", "biweekly"] as BudgetPeriod[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={cn(
                "rounded-2xl border py-3 text-sm capitalize",
                period === p
                  ? "border-[var(--color-ink)] bg-[var(--color-ink)] text-[var(--color-bg)]"
                  : "border-[var(--color-line)]",
              )}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {period === "biweekly" && (
        <div className="mb-4">
          <div className="mb-1.5 text-[11px] uppercase tracking-wider text-[var(--color-ink-3)]">
            Cycle start date
          </div>
          <input
            type="date"
            value={anchorDate}
            onChange={(e) => setAnchorDate(e.target.value)}
            className="w-full rounded-2xl bg-[var(--color-surface-2)] px-4 py-3 text-sm outline-none"
          />
          <p className="mt-1.5 text-xs text-[var(--color-ink-3)]">
            Budget resets every 14 days from this date.
          </p>
        </div>
      )}

      <label className="mb-4 flex items-center justify-between rounded-2xl bg-[var(--color-surface-2)] px-4 py-3">
        <div>
          <div className="text-sm font-medium">Roll over unused</div>
          <div className="text-xs text-[var(--color-ink-3)]">
            Carry leftovers into the next period
          </div>
        </div>
        <input
          type="checkbox"
          checked={rollover}
          onChange={(e) => setRollover(e.target.checked)}
          className="size-5 accent-[var(--color-ink)]"
        />
      </label>
    </Sheet>
  );
}

import { useEffect } from "react";
function useMemoSync(fn: () => void, deps: unknown[]) {
  useEffect(fn, deps);
}
