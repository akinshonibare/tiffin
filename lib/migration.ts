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

export interface LocalCounts {
  accounts: number;
  cards: number;
  categories: number;
  budgets: number;
  transactions: number;
  recurrences: number;
  total: number;
}

type WithClientId<T extends { id: string }> = Omit<T, "id"> & {
  clientId: string;
};

export interface LocalPayload {
  accounts: WithClientId<Account>[];
  cards: WithClientId<Card>[];
  categories: WithClientId<Category>[];
  budgets: WithClientId<Budget>[];
  transactions: WithClientId<Transaction>[];
  recurrences: WithClientId<Recurrence>[];
  settings?: Omit<Settings, "id">;
  badges?: unknown;
}

function renameIdToClientId<T extends { id: string }>(
  rows: T[],
): WithClientId<T>[] {
  return rows.map(({ id, ...rest }) => ({
    ...(rest as Omit<T, "id">),
    clientId: id,
  }));
}

export async function detectLocalData(): Promise<LocalCounts> {
  const db = getLegacyDB();
  const [
    accounts,
    cards,
    categories,
    budgets,
    transactions,
    recurrences,
  ] = await Promise.all([
    db.accounts.count(),
    db.cards.count(),
    db.categories.count(),
    db.budgets.count(),
    db.transactions.count(),
    db.recurrences.count(),
  ]);
  return {
    accounts,
    cards,
    categories,
    budgets,
    transactions,
    recurrences,
    total:
      accounts +
      cards +
      categories +
      budgets +
      transactions +
      recurrences,
  };
}

export async function assembleLocalPayload(): Promise<LocalPayload> {
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

  let badges: unknown = undefined;
  try {
    const raw = localStorage.getItem("tiffin.badges");
    if (raw) badges = JSON.parse(raw);
  } catch {}

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
    accounts: renameIdToClientId(accounts),
    cards: renameIdToClientId(cards),
    categories: renameIdToClientId(categories),
    budgets: renameIdToClientId(budgets),
    transactions: renameIdToClientId(transactions),
    recurrences: renameIdToClientId(recurrences),
    settings,
    badges,
  };
}
