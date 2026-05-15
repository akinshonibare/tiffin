"use client";

import { useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { useConvex, useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { getDB, setActiveDB } from "@/lib/db";
import {
  drainOutbox,
  setActiveUserId,
  setCloudWriter,
  type CloudWriter,
} from "@/lib/repo";
import type {
  Account,
  Budget,
  Card,
  Category,
  Recurrence,
  Settings,
  Transaction,
} from "@/lib/types";

type CloudDoc<T> = T & { clientId: string; userId: string };

function stripCloud<T extends { clientId: string }>(doc: CloudDoc<T>): T {
  const { clientId, userId: _userId, _id, _creationTime, ...rest } = doc as any;
  void _userId;
  void _id;
  void _creationTime;
  return { ...rest, id: clientId } as T;
}

export function SyncEngine() {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const convex = useConvex();

  const cloudAccounts = useQuery(
    api.accounts.list,
    isSignedIn ? {} : "skip",
  ) as CloudDoc<Account>[] | undefined;
  const cloudCards = useQuery(
    api.cards.list,
    isSignedIn ? {} : "skip",
  ) as CloudDoc<Card>[] | undefined;
  const cloudCategories = useQuery(
    api.categories.list,
    isSignedIn ? {} : "skip",
  ) as CloudDoc<Category>[] | undefined;
  const cloudBudgets = useQuery(
    api.budgets.list,
    isSignedIn ? {} : "skip",
  ) as CloudDoc<Budget>[] | undefined;
  const cloudTransactions = useQuery(
    api.transactions.list,
    isSignedIn ? {} : "skip",
  ) as CloudDoc<Transaction>[] | undefined;
  const cloudRecurrences = useQuery(
    api.recurrences.list,
    isSignedIn ? {} : "skip",
  ) as CloudDoc<Recurrence>[] | undefined;
  const cloudSettings = useQuery(
    api.settings.get,
    isSignedIn ? {} : "skip",
  ) as
    | (Omit<Settings, "id"> & { userId: string })
    | null
    | undefined;

  const upsertAccount = useMutation(api.accounts.upsert);
  const removeAccount = useMutation(api.accounts.remove);
  const upsertCard = useMutation(api.cards.upsert);
  const removeCard = useMutation(api.cards.remove);
  const upsertCategory = useMutation(api.categories.upsert);
  const removeCategory = useMutation(api.categories.remove);
  const upsertBudget = useMutation(api.budgets.upsert);
  const removeBudget = useMutation(api.budgets.remove);
  const upsertTransaction = useMutation(api.transactions.upsert);
  const removeTransaction = useMutation(api.transactions.remove);
  const upsertRecurrence = useMutation(api.recurrences.upsert);
  const removeRecurrence = useMutation(api.recurrences.remove);
  const patchSettings = useMutation(api.settings.patch);

  // Switch active DB on auth state change
  useEffect(() => {
    if (!isLoaded) return;
    setActiveDB(isSignedIn && userId ? userId : null);
    setActiveUserId(isSignedIn && userId ? userId : null);
  }, [isLoaded, isSignedIn, userId]);

  // Drain queued offline writes whenever we come online or sign in
  useEffect(() => {
    if (!isSignedIn || !userId) return;
    const trigger = () => {
      drainOutbox().catch(console.error);
    };
    trigger();
    window.addEventListener("online", trigger);
    return () => window.removeEventListener("online", trigger);
  }, [isSignedIn, userId]);

  // Wire cloud writer
  useEffect(() => {
    if (!isSignedIn) {
      setCloudWriter(null);
      return;
    }
    const writer: CloudWriter = {
      upsertAccount: async (doc) => {
        await upsertAccount({
          clientId: doc.id,
          createdAt: doc.createdAt,
          name: doc.name,
          bank: doc.bank,
          type: doc.type,
          color: doc.color,
          last4: doc.last4,
          archived: doc.archived,
        });
      },
      removeAccount: async (clientId) => {
        await removeAccount({ clientId });
      },
      upsertCard: async (doc) => {
        await upsertCard({
          clientId: doc.id,
          createdAt: doc.createdAt,
          accountId: doc.accountId,
          nickname: doc.nickname,
          last4: doc.last4,
          color: doc.color,
          archived: doc.archived,
        });
      },
      removeCard: async (clientId) => {
        await removeCard({ clientId });
      },
      upsertCategory: async (doc) => {
        await upsertCategory({
          clientId: doc.id,
          createdAt: doc.createdAt,
          name: doc.name,
          icon: doc.icon,
          color: doc.color,
          archived: doc.archived,
        });
      },
      removeCategory: async (clientId) => {
        await removeCategory({ clientId });
      },
      upsertBudget: async (doc) => {
        await upsertBudget({
          clientId: doc.id,
          createdAt: doc.createdAt,
          categoryId: doc.categoryId,
          amount: doc.amount,
          period: doc.period,
          anchorDate: doc.anchorDate,
          rollover: doc.rollover,
        });
      },
      removeBudget: async (clientId) => {
        await removeBudget({ clientId });
      },
      upsertTransaction: async (doc) => {
        await upsertTransaction({
          clientId: doc.id,
          createdAt: doc.createdAt,
          amount: doc.amount,
          date: doc.date,
          accountId: doc.accountId,
          cardId: doc.cardId,
          categoryId: doc.categoryId,
          merchant: doc.merchant,
          note: doc.note,
          tags: doc.tags,
          isRefund: doc.isRefund,
          recurrenceId: doc.recurrenceId,
        });
      },
      removeTransaction: async (clientId) => {
        await removeTransaction({ clientId });
      },
      upsertRecurrence: async (doc) => {
        await upsertRecurrence({
          clientId: doc.id,
          createdAt: doc.createdAt,
          name: doc.name,
          amount: doc.amount,
          period: doc.period,
          nextDue: doc.nextDue,
          accountId: doc.accountId,
          cardId: doc.cardId,
          categoryId: doc.categoryId,
          merchant: doc.merchant,
          note: doc.note,
          tags: doc.tags,
          active: doc.active,
        });
      },
      removeRecurrence: async (clientId) => {
        await removeRecurrence({ clientId });
      },
      patchSettings: async (patch) => {
        await patchSettings({
          theme: patch.theme,
          currency: patch.currency,
          biweeklyAnchor: patch.biweeklyAnchor,
          overallMonthly: patch.overallMonthly,
          backupCadence: patch.backupCadence,
          lastExportAt: patch.lastExportAt,
        });
      },
    };
    setCloudWriter(writer);
    return () => setCloudWriter(null);
  }, [
    isSignedIn,
    upsertAccount,
    removeAccount,
    upsertCard,
    removeCard,
    upsertCategory,
    removeCategory,
    upsertBudget,
    removeBudget,
    upsertTransaction,
    removeTransaction,
    upsertRecurrence,
    removeRecurrence,
    patchSettings,
  ]);

  // Mirror cloud → Dexie
  useEffect(() => {
    if (!isSignedIn || !userId) return;
    void mirror("accounts", cloudAccounts);
    void mirror("cards", cloudCards);
    void mirror("categories", cloudCategories);
    void mirror("budgets", cloudBudgets);
    void mirror("transactions", cloudTransactions);
    void mirror("recurrences", cloudRecurrences);
  }, [
    isSignedIn,
    userId,
    cloudAccounts,
    cloudCards,
    cloudCategories,
    cloudBudgets,
    cloudTransactions,
    cloudRecurrences,
  ]);

  // Mirror settings
  useEffect(() => {
    if (!isSignedIn || cloudSettings === undefined) return;
    const db = getDB();
    if (cloudSettings === null) return;
    const next: Settings = {
      id: "singleton",
      theme: (cloudSettings.theme as Settings["theme"]) ?? "system",
      currency: "CAD",
      biweeklyAnchor: cloudSettings.biweeklyAnchor,
      overallMonthly: cloudSettings.overallMonthly,
      backupCadence:
        (cloudSettings.backupCadence as Settings["backupCadence"]) ?? undefined,
      lastExportAt: cloudSettings.lastExportAt,
      seeded: true,
    };
    db.settings.put(next).catch(console.error);
  }, [isSignedIn, cloudSettings]);

  // Mark convex client so other code can read it (e.g. settings export)
  useEffect(() => {
    (window as any).__convex = convex;
  }, [convex]);

  return null;
}

async function mirror<T extends { clientId: string }>(
  table:
    | "accounts"
    | "cards"
    | "categories"
    | "budgets"
    | "transactions"
    | "recurrences",
  cloud: CloudDoc<T>[] | undefined,
) {
  if (cloud === undefined) return;
  const db = getDB() as any;
  const mapped = cloud.map((d) => stripCloud(d));
  await db[table].clear();
  if (mapped.length > 0) await db[table].bulkPut(mapped);
}
