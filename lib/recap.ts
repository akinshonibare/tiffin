import type { Account, Category, Transaction } from "./types";

export type Tier = 0 | 1 | 2 | 3;

export const TIER_COLORS: Record<Tier, string> = {
  0: "#f5c542",
  1: "#62b265",
  2: "#5990d0",
  3: "#a26db3",
};

export interface RecapItem {
  id: string;
  amount: number;
  date: string;
  tier: Tier;
  categoryIcon: string;
  categoryName: string;
  merchant?: string;
}

export interface WeekGroup {
  tier: Tier;
  label: string;
  range: string;
  items: RecapItem[];
}

export interface RecapPuzzle {
  monthKey: string;
  monthLabel: string;
  weeks: WeekGroup[];
}

function previousMonthKey(now = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthRange(monthKey: string): { start: string; end: string } {
  const [y, m] = monthKey.split("-").map(Number);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 0);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { start: iso(start), end: iso(end) };
}

function weekTierForDay(day: number): Tier {
  if (day <= 7) return 0;
  if (day <= 14) return 1;
  if (day <= 21) return 2;
  return 3;
}

function weekLabel(tier: Tier, monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  const ranges: [number, number][] = [
    [1, 7],
    [8, 14],
    [15, 21],
    [22, new Date(y, m, 0).getDate()],
  ];
  const [s, e] = ranges[tier];
  const fmt = (day: number) =>
    new Date(y, m - 1, day).toLocaleDateString("en-CA", {
      month: "short",
      day: "numeric",
    });
  return `${fmt(s)} – ${fmt(e)}`;
}

export function buildRecap(
  monthKey: string,
  allTxs: Transaction[],
  categories: Category[],
  _accounts: Account[],
): RecapPuzzle | null {
  const { start, end } = monthRange(monthKey);
  const monthTxs = allTxs.filter((t) => t.date >= start && t.date <= end);
  if (monthTxs.length < 16) return null;

  const byTier: Record<Tier, Transaction[]> = { 0: [], 1: [], 2: [], 3: [] };
  for (const t of monthTxs) {
    const day = Number(t.date.slice(8, 10));
    byTier[weekTierForDay(day)].push(t);
  }

  if ([0, 1, 2, 3].some((t) => byTier[t as Tier].length < 4)) return null;

  const used = new Set<number>();
  const picks: Record<Tier, Transaction[]> = { 0: [], 1: [], 2: [], 3: [] };

  for (const t of [0, 1, 2, 3] as Tier[]) {
    const sorted = [...byTier[t]].sort((a, b) => b.amount - a.amount);
    const chosen: Transaction[] = [];
    for (const tx of sorted) {
      if (chosen.length === 4) break;
      if (!used.has(tx.amount)) {
        chosen.push(tx);
        used.add(tx.amount);
      }
    }
    if (chosen.length < 4) return null;
    picks[t] = chosen;
  }

  const [y, m] = monthKey.split("-").map(Number);
  const monthLabel = new Date(y, m - 1, 1).toLocaleDateString("en-CA", {
    month: "long",
    year: "numeric",
  });

  const weeks: WeekGroup[] = ([0, 1, 2, 3] as Tier[]).map((t) => ({
    tier: t,
    label: `Week ${t + 1}`,
    range: weekLabel(t, monthKey),
    items: picks[t].map<RecapItem>((tx) => {
      const cat = categories.find((c) => c.id === tx.categoryId);
      return {
        id: tx.id,
        amount: tx.amount,
        date: tx.date,
        tier: t,
        categoryIcon: cat?.icon ?? "✨",
        categoryName: cat?.name ?? "Other",
        merchant: tx.merchant,
      };
    }),
  }));

  return { monthKey, monthLabel, weeks };
}

export function getCurrentRecapKey(now = new Date()): string {
  return previousMonthKey(now);
}

// Returns up to `count` monthKeys, walking backwards from the previous
// calendar month. e.g. listMonthKeysBack(june, 3) → ["2026-05","2026-04","2026-03"].
export function listMonthKeysBack(now: Date, count: number): string[] {
  const keys: string[] = [];
  for (let i = 1; i <= count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
    );
  }
  return keys;
}

const MONTH_KEY_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
export function isValidMonthKey(key: string): boolean {
  return MONTH_KEY_RE.test(key);
}

export function demoRecap(): RecapPuzzle {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const monthLabel = d.toLocaleDateString("en-CA", {
    month: "long",
    year: "numeric",
  });
  const make = (
    tier: Tier,
    day: number,
    amount: number,
    icon: string,
    name: string,
    merchant?: string,
  ): RecapItem => ({
    id: `${tier}-${day}-${amount}`,
    amount,
    date: `${monthKey}-${String(day).padStart(2, "0")}`,
    tier,
    categoryIcon: icon,
    categoryName: name,
    merchant,
  });
  const weeks: WeekGroup[] = [
    {
      tier: 0,
      label: "Week 1",
      range: weekLabel(0, monthKey),
      items: [
        make(0, 2, 84.5, "🛒", "Groceries", "Loblaws"),
        make(0, 3, 5.75, "☕", "Food & Drink", "Tims"),
        make(0, 5, 32.1, "🚇", "Transport", "Presto"),
        make(0, 7, 18.4, "🍽️", "Food & Drink", "Sushi"),
      ],
    },
    {
      tier: 1,
      label: "Week 2",
      range: weekLabel(1, monthKey),
      items: [
        make(1, 9, 1450, "🏠", "Rent", "Landlord"),
        make(1, 10, 67.8, "🛍️", "Shopping", "Uniqlo"),
        make(1, 12, 14.99, "🔁", "Subscriptions", "Spotify"),
        make(1, 14, 42.6, "💪", "Health", "Pharmacy"),
      ],
    },
    {
      tier: 2,
      label: "Week 3",
      range: weekLabel(2, monthKey),
      items: [
        make(2, 16, 9.5, "🍕", "Food & Drink", "Pizza"),
        make(2, 18, 220, "✈️", "Travel", "Via Rail"),
        make(2, 20, 73.2, "🛒", "Groceries", "Metro"),
        make(2, 21, 28, "🎬", "Fun", "Cineplex"),
      ],
    },
    {
      tier: 3,
      label: "Week 4",
      range: weekLabel(3, monthKey),
      items: [
        make(3, 23, 56.4, "🍷", "Food & Drink", "LCBO"),
        make(3, 25, 11.25, "📚", "Other", "Indigo"),
        make(3, 27, 38.9, "🛒", "Groceries", "FreshCo"),
        make(3, 29, 99, "🎉", "Fun", "Concert"),
      ],
    },
  ];
  return { monthKey, monthLabel, weeks };
}
