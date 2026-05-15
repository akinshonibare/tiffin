"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useMemo, useState } from "react";
import { Plus, Sparkles, Target } from "lucide-react";
import { useAuthState } from "@/lib/auth";
import { getDB, uid } from "@/lib/db";
import { repo } from "@/lib/repo";
import { money, isoToday } from "@/lib/format";
import {
  currentMonthPeriod,
  periodForBudget,
  sumInRange,
} from "@/lib/budget";
import { PageHeader } from "@/components/PageHeader";
import { BudgetRing } from "@/components/BudgetRing";
import { Sheet } from "@/components/Sheet";
import { SuggestBudgetsSheet } from "@/components/SuggestBudgetsSheet";
import { isClerkConfigured } from "@/lib/convex";
import { cn } from "@/lib/utils";
import { EMPTY_BUDGETS, pickDeterministic } from "@/lib/easter";
import type { Budget, BudgetPeriod, Category } from "@/lib/types";

export default function BudgetsPage() {
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Budget | undefined>();
  const [overallOpen, setOverallOpen] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const { isSignedIn } = useAuthState();
  const aiAvailable = isClerkConfigured() && isSignedIn;

  const budgets = useLiveQuery(() => getDB().budgets.toArray(), []);
  const categories = useLiveQuery(() => getDB().categories.toArray(), []);
  const txs = useLiveQuery(() => getDB().transactions.toArray(), []);
  const settings = useLiveQuery(() => getDB().settings.get("singleton"), []);

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

  const month = currentMonthPeriod();
  const monthSpent = useMemo(
    () =>
      (txs ?? [])
        .filter((t) => t.date >= month.start && t.date <= month.end)
        .reduce((a, t) => a + t.amount, 0),
    [txs, month.start, month.end],
  );
  const overall = settings?.overallMonthly ?? 0;
  const overallPct = overall > 0 ? monthSpent / overall : 0;
  const overallOver = monthSpent > overall && overall > 0;
  const overallExceedsCats =
    overall > 0 && totalBudgetMonthly > overall;

  return (
    <div>
      <PageHeader
        eyebrow="Budgets"
        title="Categories"
        right={
          <div className="flex items-center gap-2">
            {aiAvailable && (
              <button
                type="button"
                onClick={() => setSuggestOpen(true)}
                className="flex items-center gap-1 rounded-full border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-1.5 text-xs text-[var(--color-ink-2)]"
              >
                <Sparkles className="size-3.5" /> Suggest
              </button>
            )}
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
          </div>
        }
      />

      <section className="px-5">
        <button
          type="button"
          onClick={() => setOverallOpen(true)}
          className="mb-3 flex w-full items-center gap-4 rounded-[22px] bg-[var(--color-surface)] p-4 text-left"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent-soft)] text-[var(--color-accent)]">
            <Target className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] uppercase tracking-wider text-[var(--color-ink-3)]">
              Overall monthly budget
            </div>
            {overall > 0 ? (
              <>
                <div className="font-display mt-0.5 text-2xl tabular leading-none">
                  {money(monthSpent)}{" "}
                  <span className="text-base text-[var(--color-ink-3)]">
                    / {money(overall)}
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--color-surface-2)]">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, overallPct * 100)}%`,
                      background: overallOver
                        ? "var(--color-danger)"
                        : overallPct > 0.85
                          ? "var(--color-warn)"
                          : "var(--color-accent)",
                    }}
                  />
                </div>
                <div className="mt-1.5 text-xs text-[var(--color-ink-3)]">
                  {overallOver
                    ? `${money(monthSpent - overall)} over for ${month.label}`
                    : `${money(overall - monthSpent)} left for ${month.label}`}
                  {overallExceedsCats && (
                    <span className="ml-1 text-[var(--color-warn)]">
                      · category budgets sum to {money(totalBudgetMonthly)}
                    </span>
                  )}
                </div>
              </>
            ) : (
              <div className="mt-0.5 text-sm text-[var(--color-ink-3)]">
                Set a single cap for the whole month →
              </div>
            )}
          </div>
        </button>

        <div className="mb-1.5 px-1 text-[11px] uppercase tracking-wider text-[var(--color-ink-3)]">
          Category budgets
        </div>
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
            {pickDeterministic(EMPTY_BUDGETS, new Date().toDateString())}
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
      <OverallEditor
        open={overallOpen}
        onClose={() => setOverallOpen(false)}
        initial={overall}
      />
      <SuggestBudgetsSheet
        open={suggestOpen}
        onClose={() => setSuggestOpen(false)}
      />
    </div>
  );
}

function OverallEditor({
  open,
  onClose,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  initial: number;
}) {
  const [amount, setAmount] = useState("");

  useEffect(() => {
    if (!open) return;
    setAmount(initial > 0 ? String(initial) : "");
  }, [open, initial]);

  const amt = Number(amount);

  async function save() {
    await repo.settings.update({
      overallMonthly: amt > 0 ? amt : undefined,
    });
    onClose();
  }

  async function clear() {
    await repo.settings.update({ overallMonthly: undefined });
    onClose();
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Overall monthly budget"
      footer={
        <div className="flex gap-2">
          {initial > 0 && (
            <button
              type="button"
              onClick={clear}
              className="flex-1 rounded-full border border-[var(--color-line)] py-3 text-sm text-[var(--color-danger)]"
            >
              Remove
            </button>
          )}
          <button
            type="button"
            onClick={save}
            disabled={amount !== "" && (!Number.isFinite(amt) || amt < 0)}
            className="flex-1 rounded-full bg-[var(--color-ink)] py-3 text-sm font-medium text-[var(--color-bg)] disabled:opacity-40"
          >
            Save
          </button>
        </div>
      }
    >
      <p className="mb-4 text-sm text-[var(--color-ink-3)]">
        One single cap for the whole month, regardless of categories. Useful
        as a top-line goal — Home and Budgets will show progress against this
        number.
      </p>
      <div className="mb-4">
        <div className="mb-1.5 text-[11px] uppercase tracking-wider text-[var(--color-ink-3)]">
          Amount (CAD)
        </div>
        <input
          type="number"
          inputMode="decimal"
          step="50"
          min="0"
          autoFocus
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="e.g. 3000"
          className="font-display w-full rounded-2xl bg-[var(--color-surface-2)] px-4 py-3 text-2xl tabular outline-none"
        />
      </div>
    </Sheet>
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

  useEffect(() => {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing?.id]);

  const amt = Number(amount);
  const valid = !!categoryId && amt > 0;

  async function save() {
    if (!valid) return;
    if (editing) {
      await repo.budgets.update(editing.id, {
        categoryId: categoryId!,
        amount: amt,
        period,
        anchorDate,
        rollover,
      });
    } else {
      await repo.budgets.put({
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
    await repo.budgets.delete(editing.id);
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
