import { getDB, uid } from "./db";
import type { Account, Category, Settings } from "./types";

const DEFAULT_CATEGORIES: Omit<Category, "id" | "createdAt">[] = [
  { name: "Groceries", icon: "🛒", color: "#10b981" },
  { name: "Food & Drink", icon: "🍽️", color: "#f59e0b" },
  { name: "Rent", icon: "🏠", color: "#6366f1" },
  { name: "Transport", icon: "🚇", color: "#3b82f6" },
  { name: "Travel", icon: "✈️", color: "#06b6d4" },
  { name: "Subscriptions", icon: "🔁", color: "#a855f7" },
  { name: "Health", icon: "💊", color: "#ef4444" },
  { name: "Shopping", icon: "🛍️", color: "#ec4899" },
  { name: "Fun", icon: "🎉", color: "#f43f5e" },
  { name: "Bills", icon: "🧾", color: "#64748b" },
  { name: "Other", icon: "✨", color: "#94a3b8" },
];

const DEFAULT_ACCOUNTS: Omit<Account, "id" | "createdAt">[] = [
  { name: "Cash", bank: "Cash", type: "cash", color: "#10b981" },
];

export const KNOWN_BANKS = [
  { name: "RBC", color: "#005DAA" },
  { name: "TD", color: "#1B7935" },
  { name: "Scotiabank", color: "#EC111A" },
  { name: "BMO", color: "#0079C1" },
  { name: "CIBC", color: "#C8102E" },
  { name: "Tangerine", color: "#FF6600" },
  { name: "Wealthsimple", color: "#000000" },
  { name: "Simplii", color: "#7A1F2A" },
  { name: "National Bank", color: "#E2231A" },
  { name: "EQ Bank", color: "#FF671F" },
  { name: "Neo Financial", color: "#16C172" },
  { name: "American Express", color: "#006FCF" },
  { name: "Capital One", color: "#003A70" },
  { name: "Other", color: "#64748b" },
];

export async function ensureSeed(): Promise<void> {
  const db = getDB();
  const settings = await db.settings.get("singleton");
  if (settings?.seeded) return;

  const now = Date.now();
  await db.transaction(
    "rw",
    db.categories,
    db.accounts,
    db.settings,
    async () => {
      const catCount = await db.categories.count();
      if (catCount === 0) {
        await db.categories.bulkAdd(
          DEFAULT_CATEGORIES.map((c) => ({
            ...c,
            id: uid("cat_"),
            createdAt: now,
          })),
        );
      }
      const acctCount = await db.accounts.count();
      if (acctCount === 0) {
        await db.accounts.bulkAdd(
          DEFAULT_ACCOUNTS.map((a) => ({
            ...a,
            id: uid("acc_"),
            createdAt: now,
          })),
        );
      }
      const next: Settings = {
        id: "singleton",
        theme: settings?.theme ?? "system",
        currency: "CAD",
        biweeklyAnchor: settings?.biweeklyAnchor,
        seeded: true,
      };
      await db.settings.put(next);
    },
  );
}
