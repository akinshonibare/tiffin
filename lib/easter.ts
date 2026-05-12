import type { Transaction } from "./types";

export const TOAST_VARIANTS = [
  "Logged ✓",
  "Banked ✓",
  "Noted ✓",
  "Sealed ✓",
  "In the books ✓",
  "Cha-ching ✓",
  "Counted ✓",
  "Filed ✓",
  "On the ledger ✓",
];

export const EMPTY_HOME = [
  "A blank slate.",
  "Either you're new or you're suspicious.",
  "Nothing logged yet. Calm before the storm.",
  "Tap Add expense to begin. We won't judge.",
  "Quiet around here. Make it loud.",
];

export const EMPTY_ACTIVITY = [
  "Nothing logged for this month.",
  "Empty month. Frugal flex.",
  "Either nothing happened or you forgot. Both fine.",
  "The ledger is quiet.",
];

export const EMPTY_BUDGETS = [
  "No budgets yet. Tap Budget to set one per category.",
  "No caps set. Living free.",
  "Spend with intention — set a budget per category.",
];

export const EMPTY_CATEGORIES = [
  "You archived everything. Brave.",
  "A blank slate. Add a new category to begin.",
];

export const PULL_REFRESH_HINTS = [
  "you can let go now",
  "yes, you're refreshing",
  "still loading the same data",
  "this won't make more money appear",
];

export function pick<T>(arr: T[], seed?: number): T {
  const i =
    seed !== undefined
      ? Math.abs(seed) % arr.length
      : Math.floor(Math.random() * arr.length);
  return arr[i];
}

export function pickDeterministic<T>(arr: T[], key: string): T {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return arr[h % arr.length];
}

export function timeGreeting(now = new Date()): string {
  const h = now.getHours();
  if (h < 5) return "Late night";
  if (h < 12) return "Morning";
  if (h < 17) return "Afternoon";
  if (h < 21) return "Evening";
  return "Night";
}

export function isFirstOfMonth(now = new Date()): boolean {
  return now.getDate() === 1;
}

export function dejaVuIds(txs: Transaction[]): Set<string> {
  const byKey = new Map<string, string[]>();
  for (const t of txs) {
    const key = `${t.date}|${t.amount.toFixed(2)}`;
    const arr = byKey.get(key) ?? [];
    arr.push(t.id);
    byKey.set(key, arr);
  }
  const out = new Set<string>();
  for (const ids of byKey.values()) {
    if (ids.length >= 2) ids.forEach((id) => out.add(id));
  }
  return out;
}

export function noSpendStreak(txs: Transaction[], now = new Date()): number {
  if (txs.length === 0) return 0;
  const days = new Set(txs.map((t) => t.date));
  const firstDate = txs.reduce(
    (min, t) => (t.date < min ? t.date : min),
    txs[0].date,
  );
  let count = 0;
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  // start from yesterday so today's no-spend isn't counted prematurely
  d.setDate(d.getDate() - 1);
  while (count < 365) {
    const iso = d.toISOString().slice(0, 10);
    if (iso < firstDate) break;
    if (days.has(iso)) break;
    count++;
    d.setDate(d.getDate() - 1);
  }
  return count;
}

export interface AmountReaction {
  emoji: string;
  message: string;
}

export function amountReaction(amount: number): AmountReaction | null {
  const cents = Math.round(amount * 100);
  if (cents === 420) return { emoji: "🌿", message: "nice and green" };
  if (cents === 1337) return { emoji: "🎩", message: "elite" };
  if (cents === 6900) return { emoji: "😎", message: "nice" };
  if (cents === 1) return { emoji: "🪙", message: "every penny counts" };
  if (cents === 100000) return { emoji: "💸", message: "first grand" };
  return null;
}

export const MERCHANT_ICONS: { match: RegExp; icon: string }[] = [
  { match: /(tim hort|^tims\b|starbucks|blenz|second cup)/i, icon: "☕" },
  { match: /(uber|lyft)/i, icon: "🚕" },
  { match: /(presto|metrolinx|go transit|via rail|amtrak)/i, icon: "🚇" },
  { match: /(netflix|disney|prime video|crave|apple tv|hbo|paramount)/i, icon: "📺" },
  { match: /(spotify|apple music|tidal|youtube music|deezer)/i, icon: "🎵" },
  {
    match: /(loblaws|metro|sobeys|freshco|no frills|farm boy|whole foods|costco|walmart)/i,
    icon: "🛒",
  },
  { match: /(amazon|amzn)/i, icon: "📦" },
  { match: /(lcbo|beer store|liquor)/i, icon: "🍷" },
  { match: /(pizza|domino|papa john)/i, icon: "🍕" },
  { match: /(mcdonald|wendy|a&w|burger king|harvey)/i, icon: "🍔" },
  { match: /(shoppers|rexall|pharmaprix|pharmacy)/i, icon: "💊" },
  { match: /(ikea)/i, icon: "🪑" },
  { match: /(apple\.com|apple store|best buy|microsoft store)/i, icon: "💻" },
  { match: /(indigo|chapters|coles)/i, icon: "📚" },
  { match: /(air canada|westjet|porter|flair|swoop|delta|united)/i, icon: "✈️" },
  { match: /(esso|petro|shell|chevron|husky|gas)/i, icon: "⛽" },
  { match: /(cineplex|imax|amc|landmark)/i, icon: "🎬" },
  { match: /(gym|goodlife|fit4less|orangetheory|f45)/i, icon: "🏋️" },
];

export function iconForMerchant(merchant?: string): string | null {
  if (!merchant) return null;
  for (const entry of MERCHANT_ICONS) {
    if (entry.match.test(merchant)) return entry.icon;
  }
  return null;
}

export type BadgeId =
  | "first-expense"
  | "centurion"
  | "five-hundred"
  | "first-grand-tx"
  | "first-time-category"
  | "no-spend-3"
  | "no-spend-7"
  | "no-spend-14"
  | "budget-hero"
  | "under-month";

export interface BadgeDef {
  id: BadgeId;
  emoji: string;
  title: string;
  description: string;
  tier?: 1 | 2 | 3;
}

export const BADGES: Record<BadgeId, BadgeDef> = {
  "first-expense": {
    id: "first-expense",
    emoji: "🌱",
    title: "First Drop",
    description: "Logged your very first expense.",
    tier: 1,
  },
  centurion: {
    id: "centurion",
    emoji: "💯",
    title: "Centurion",
    description: "Logged 100 expenses.",
    tier: 2,
  },
  "five-hundred": {
    id: "five-hundred",
    emoji: "🏛️",
    title: "Quincentenarian",
    description: "Logged 500 expenses.",
    tier: 3,
  },
  "first-grand-tx": {
    id: "first-grand-tx",
    emoji: "💸",
    title: "First Grand",
    description: "Logged a single expense of $1,000+.",
    tier: 2,
  },
  "first-time-category": {
    id: "first-time-category",
    emoji: "🌿",
    title: "Trailblazer",
    description: "Used a brand-new category for the first time.",
    tier: 1,
  },
  "no-spend-3": {
    id: "no-spend-3",
    emoji: "🧘",
    title: "Quiet Streak",
    description: "3 days in a row with no spending.",
    tier: 1,
  },
  "no-spend-7": {
    id: "no-spend-7",
    emoji: "🌳",
    title: "Forest Mode",
    description: "7 days in a row with no spending.",
    tier: 2,
  },
  "no-spend-14": {
    id: "no-spend-14",
    emoji: "🗿",
    title: "Stoic",
    description: "14 days in a row with no spending.",
    tier: 3,
  },
  "budget-hero": {
    id: "budget-hero",
    emoji: "🦸",
    title: "Budget Hero",
    description: "Ended a month within every category budget.",
    tier: 2,
  },
  "under-month": {
    id: "under-month",
    emoji: "📉",
    title: "Trim Month",
    description: "Spent less than the previous month.",
    tier: 1,
  },
};

interface EarnedRecord {
  id: BadgeId;
  earnedAt: string;
  meta?: Record<string, string>;
}

const STORAGE_KEY = "tiffin.badges";

export function loadEarnedBadges(): EarnedRecord[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function hasEarned(id: BadgeId): boolean {
  return loadEarnedBadges().some((b) => b.id === id);
}

export function earnBadge(id: BadgeId, meta?: Record<string, string>): boolean {
  if (typeof window === "undefined") return false;
  const earned = loadEarnedBadges();
  if (earned.some((b) => b.id === id)) return false;
  earned.push({ id, earnedAt: new Date().toISOString(), meta });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(earned));
  return true;
}

export interface Records {
  biggestExpense?: Transaction;
  biggestDay?: { date: string; total: number };
  biggestMonth?: { key: string; total: number };
  longestNoSpend: number;
  topMerchant?: { name: string; total: number };
}

export function computeRecords(txs: Transaction[]): Records {
  let biggestExpense: Transaction | undefined;
  const byDay = new Map<string, number>();
  const byMonth = new Map<string, number>();
  const byMerchant = new Map<string, number>();
  for (const t of txs) {
    // Records reflect actual *expenses*; refunds don't compete for biggest.
    if (!t.isRefund) {
      if (!biggestExpense || t.amount > biggestExpense.amount)
        biggestExpense = t;
    }
    const signed = t.isRefund ? -t.amount : t.amount;
    byDay.set(t.date, (byDay.get(t.date) ?? 0) + signed);
    byMonth.set(
      t.date.slice(0, 7),
      (byMonth.get(t.date.slice(0, 7)) ?? 0) + signed,
    );
    if (t.merchant && !t.isRefund)
      byMerchant.set(t.merchant, (byMerchant.get(t.merchant) ?? 0) + t.amount);
  }
  const biggestDay = [...byDay.entries()]
    .map(([date, total]) => ({ date, total }))
    .sort((a, b) => b.total - a.total)[0];
  const biggestMonth = [...byMonth.entries()]
    .map(([key, total]) => ({ key, total }))
    .sort((a, b) => b.total - a.total)[0];
  const topMerchant = [...byMerchant.entries()]
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total)[0];

  let longestNoSpend = 0;
  if (txs.length > 0) {
    const dates = [...new Set(txs.map((t) => t.date))].sort();
    const start = new Date(dates[0]);
    const end = new Date();
    end.setHours(0, 0, 0, 0);
    const daySet = new Set(dates);
    let cur = 0;
    const d = new Date(start);
    while (d <= end) {
      const iso = d.toISOString().slice(0, 10);
      if (daySet.has(iso)) {
        cur = 0;
      } else {
        cur++;
        if (cur > longestNoSpend) longestNoSpend = cur;
      }
      d.setDate(d.getDate() + 1);
    }
  }

  return {
    biggestExpense,
    biggestDay,
    biggestMonth,
    longestNoSpend,
    topMerchant,
  };
}

const LAUNCH_KEY = "tiffin.firstLaunchOfDay";

/**
 * Audit existing transactions and silently earn any milestone badges the
 * user already qualifies for. Returns the list of badge ids newly earned
 * so the caller can show a single "X badge(s) earned" toast if it wants.
 */
export function auditMilestones(txs: Transaction[]): BadgeId[] {
  const newly: BadgeId[] = [];
  const total = txs.length;

  if (total >= 1 && earnBadge("first-expense")) newly.push("first-expense");
  if (total >= 100 && earnBadge("centurion")) newly.push("centurion");
  if (total >= 500 && earnBadge("five-hundred")) newly.push("five-hundred");

  if (txs.some((t) => t.amount >= 1000) && earnBadge("first-grand-tx"))
    newly.push("first-grand-tx");

  // Trailblazer: used more than one distinct category
  const cats = new Set(txs.map((t) => t.categoryId).filter(Boolean));
  if (cats.size >= 2 && earnBadge("first-time-category"))
    newly.push("first-time-category");

  return newly;
}

export function isFirstLaunchOfDay(now = new Date()): boolean {
  if (typeof window === "undefined") return false;
  const today = now.toISOString().slice(0, 10);
  const last = localStorage.getItem(LAUNCH_KEY);
  if (last === today) return false;
  localStorage.setItem(LAUNCH_KEY, today);
  return true;
}

const THEME_KEY = "tiffin.secretTheme";

export function getSecretTheme(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(THEME_KEY);
}

export function setSecretTheme(theme: string | null) {
  if (typeof window === "undefined") return;
  if (theme) localStorage.setItem(THEME_KEY, theme);
  else localStorage.removeItem(THEME_KEY);
  document.documentElement.dataset.secretTheme = theme ?? "";
}
