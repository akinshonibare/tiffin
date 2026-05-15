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

const LEGACY_DB_NAME = "tiffin";

export class TiffinDB extends Dexie {
  accounts!: EntityTable<Account, "id">;
  cards!: EntityTable<Card, "id">;
  categories!: EntityTable<Category, "id">;
  budgets!: EntityTable<Budget, "id">;
  transactions!: EntityTable<Transaction, "id">;
  recurrences!: EntityTable<Recurrence, "id">;
  settings!: EntityTable<Settings, "id">;

  constructor(name: string) {
    super(name);
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

const _cache = new Map<string, TiffinDB>();
let _activeKey: string = LEGACY_DB_NAME;

function dbNameForKey(key: string): string {
  if (key === LEGACY_DB_NAME) return LEGACY_DB_NAME;
  return `tiffin-${key}`;
}

export function setActiveDB(userId: string | null) {
  _activeKey = userId ? userId : LEGACY_DB_NAME;
}

export function getActiveKey(): string {
  return _activeKey;
}

export function getDB(): TiffinDB {
  if (typeof window === "undefined") {
    throw new Error("Tiffin DB is browser-only");
  }
  const name = dbNameForKey(_activeKey);
  let db = _cache.get(name);
  if (!db) {
    db = new TiffinDB(name);
    _cache.set(name, db);
  }
  return db;
}

export function getLegacyDB(): TiffinDB {
  if (typeof window === "undefined") {
    throw new Error("Tiffin DB is browser-only");
  }
  let db = _cache.get(LEGACY_DB_NAME);
  if (!db) {
    db = new TiffinDB(LEGACY_DB_NAME);
    _cache.set(LEGACY_DB_NAME, db);
  }
  return db;
}

export async function wipeUserDB(userId: string): Promise<void> {
  const name = dbNameForKey(userId);
  const cached = _cache.get(name);
  if (cached) {
    await cached.delete();
    _cache.delete(name);
  } else {
    await Dexie.delete(name);
  }
}

export function uid(prefix = ""): string {
  const r = Math.random().toString(36).slice(2, 10);
  const t = Date.now().toString(36);
  return `${prefix}${t}${r}`;
}
