import type { Budget, Transaction } from "./types";

export interface Period {
  start: string;
  end: string;
  label: string;
}

function isoOf(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function currentMonthPeriod(now = new Date()): Period {
  const y = now.getFullYear();
  const m = now.getMonth();
  const start = new Date(y, m, 1);
  const end = new Date(y, m + 1, 0);
  const label = start.toLocaleDateString("en-CA", {
    month: "long",
    year: "numeric",
  });
  return { start: isoOf(start), end: isoOf(end), label };
}

export function monthPeriodFromKey(key: string): Period {
  const [y, m] = key.split("-").map(Number);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 0);
  return {
    start: isoOf(start),
    end: isoOf(end),
    label: start.toLocaleDateString("en-CA", {
      month: "long",
      year: "numeric",
    }),
  };
}

export function currentBiweeklyPeriod(anchorIso: string, now = new Date()): Period {
  const anchor = new Date(anchorIso + "T00:00:00");
  const today = new Date(now.toISOString().slice(0, 10) + "T00:00:00");
  const dayMs = 86400000;
  const diff = Math.floor((today.getTime() - anchor.getTime()) / dayMs);
  const cycles = Math.floor(diff / 14);
  const start = new Date(anchor.getTime() + cycles * 14 * dayMs);
  const end = new Date(start.getTime() + 13 * dayMs);
  const startIso = isoOf(start);
  const endIso = isoOf(end);
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-CA", { month: "short", day: "numeric" });
  return { start: startIso, end: endIso, label: `${fmt(start)} – ${fmt(end)}` };
}

export function periodForBudget(b: Budget, now = new Date()): Period {
  if (b.period === "monthly") return currentMonthPeriod(now);
  return currentBiweeklyPeriod(b.anchorDate, now);
}

export function sumInRange(
  txs: Transaction[],
  start: string,
  end: string,
): number {
  return txs.reduce((acc, t) => {
    if (t.date >= start && t.date <= end) return acc + Math.max(0, t.amount);
    return acc;
  }, 0);
}
