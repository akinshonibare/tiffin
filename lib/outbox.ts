"use client";

import Dexie, { type EntityTable } from "dexie";

export type OutboxOp =
  | { kind: "upsert"; table: TableName; doc: unknown }
  | { kind: "remove"; table: TableName; clientId: string }
  | { kind: "patchSettings"; patch: unknown };

export type TableName =
  | "accounts"
  | "cards"
  | "categories"
  | "budgets"
  | "transactions"
  | "recurrences";

export interface OutboxEntry {
  id: string;
  userId: string;
  op: OutboxOp;
  attempts: number;
  createdAt: number;
}

class OutboxDB extends Dexie {
  outbox!: EntityTable<OutboxEntry, "id">;
  constructor() {
    super("tiffin-outbox");
    this.version(1).stores({
      outbox: "id, userId, createdAt",
    });
  }
}

let _db: OutboxDB | null = null;

function getOutbox(): OutboxDB {
  if (!_db) _db = new OutboxDB();
  return _db;
}

function newId(): string {
  return `ob_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export async function enqueue(userId: string, op: OutboxOp): Promise<void> {
  await getOutbox().outbox.add({
    id: newId(),
    userId,
    op,
    attempts: 0,
    createdAt: Date.now(),
  });
}

export async function listPending(userId: string): Promise<OutboxEntry[]> {
  return getOutbox()
    .outbox.where("userId")
    .equals(userId)
    .sortBy("createdAt");
}

export async function markDone(id: string): Promise<void> {
  await getOutbox().outbox.delete(id);
}

export async function markAttempt(id: string): Promise<void> {
  const row = await getOutbox().outbox.get(id);
  if (row) {
    await getOutbox().outbox.update(id, { attempts: row.attempts + 1 });
  }
}
