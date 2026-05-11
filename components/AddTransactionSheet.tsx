"use client";

import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Sheet } from "./Sheet";
import { getDB, uid } from "@/lib/db";
import { isoToday, money } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Transaction } from "@/lib/types";

export function AddTransactionSheet({
  open,
  onClose,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  initial?: Transaction;
}) {
  const editing = !!initial;
  const [amount, setAmount] = useState<string>("");
  const [date, setDate] = useState<string>(isoToday());
  const [accountId, setAccountId] = useState<string | undefined>();
  const [cardId, setCardId] = useState<string | undefined>();
  const [categoryId, setCategoryId] = useState<string | undefined>();
  const [merchant, setMerchant] = useState("");
  const [note, setNote] = useState("");

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
        ? getDB()
            .categories.filter((c) => !c.archived)
            .toArray()
        : [],
    [open],
  );

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setAmount(String(initial.amount));
      setDate(initial.date);
      setAccountId(initial.accountId);
      setCardId(initial.cardId);
      setCategoryId(initial.categoryId);
      setMerchant(initial.merchant ?? "");
      setNote(initial.note ?? "");
    } else {
      setAmount("");
      setDate(isoToday());
      setAccountId(accounts?.[0]?.id);
      setCardId(undefined);
      setCategoryId(categories?.[0]?.id);
      setMerchant("");
      setNote("");
    }
  }, [open, initial, accounts, categories]);

  const filteredCards = useMemo(
    () => (cards ?? []).filter((c) => !accountId || c.accountId === accountId),
    [cards, accountId],
  );

  const amountNum = Number(amount.replace(/[^0-9.]/g, ""));
  const valid = !!amount && !Number.isNaN(amountNum) && amountNum > 0;

  async function save() {
    if (!valid) return;
    const db = getDB();
    const now = Date.now();
    if (editing && initial) {
      await db.transactions.update(initial.id, {
        amount: amountNum,
        date,
        accountId,
        cardId,
        categoryId,
        merchant: merchant || undefined,
        note: note || undefined,
      });
    } else {
      await db.transactions.add({
        id: uid("tx_"),
        amount: amountNum,
        date,
        accountId,
        cardId,
        categoryId,
        merchant: merchant || undefined,
        note: note || undefined,
        createdAt: now,
      });
    }
    onClose();
  }

  async function remove() {
    if (!initial) return;
    await getDB().transactions.delete(initial.id);
    onClose();
  }

  function keypad(v: string) {
    if (v === "back") {
      setAmount((a) => a.slice(0, -1));
      return;
    }
    if (v === ".") {
      if (amount.includes(".")) return;
      setAmount((a) => (a === "" ? "0." : a + "."));
      return;
    }
    setAmount((a) => {
      if (a === "0") return v;
      if (a.includes(".") && a.split(".")[1]?.length >= 2) return a;
      return a + v;
    });
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={editing ? "Edit expense" : "New expense"}
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
            {editing ? "Save changes" : "Add expense"}
          </button>
        </div>
      }
    >
      <div className="mt-4 mb-6 text-center">
        <div className="text-[11px] uppercase tracking-wider text-[var(--color-ink-3)]">
          Amount (CAD)
        </div>
        <div className="font-display mt-1 text-6xl tabular">
          {money(amountNum || 0)}
        </div>
      </div>

      <div className="mb-5 grid grid-cols-3 gap-2">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "back"].map(
          (k) => (
            <button
              key={k}
              type="button"
              onClick={() => keypad(k)}
              className="rounded-2xl bg-[var(--color-surface-2)] py-4 text-xl font-medium active:scale-95 transition-transform"
            >
              {k === "back" ? "⌫" : k}
            </button>
          ),
        )}
      </div>

      <Field label="Category">
        <div className="flex flex-wrap gap-2">
          {(categories ?? []).map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategoryId(c.id)}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors",
                categoryId === c.id
                  ? "border-[var(--color-ink)] bg-[var(--color-ink)] text-[var(--color-bg)]"
                  : "border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-ink-2)]",
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
              {a.last4 && (
                <span className="text-[var(--color-ink-3)]">·{a.last4}</span>
              )}
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
                {c.last4 && (
                  <span className="ml-1 text-[var(--color-ink-3)]">
                    ·{c.last4}
                  </span>
                )}
              </button>
            ))}
          </div>
        </Field>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Date">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-2xl bg-[var(--color-surface-2)] px-3 py-2.5 text-sm outline-none"
          />
        </Field>
        <Field label="Merchant">
          <input
            type="text"
            placeholder="e.g. Loblaws"
            value={merchant}
            onChange={(e) => setMerchant(e.target.value)}
            className="w-full rounded-2xl bg-[var(--color-surface-2)] px-3 py-2.5 text-sm outline-none"
          />
        </Field>
      </div>
      <Field label="Note">
        <input
          type="text"
          placeholder="Anything to remember"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="w-full rounded-2xl bg-[var(--color-surface-2)] px-3 py-2.5 text-sm outline-none"
        />
      </Field>
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
