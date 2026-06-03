"use client";

import { getLegacyDB } from "./db";
import type {
  Account,
  Budget,
  Card,
  Category,
  Recurrence,
  Settings,
  Transaction,
} from "./types";

export interface EntityDiff<T> {
  added: T[];
  changed: { local: T; cloud: T }[];
}

export interface LocalDiff {
  accounts: EntityDiff<Account>;
  cards: EntityDiff<Card>;
  categories: EntityDiff<Category>;
  budgets: EntityDiff<Budget>;
  transactions: EntityDiff<Transaction>;
  recurrences: EntityDiff<Recurrence>;
  totalAdded: number;
  totalChanged: number;
  hasChanges: boolean;
}

export interface CloudSnapshot {
  accounts: Account[];
  cards: Card[];
  categories: Category[];
  budgets: Budget[];
  transactions: Transaction[];
  recurrences: Recurrence[];
}

function canonical(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj)
      .filter((k) => obj[k] !== undefined)
      .sort();
    return (
      "{" +
      keys.map((k) => JSON.stringify(k) + ":" + canonical(obj[k])).join(",") +
      "}"
    );
  }
  return JSON.stringify(value);
}

function rowsEqual<T extends { id: string }>(a: T, b: T): boolean {
  const { id: _ai, createdAt: _ac, ...rest1 } = a as Record<string, unknown> & {
    id: string;
    createdAt?: unknown;
  };
  const { id: _bi, createdAt: _bc, ...rest2 } = b as Record<string, unknown> & {
    id: string;
    createdAt?: unknown;
  };
  void _ai;
  void _ac;
  void _bi;
  void _bc;
  return canonical(rest1) === canonical(rest2);
}

function diffEntity<T extends { id: string }>(
  local: T[],
  cloud: T[],
): EntityDiff<T> {
  const cloudById = new Map(cloud.map((r) => [r.id, r]));
  const added: T[] = [];
  const changed: { local: T; cloud: T }[] = [];
  for (const l of local) {
    const c = cloudById.get(l.id);
    if (!c) added.push(l);
    else if (!rowsEqual(l, c)) changed.push({ local: l, cloud: c });
  }
  return { added, changed };
}

export async function computeLocalDiff(
  cloud: CloudSnapshot,
): Promise<LocalDiff> {
  const db = getLegacyDB();
  const [
    accounts,
    cards,
    categories,
    budgets,
    transactions,
    recurrences,
  ] = await Promise.all([
    db.accounts.toArray(),
    db.cards.toArray(),
    db.categories.toArray(),
    db.budgets.toArray(),
    db.transactions.toArray(),
    db.recurrences.toArray(),
  ]);

  const a = diffEntity(accounts, cloud.accounts);
  const c = diffEntity(cards, cloud.cards);
  const cat = diffEntity(categories, cloud.categories);
  const b = diffEntity(budgets, cloud.budgets);
  const t = diffEntity(transactions, cloud.transactions);
  const r = diffEntity(recurrences, cloud.recurrences);

  const totalAdded =
    a.added.length +
    c.added.length +
    cat.added.length +
    b.added.length +
    t.added.length +
    r.added.length;
  const totalChanged =
    a.changed.length +
    c.changed.length +
    cat.changed.length +
    b.changed.length +
    t.changed.length +
    r.changed.length;

  return {
    accounts: a,
    cards: c,
    categories: cat,
    budgets: b,
    transactions: t,
    recurrences: r,
    totalAdded,
    totalChanged,
    hasChanges: totalAdded + totalChanged > 0,
  };
}

// Stable content hash of legacy DB used to skip re-prompts after dismiss.
export async function computeLocalHash(): Promise<string> {
  const db = getLegacyDB();
  const [
    accounts,
    cards,
    categories,
    budgets,
    transactions,
    recurrences,
    settings,
  ] = await Promise.all([
    db.accounts.toArray(),
    db.cards.toArray(),
    db.categories.toArray(),
    db.budgets.toArray(),
    db.transactions.toArray(),
    db.recurrences.toArray(),
    db.settings.toArray(),
  ]);
  const blob = canonical({
    accounts,
    cards,
    categories,
    budgets,
    transactions,
    recurrences,
    settings,
  });
  // FNV-1a 32-bit
  let h = 0x811c9dc5;
  for (let i = 0; i < blob.length; i++) {
    h ^= blob.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}

interface DiffLine {
  kind: "+" | "~";
  entity: string;
  label: string;
}

function txLabel(t: Transaction): string {
  const merchant = t.merchant?.trim() || "(no merchant)";
  const amt = Math.abs(t.amount).toFixed(2);
  const sign = t.isRefund ? "+" : "−";
  return `${merchant} · ${sign}$${amt} · ${t.date}`;
}

function recurrenceLabel(r: Recurrence): string {
  return `${r.name} · $${r.amount.toFixed(2)} · ${r.period}`;
}

function budgetLabel(b: Budget): string {
  return `${b.period} budget · $${b.amount.toFixed(2)}`;
}

function takeAdded<T>(rows: T[], n: number, mk: (r: T) => string, entity: string): DiffLine[] {
  return rows.slice(0, n).map((r) => ({ kind: "+", entity, label: mk(r) }));
}

function takeChanged<T>(
  rows: { local: T }[],
  n: number,
  mk: (r: T) => string,
  entity: string,
): DiffLine[] {
  return rows.slice(0, n).map((r) => ({ kind: "~", entity, label: mk(r.local) }));
}

export function summarizeDiff(diff: LocalDiff): string[] {
  const lines: string[] = [];
  const pairs: Array<[string, EntityDiff<{ id: string }>]> = [
    ["transaction", diff.transactions as EntityDiff<{ id: string }>],
    ["category", diff.categories as EntityDiff<{ id: string }>],
    ["account", diff.accounts as EntityDiff<{ id: string }>],
    ["card", diff.cards as EntityDiff<{ id: string }>],
    ["budget", diff.budgets as EntityDiff<{ id: string }>],
    ["recurring bill", diff.recurrences as EntityDiff<{ id: string }>],
  ];
  for (const [name, ed] of pairs) {
    if (ed.added.length)
      lines.push(`${ed.added.length} new ${name}${ed.added.length === 1 ? "" : "s"}`);
    if (ed.changed.length)
      lines.push(`${ed.changed.length} edited ${name}${ed.changed.length === 1 ? "" : "s"}`);
  }
  return lines;
}

export function diffPreviewLines(diff: LocalDiff, perGroup = 4): DiffLine[] {
  const lines: DiffLine[] = [];
  lines.push(
    ...takeAdded(diff.transactions.added, perGroup, txLabel, "transaction"),
    ...takeChanged(diff.transactions.changed, perGroup, txLabel, "transaction"),
    ...takeAdded(diff.categories.added, perGroup, (c) => c.name, "category"),
    ...takeChanged(diff.categories.changed, perGroup, (c) => c.name, "category"),
    ...takeAdded(diff.accounts.added, perGroup, (a) => `${a.name} (${a.bank})`, "account"),
    ...takeChanged(diff.accounts.changed, perGroup, (a) => `${a.name} (${a.bank})`, "account"),
    ...takeAdded(diff.cards.added, perGroup, (c) => c.nickname, "card"),
    ...takeChanged(diff.cards.changed, perGroup, (c) => c.nickname, "card"),
    ...takeAdded(diff.budgets.added, perGroup, budgetLabel, "budget"),
    ...takeChanged(diff.budgets.changed, perGroup, budgetLabel, "budget"),
    ...takeAdded(diff.recurrences.added, perGroup, recurrenceLabel, "recurring bill"),
    ...takeChanged(diff.recurrences.changed, perGroup, recurrenceLabel, "recurring bill"),
  );
  return lines;
}

export type { DiffLine };

// Build a payload that contains ONLY the rows the diff identified as
// added or changed locally. Used by `applyLocalChanges` to send a minimal
// upsert batch instead of the whole local DB.
function pickRows<T extends { id: string }>(
  local: T[],
  ed: EntityDiff<T>,
): T[] {
  const ids = new Set<string>();
  for (const r of ed.added) ids.add(r.id);
  for (const r of ed.changed) ids.add(r.local.id);
  return local.filter((r) => ids.has(r.id));
}

function renameIdToClientId<T extends { id: string }>(
  rows: T[],
): (Omit<T, "id"> & { clientId: string })[] {
  return rows.map(({ id, ...rest }) => ({
    ...(rest as Omit<T, "id">),
    clientId: id,
  }));
}

export interface DiffPayload {
  accounts: (Omit<Account, "id"> & { clientId: string })[];
  cards: (Omit<Card, "id"> & { clientId: string })[];
  categories: (Omit<Category, "id"> & { clientId: string })[];
  budgets: (Omit<Budget, "id"> & { clientId: string })[];
  transactions: (Omit<Transaction, "id"> & { clientId: string })[];
  recurrences: (Omit<Recurrence, "id"> & { clientId: string })[];
  settings?: Omit<Settings, "id">;
}

export async function assembleDiffPayload(diff: LocalDiff): Promise<DiffPayload> {
  const db = getLegacyDB();
  const [
    accounts,
    cards,
    categories,
    budgets,
    transactions,
    recurrences,
    settingsArr,
  ] = await Promise.all([
    db.accounts.toArray(),
    db.cards.toArray(),
    db.categories.toArray(),
    db.budgets.toArray(),
    db.transactions.toArray(),
    db.recurrences.toArray(),
    db.settings.toArray(),
  ]);

  const settingsRow = settingsArr.find((s) => s.id === "singleton");
  const settings = settingsRow
    ? {
        theme: settingsRow.theme,
        currency: settingsRow.currency,
        biweeklyAnchor: settingsRow.biweeklyAnchor,
        overallMonthly: settingsRow.overallMonthly,
        backupCadence: settingsRow.backupCadence,
        lastExportAt: settingsRow.lastExportAt,
      }
    : undefined;

  return {
    accounts: renameIdToClientId(pickRows(accounts, diff.accounts)),
    cards: renameIdToClientId(pickRows(cards, diff.cards)),
    categories: renameIdToClientId(pickRows(categories, diff.categories)),
    budgets: renameIdToClientId(pickRows(budgets, diff.budgets)),
    transactions: renameIdToClientId(pickRows(transactions, diff.transactions)),
    recurrences: renameIdToClientId(pickRows(recurrences, diff.recurrences)),
    settings,
  };
}
