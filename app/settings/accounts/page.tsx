"use client";

import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronLeft, Plus } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Sheet } from "@/components/Sheet";
import { getDB, uid } from "@/lib/db";
import { repo } from "@/lib/repo";
import { KNOWN_BANKS } from "@/lib/seed";
import { cn } from "@/lib/utils";
import type { Account, AccountType, Card } from "@/lib/types";

const TYPES: { id: AccountType; label: string }[] = [
  { id: "chequing", label: "Chequing" },
  { id: "savings", label: "Savings" },
  { id: "credit", label: "Credit" },
  { id: "cash", label: "Cash" },
  { id: "other", label: "Other" },
];

export default function AccountsPage() {
  const accounts = useLiveQuery(
    () => getDB().accounts.filter((a) => !a.archived).toArray(),
    [],
  );
  const cards = useLiveQuery(
    () => getDB().cards.filter((c) => !c.archived).toArray(),
    [],
  );
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Account | undefined>();
  const [cardOpen, setCardOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<Card | undefined>();
  const [cardAccountId, setCardAccountId] = useState<string | undefined>();

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
        title="Banks & cards"
        right={
          <button
            type="button"
            onClick={() => {
              setEditing(undefined);
              setOpen(true);
            }}
            className="flex items-center gap-1 rounded-full bg-[var(--color-ink)] px-3 py-1.5 text-xs text-[var(--color-bg)]"
          >
            <Plus className="size-3.5" /> Bank
          </button>
        }
      />

      <section className="px-5">
        <div className="space-y-3">
          {(accounts ?? []).map((a) => {
            const accCards = (cards ?? []).filter((c) => c.accountId === a.id);
            return (
              <div
                key={a.id}
                className="overflow-hidden rounded-[22px] bg-[var(--color-surface)]"
              >
                <button
                  type="button"
                  onClick={() => {
                    setEditing(a);
                    setOpen(true);
                  }}
                  className="flex w-full items-center gap-3 p-4 text-left"
                >
                  <div
                    className="h-12 w-16 rounded-md"
                    style={{ background: a.color }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{a.name}</div>
                    <div className="text-xs text-[var(--color-ink-3)]">
                      {a.bank} · {a.type}
                      {a.last4 ? ` · ${a.last4}` : ""}
                    </div>
                  </div>
                </button>
                <div className="border-t border-[var(--color-line)] px-4 pb-3 pt-2">
                  <div className="mb-1 flex items-center justify-between">
                    <div className="text-[10px] uppercase tracking-wider text-[var(--color-ink-3)]">
                      Cards
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCard(undefined);
                        setCardAccountId(a.id);
                        setCardOpen(true);
                      }}
                      className="text-xs text-[var(--color-ink-3)] hover:underline"
                    >
                      + Add card
                    </button>
                  </div>
                  {accCards.length === 0 && (
                    <div className="py-1 text-xs text-[var(--color-ink-3)]">
                      No cards yet
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {accCards.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setEditingCard(c);
                          setCardAccountId(a.id);
                          setCardOpen(true);
                        }}
                        className="flex items-center gap-2 rounded-full border border-[var(--color-line)] px-3 py-1 text-xs"
                      >
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ background: c.color }}
                        />
                        {c.nickname}
                        {c.last4 && (
                          <span className="text-[var(--color-ink-3)]">
                            ·{c.last4}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <AccountEditor
        open={open}
        onClose={() => setOpen(false)}
        editing={editing}
      />
      <CardEditor
        open={cardOpen}
        onClose={() => setCardOpen(false)}
        editing={editingCard}
        accountId={cardAccountId}
      />
    </div>
  );
}

function AccountEditor({
  open,
  onClose,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  editing?: Account;
}) {
  const [name, setName] = useState("");
  const [bank, setBank] = useState(KNOWN_BANKS[0].name);
  const [color, setColor] = useState(KNOWN_BANKS[0].color);
  const [type, setType] = useState<AccountType>("chequing");
  const [last4, setLast4] = useState("");

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setName(editing.name);
      setBank(editing.bank);
      setColor(editing.color);
      setType(editing.type);
      setLast4(editing.last4 ?? "");
    } else {
      setName("");
      setBank(KNOWN_BANKS[0].name);
      setColor(KNOWN_BANKS[0].color);
      setType("chequing");
      setLast4("");
    }
  }, [open, editing]);

  const valid = name.trim().length > 0;

  async function save() {
    if (!valid) return;
    if (editing) {
      await repo.accounts.update(editing.id, {
        name: name.trim(),
        bank,
        color,
        type,
        last4: last4 || undefined,
      });
    } else {
      await repo.accounts.put({
        id: uid("acc_"),
        name: name.trim(),
        bank,
        color,
        type,
        last4: last4 || undefined,
        createdAt: Date.now(),
      });
    }
    onClose();
  }

  async function remove() {
    if (!editing) return;
    await repo.accounts.update(editing.id, { archived: true });
    onClose();
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={editing ? "Edit account" : "New account"}
      footer={
        <div className="flex gap-2">
          {editing && (
            <button
              type="button"
              onClick={remove}
              className="flex-1 rounded-full border border-[var(--color-line)] py-3 text-sm text-[var(--color-danger)]"
            >
              Archive
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
      <div className="mb-4 flex items-center gap-3">
        <div
          className="h-14 w-24 rounded-lg shadow-sm"
          style={{ background: color }}
        />
        <div>
          <div className="text-sm font-medium">{name || "Account name"}</div>
          <div className="text-xs text-[var(--color-ink-3)]">
            {bank} · {type}
            {last4 ? ` · ${last4}` : ""}
          </div>
        </div>
      </div>

      <Field label="Bank">
        <div className="flex flex-wrap gap-2">
          {KNOWN_BANKS.map((b) => (
            <button
              key={b.name}
              type="button"
              onClick={() => {
                setBank(b.name);
                setColor(b.color);
              }}
              className={cn(
                "flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm",
                bank === b.name
                  ? "border-[var(--color-ink)] bg-[var(--color-ink)] text-[var(--color-bg)]"
                  : "border-[var(--color-line)]",
              )}
            >
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: b.color }}
              />
              {b.name}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Account name">
        <input
          type="text"
          value={name}
          autoFocus
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Everyday Chequing"
          className="w-full rounded-2xl bg-[var(--color-surface-2)] px-4 py-3 text-base outline-none"
        />
      </Field>

      <Field label="Type">
        <div className="flex flex-wrap gap-2">
          {TYPES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setType(t.id)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm",
                type === t.id
                  ? "border-[var(--color-ink)] bg-[var(--color-ink)] text-[var(--color-bg)]"
                  : "border-[var(--color-line)]",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Last 4 (optional)">
        <input
          type="text"
          maxLength={4}
          inputMode="numeric"
          value={last4}
          onChange={(e) => setLast4(e.target.value.replace(/\D/g, ""))}
          placeholder="1234"
          className="w-full rounded-2xl bg-[var(--color-surface-2)] px-4 py-3 text-base outline-none"
        />
      </Field>
    </Sheet>
  );
}

const CARD_COLORS = [
  "#0a0a0a",
  "#005DAA",
  "#1B7935",
  "#EC111A",
  "#FF6600",
  "#a855f7",
  "#0079C1",
  "#006FCF",
];

function CardEditor({
  open,
  onClose,
  editing,
  accountId,
}: {
  open: boolean;
  onClose: () => void;
  editing?: Card;
  accountId?: string;
}) {
  const [nickname, setNickname] = useState("");
  const [last4, setLast4] = useState("");
  const [color, setColor] = useState(CARD_COLORS[0]);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setNickname(editing.nickname);
      setLast4(editing.last4 ?? "");
      setColor(editing.color);
    } else {
      setNickname("");
      setLast4("");
      setColor(CARD_COLORS[0]);
    }
  }, [open, editing]);

  const valid = nickname.trim().length > 0 && (editing || !!accountId);

  async function save() {
    if (!valid) return;
    if (editing) {
      await repo.cards.update(editing.id, {
        nickname: nickname.trim(),
        last4: last4 || undefined,
        color,
      });
    } else {
      await repo.cards.put({
        id: uid("crd_"),
        accountId: accountId!,
        nickname: nickname.trim(),
        last4: last4 || undefined,
        color,
        createdAt: Date.now(),
      });
    }
    onClose();
  }

  async function remove() {
    if (!editing) return;
    await repo.cards.update(editing.id, { archived: true });
    onClose();
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={editing ? "Edit card" : "New card"}
      footer={
        <div className="flex gap-2">
          {editing && (
            <button
              type="button"
              onClick={remove}
              className="flex-1 rounded-full border border-[var(--color-line)] py-3 text-sm text-[var(--color-danger)]"
            >
              Archive
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
      <Field label="Nickname">
        <input
          type="text"
          value={nickname}
          autoFocus
          onChange={(e) => setNickname(e.target.value)}
          placeholder="e.g. Cashback Visa"
          className="w-full rounded-2xl bg-[var(--color-surface-2)] px-4 py-3 text-base outline-none"
        />
      </Field>
      <Field label="Last 4 (optional)">
        <input
          type="text"
          maxLength={4}
          inputMode="numeric"
          value={last4}
          onChange={(e) => setLast4(e.target.value.replace(/\D/g, ""))}
          placeholder="1234"
          className="w-full rounded-2xl bg-[var(--color-surface-2)] px-4 py-3 text-base outline-none"
        />
      </Field>
      <Field label="Color">
        <div className="flex flex-wrap gap-2">
          {CARD_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              aria-label={c}
              className={cn(
                "h-9 w-9 rounded-full",
                color === c
                  ? "ring-2 ring-[var(--color-ink)] ring-offset-2 ring-offset-[var(--color-surface)]"
                  : "",
              )}
              style={{ background: c }}
            />
          ))}
        </div>
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
