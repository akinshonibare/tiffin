import Dexie, { type EntityTable } from "dexie";
import type {
  Account,
  Budget,
  Card,
  Category,
  Recurrence,
  Settings,
  Transaction,
} from "./types";

export class TiffinDB extends Dexie {
  accounts!: EntityTable<Account, "id">;
  cards!: EntityTable<Card, "id">;
  categories!: EntityTable<Category, "id">;
  budgets!: EntityTable<Budget, "id">;
  transactions!: EntityTable<Transaction, "id">;
  recurrences!: EntityTable<Recurrence, "id">;
  settings!: EntityTable<Settings, "id">;

  constructor() {
    super("tiffin");
    this.version(1).stores({
      accounts: "id, name, bank, type, archived, createdAt",
      cards: "id, accountId, archived, createdAt",
      categories: "id, name, archived, createdAt",
      budgets: "id, categoryId, period, createdAt",
      transactions: "id, date, accountId, cardId, categoryId, createdAt",
      settings: "id",
    });
    this.version(2).stores({
      accounts: "id, name, bank, type, archived, createdAt",
      cards: "id, accountId, archived, createdAt",
      categories: "id, name, archived, createdAt",
      budgets: "id, categoryId, period, createdAt",
      transactions:
        "id, date, accountId, cardId, categoryId, recurrenceId, createdAt",
      recurrences: "id, period, nextDue, active, createdAt",
      settings: "id",
    });
  }
}

let _db: TiffinDB | null = null;

export function getDB(): TiffinDB {
  if (typeof window === "undefined") {
    throw new Error("Tiffin DB is browser-only");
  }
  if (!_db) _db = new TiffinDB();
  return _db;
}

export function uid(prefix = ""): string {
  const r = Math.random().toString(36).slice(2, 10);
  const t = Date.now().toString(36);
  return `${prefix}${t}${r}`;
}
