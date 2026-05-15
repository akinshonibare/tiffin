"use client";

import { getDB } from "./db";
import type {
  Account,
  Budget,
  Card,
  Category,
  Recurrence,
  Settings,
  Transaction,
} from "./types";
import { isClerkConfigured, isConvexConfigured } from "./convex";
import {
  enqueue,
  listPending,
  markAttempt,
  markDone,
  type OutboxOp,
  type TableName,
} from "./outbox";

let _cloudWriter: CloudWriter | null = null;
let _activeUserId: string | null = null;

export interface CloudWriter {
  upsertAccount(doc: Account): Promise<void>;
  removeAccount(clientId: string): Promise<void>;
  upsertCard(doc: Card): Promise<void>;
  removeCard(clientId: string): Promise<void>;
  upsertCategory(doc: Category): Promise<void>;
  removeCategory(clientId: string): Promise<void>;
  upsertBudget(doc: Budget): Promise<void>;
  removeBudget(clientId: string): Promise<void>;
  upsertTransaction(doc: Transaction): Promise<void>;
  removeTransaction(clientId: string): Promise<void>;
  upsertRecurrence(doc: Recurrence): Promise<void>;
  removeRecurrence(clientId: string): Promise<void>;
  patchSettings(patch: Partial<Settings>): Promise<void>;
}

export function setCloudWriter(writer: CloudWriter | null) {
  _cloudWriter = writer;
}

export function setActiveUserId(id: string | null) {
  _activeUserId = id;
}

function cloudActive(): boolean {
  return Boolean(_cloudWriter) && isClerkConfigured() && isConvexConfigured();
}

async function localPut<T extends { id: string }>(
  table: TableName,
  doc: T,
) {
  const db = getDB() as unknown as Record<
    string,
    { put: (d: T) => Promise<unknown> }
  >;
  await db[table].put(doc);
}

async function localDelete(table: TableName, id: string) {
  const db = getDB() as unknown as Record<
    string,
    { delete: (id: string) => Promise<unknown> }
  >;
  await db[table].delete(id);
}

async function tryCloud(op: OutboxOp, call: () => Promise<void>) {
  if (!cloudActive()) return;
  try {
    await call();
  } catch (err) {
    console.warn("cloud write failed, queuing for retry", err);
    if (_activeUserId) {
      await enqueue(_activeUserId, op).catch(console.error);
    }
  }
}

async function replay(op: OutboxOp): Promise<void> {
  if (!_cloudWriter) throw new Error("no cloud writer");
  if (op.kind === "upsert") {
    switch (op.table) {
      case "accounts":
        return _cloudWriter.upsertAccount(op.doc as Account);
      case "cards":
        return _cloudWriter.upsertCard(op.doc as Card);
      case "categories":
        return _cloudWriter.upsertCategory(op.doc as Category);
      case "budgets":
        return _cloudWriter.upsertBudget(op.doc as Budget);
      case "transactions":
        return _cloudWriter.upsertTransaction(op.doc as Transaction);
      case "recurrences":
        return _cloudWriter.upsertRecurrence(op.doc as Recurrence);
    }
  } else if (op.kind === "remove") {
    switch (op.table) {
      case "accounts":
        return _cloudWriter.removeAccount(op.clientId);
      case "cards":
        return _cloudWriter.removeCard(op.clientId);
      case "categories":
        return _cloudWriter.removeCategory(op.clientId);
      case "budgets":
        return _cloudWriter.removeBudget(op.clientId);
      case "transactions":
        return _cloudWriter.removeTransaction(op.clientId);
      case "recurrences":
        return _cloudWriter.removeRecurrence(op.clientId);
    }
  } else if (op.kind === "patchSettings") {
    return _cloudWriter.patchSettings(op.patch as Partial<Settings>);
  }
}

let _draining = false;

export async function drainOutbox(): Promise<void> {
  if (_draining) return;
  if (!cloudActive() || !_activeUserId) return;
  _draining = true;
  try {
    const pending = await listPending(_activeUserId);
    for (const entry of pending) {
      try {
        await replay(entry.op);
        await markDone(entry.id);
      } catch (err) {
        console.warn("outbox replay failed", err);
        await markAttempt(entry.id);
        return; // stop on first failure; try again on next online event
      }
    }
  } finally {
    _draining = false;
  }
}

export const repo = {
  accounts: {
    async put(doc: Account) {
      await localPut("accounts", doc);
      await tryCloud({ kind: "upsert", table: "accounts", doc }, () =>
        _cloudWriter!.upsertAccount(doc),
      );
    },
    async delete(id: string) {
      await localDelete("accounts", id);
      await tryCloud(
        { kind: "remove", table: "accounts", clientId: id },
        () => _cloudWriter!.removeAccount(id),
      );
    },
    async update(id: string, patch: Partial<Account>) {
      const current = await getDB().accounts.get(id);
      if (!current) return;
      const next = { ...current, ...patch };
      await localPut("accounts", next);
      await tryCloud(
        { kind: "upsert", table: "accounts", doc: next },
        () => _cloudWriter!.upsertAccount(next),
      );
    },
  },
  cards: {
    async put(doc: Card) {
      await localPut("cards", doc);
      await tryCloud({ kind: "upsert", table: "cards", doc }, () =>
        _cloudWriter!.upsertCard(doc),
      );
    },
    async delete(id: string) {
      await localDelete("cards", id);
      await tryCloud(
        { kind: "remove", table: "cards", clientId: id },
        () => _cloudWriter!.removeCard(id),
      );
    },
    async update(id: string, patch: Partial<Card>) {
      const current = await getDB().cards.get(id);
      if (!current) return;
      const next = { ...current, ...patch };
      await localPut("cards", next);
      await tryCloud({ kind: "upsert", table: "cards", doc: next }, () =>
        _cloudWriter!.upsertCard(next),
      );
    },
  },
  categories: {
    async put(doc: Category) {
      await localPut("categories", doc);
      await tryCloud({ kind: "upsert", table: "categories", doc }, () =>
        _cloudWriter!.upsertCategory(doc),
      );
    },
    async delete(id: string) {
      await localDelete("categories", id);
      await tryCloud(
        { kind: "remove", table: "categories", clientId: id },
        () => _cloudWriter!.removeCategory(id),
      );
    },
    async update(id: string, patch: Partial<Category>) {
      const current = await getDB().categories.get(id);
      if (!current) return;
      const next = { ...current, ...patch };
      await localPut("categories", next);
      await tryCloud(
        { kind: "upsert", table: "categories", doc: next },
        () => _cloudWriter!.upsertCategory(next),
      );
    },
  },
  budgets: {
    async put(doc: Budget) {
      await localPut("budgets", doc);
      await tryCloud({ kind: "upsert", table: "budgets", doc }, () =>
        _cloudWriter!.upsertBudget(doc),
      );
    },
    async delete(id: string) {
      await localDelete("budgets", id);
      await tryCloud(
        { kind: "remove", table: "budgets", clientId: id },
        () => _cloudWriter!.removeBudget(id),
      );
    },
    async update(id: string, patch: Partial<Budget>) {
      const current = await getDB().budgets.get(id);
      if (!current) return;
      const next = { ...current, ...patch };
      await localPut("budgets", next);
      await tryCloud(
        { kind: "upsert", table: "budgets", doc: next },
        () => _cloudWriter!.upsertBudget(next),
      );
    },
  },
  transactions: {
    async put(doc: Transaction) {
      await localPut("transactions", doc);
      await tryCloud({ kind: "upsert", table: "transactions", doc }, () =>
        _cloudWriter!.upsertTransaction(doc),
      );
    },
    async delete(id: string) {
      await localDelete("transactions", id);
      await tryCloud(
        { kind: "remove", table: "transactions", clientId: id },
        () => _cloudWriter!.removeTransaction(id),
      );
    },
    async update(id: string, patch: Partial<Transaction>) {
      const current = await getDB().transactions.get(id);
      if (!current) return;
      const next = { ...current, ...patch };
      await localPut("transactions", next);
      await tryCloud(
        { kind: "upsert", table: "transactions", doc: next },
        () => _cloudWriter!.upsertTransaction(next),
      );
    },
  },
  recurrences: {
    async put(doc: Recurrence) {
      await localPut("recurrences", doc);
      await tryCloud({ kind: "upsert", table: "recurrences", doc }, () =>
        _cloudWriter!.upsertRecurrence(doc),
      );
    },
    async delete(id: string) {
      await localDelete("recurrences", id);
      await tryCloud(
        { kind: "remove", table: "recurrences", clientId: id },
        () => _cloudWriter!.removeRecurrence(id),
      );
    },
    async update(id: string, patch: Partial<Recurrence>) {
      const current = await getDB().recurrences.get(id);
      if (!current) return;
      const next = { ...current, ...patch };
      await localPut("recurrences", next);
      await tryCloud(
        { kind: "upsert", table: "recurrences", doc: next },
        () => _cloudWriter!.upsertRecurrence(next),
      );
    },
  },
  settings: {
    async update(patch: Partial<Settings>) {
      const db = getDB();
      const current = await db.settings.get("singleton");
      const next: Settings = {
        id: "singleton",
        theme: "system",
        currency: "CAD",
        ...current,
        ...patch,
      };
      await db.settings.put(next);
      await tryCloud({ kind: "patchSettings", patch }, () =>
        _cloudWriter!.patchSettings(patch),
      );
    },
  },
};
