"use client";

import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronLeft, Plus, Repeat } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Sheet } from "@/components/Sheet";
import { getDB, uid } from "@/lib/db";
import { money, isoToday } from "@/lib/format";
import { periodLabel } from "@/lib/recurrence";
import { cn } from "@/lib/utils";
import type { Recurrence, RecurrencePeriod } from "@/lib/types";

export default function RecurringPage() {
  const recurrences = useLiveQuery(
    () => getDB().recurrences.toArray(),
    [],
  );
  const categories = useLiveQuery(() => getDB().categories.toArray(), []);
  const accounts = useLiveQuery(() => getDB().accounts.toArray(), []);
  const [editing, setEditing] = useState<Recurrence | undefined>();
  const [editorOpen, setEditorOpen] = useState(false);

  return (
    <div>
      <PageHeader
        eyebrow={
          <Link
            href="/settings"
            className="inline-flex items-center gap-1 hover:underline"
          >
            <ChevronLeft className="size-3" /> Settings
          </Link>
        }
        title="Recurring"
        right={
          <button
            type="button"
            onClick={() => {
              setEditing(undefined);
              setEditorOpen(true);
            }}
            className="flex items-center gap-1 rounded-full bg-[var(--color-ink)] px-3 py-1.5 text-xs text-[var(--color-bg)]"
          >
            <Plus className="size-3.5" /> New
          </button>
        }
      />

      <section className="px-5">
        <p className="mb-4 text-sm text-[var(--color-ink-3)]">
          Set up subscriptions, rent, hydro — anything you pay on a schedule.
          Tiffin will surface them on Home when they're due so you can log
          with one tap.
        </p>

        {(recurrences ?? []).length === 0 && (
          <div className="rounded-[22px] bg-[var(--color-surface)] py-10 text-center text-sm text-[var(--color-ink-3)]">
            No recurring expenses yet. Tap <strong>New</strong> to add one.
          </div>
        )}

        <div className="space-y-2">
          {(recurrences ?? []).map((r) => {
            const cat = categories?.find((c) => c.id === r.categoryId);
            const acct = accounts?.find((a) => a.id === r.accountId);
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  setEditing(r);
                  setEditorOpen(true);
                }}
                className={cn(
                  "flex w-full items-center gap-3 rounded-[18px] bg-[var(--color-surface)] p-4 text-left",
                  !r.active && "opacity-50",
                )}
              >
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-full text-lg"
                  style={{ background: (cat?.color ?? "#94a3b8") + "22" }}
                >
                  <span>{cat?.icon ?? "🔁"}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{r.name}</div>
                  <div className="text-xs text-[var(--color-ink-3)]">
                    {periodLabel(r.period)} · next {r.nextDue}
                    {acct ? ` · ${acct.name}` : ""}
                    {!r.active && " · paused"}
                  </div>
                </div>
                <div className="tabular text-sm font-medium">
                  {money(r.amount)}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <RecurrenceEditor
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        editing={editing}
      />
    </div>
  );
}

function RecurrenceEditor({
  open,
  onClose,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  editing?: Recurrence;
}) {
  const accounts = useLiveQuery(
    () => (open ? getDB().accounts.filter((a) => !a.archived).toArray() : []),
    [open],
  );
  const cards = useLiveQuery(
    () => (open ? getDB().cards.filter((c) => !c.archived).toArray() : []),
    [open],
  );
  const categories = useLiveQuery(
    () =>
      open
        ? getDB().categories.filter((c) => !c.archived).toArray()
        : [],
    [open],
  );

  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [period, setPeriod] = useState<RecurrencePeriod>("monthly");
  const [nextDue, setNextDue] = useState(isoToday());
  const [accountId, setAccountId] = useState<string | undefined>();
  const [cardId, setCardId] = useState<string | undefined>();
  const [categoryId, setCategoryId] = useState<string | undefined>();
  const [merchant, setMerchant] = useState("");
  const [active, setActive] = useState(true);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setName(editing.name);
      setAmount(String(editing.amount));
      setPeriod(editing.period);
      setNextDue(editing.nextDue);
      setAccountId(editing.accountId);
      setCardId(editing.cardId);
      setCategoryId(editing.categoryId);
      setMerchant(editing.merchant ?? "");
      setActive(editing.active);
    } else {
      setName("");
      setAmount("");
      setPeriod("monthly");
      setNextDue(isoToday());
      setAccountId(accounts?.[0]?.id);
      setCardId(undefined);
      setCategoryId(categories?.[0]?.id);
      setMerchant("");
      setActive(true);
    }
  }, [open, editing, accounts, categories]);

  const valid = name.trim().length > 0 && Number(amount) > 0;

  async function save() {
    if (!valid) return;
    const db = getDB();
    if (editing) {
      await db.recurrences.update(editing.id, {
        name: name.trim(),
        amount: Number(amount),
        period,
        nextDue,
        accountId,
        cardId,
        categoryId,
        merchant: merchant || undefined,
        active,
      });
    } else {
      await db.recurrences.add({
        id: uid("rec_"),
        name: name.trim(),
        amount: Number(amount),
        period,
        nextDue,
        accountId,
        cardId,
        categoryId,
        merchant: merchant || undefined,
        active,
        createdAt: Date.now(),
      });
    }
    onClose();
  }

  async function remove() {
    if (!editing) return;
    await getDB().recurrences.delete(editing.id);
    onClose();
  }

  const filteredCards = (cards ?? []).filter(
    (c) => !accountId || c.accountId === accountId,
  );

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={editing ? "Edit recurring" : "New recurring"}
      footer={
        <div className="flex gap-2">
          {editing && (
            <button
              type="button"
              onClick={remove}
              className="flex-1 rounded-full border border-[var(--color-line)] py-3 text-sm text-[var(--color-danger)]"
            >
              Delete
            </button>
          )}
          <button
            type="button"
            disabled={!valid}
            onClick={save}
            className="flex-1 rounded-full bg-[var(--color-ink)] py-3 text-sm font-medium text-[var(--color-bg)] disabled:opacity-40"
          >
            {editing ? "Save" : "Create"}
          </button>
        </div>
      }
    >
      <Field label="Name">
        <input
          type="text"
          autoFocus
          placeholder="e.g. Rent, Spotify, Hydro"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-11 w-full rounded-2xl bg-[var(--color-surface-2)] px-4 text-sm outline-none"
        />
      </Field>

      <Field label="Amount (CAD)">
        <input
          type="number"
          inputMode="decimal"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          className="font-display h-12 w-full rounded-2xl bg-[var(--color-surface-2)] px-4 text-xl tabular outline-none"
        />
      </Field>

      <Field label="Cadence">
        <div className="grid grid-cols-3 gap-2">
          {(
            ["weekly", "biweekly", "monthly"] as RecurrencePeriod[]
          ).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={cn(
                "rounded-2xl border py-2.5 text-sm capitalize",
                period === p
                  ? "border-[var(--color-ink)] bg-[var(--color-ink)] text-[var(--color-bg)]"
                  : "border-[var(--color-line)]",
              )}
            >
              {p}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Next due">
        <input
          type="date"
          value={nextDue}
          onChange={(e) => setNextDue(e.target.value)}
          className="block h-11 w-full min-w-0 max-w-full appearance-none rounded-2xl bg-[var(--color-surface-2)] px-4 text-sm outline-none"
        />
      </Field>

      <Field label="Category">
        <div className="flex flex-wrap gap-2">
          {(categories ?? []).map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategoryId(c.id)}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm",
                categoryId === c.id
                  ? "border-[var(--color-ink)] bg-[var(--color-ink)] text-[var(--color-bg)]"
                  : "border-[var(--color-line)]",
              )}
            >
              <span>{c.icon}</span>
              <span>{c.name}</span>
            </button>
          ))}
        </div>
      </Field>

      <Field label="Account">
        <div className="flex flex-wrap gap-2">
          {(accounts ?? []).map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => {
                setAccountId(a.id);
                setCardId(undefined);
              }}
              className={cn(
                "flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm",
                accountId === a.id
                  ? "border-[var(--color-ink)]"
                  : "border-[var(--color-line)]",
              )}
            >
              <span
                className="h-3 w-3 rounded-full"
                style={{ background: a.color }}
              />
              <span>{a.name}</span>
            </button>
          ))}
        </div>
      </Field>

      {filteredCards.length > 0 && (
        <Field label="Card (optional)">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setCardId(undefined)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm",
                !cardId
                  ? "border-[var(--color-ink)]"
                  : "border-[var(--color-line)]",
              )}
            >
              None
            </button>
            {filteredCards.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCardId(c.id)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-sm",
                  cardId === c.id
                    ? "border-[var(--color-ink)]"
                    : "border-[var(--color-line)]",
                )}
              >
                {c.nickname}
              </button>
            ))}
          </div>
        </Field>
      )}

      <Field label="Merchant (optional)">
        <input
          type="text"
          placeholder="e.g. Spotify"
          value={merchant}
          onChange={(e) => setMerchant(e.target.value)}
          className="h-11 w-full rounded-2xl bg-[var(--color-surface-2)] px-4 text-sm outline-none"
        />
      </Field>

      <label className="mb-4 flex items-center justify-between rounded-2xl bg-[var(--color-surface-2)] px-4 py-3">
        <div>
          <div className="text-sm font-medium">Active</div>
          <div className="text-xs text-[var(--color-ink-3)]">
            Surface on Home when due
          </div>
        </div>
        <input
          type="checkbox"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
          className="size-5 accent-[var(--color-ink)]"
        />
      </label>
    </Sheet>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4">
      <div className="mb-1.5 text-[11px] uppercase tracking-wider text-[var(--color-ink-3)]">
        {label}
      </div>
      {children}
    </div>
  );
}
