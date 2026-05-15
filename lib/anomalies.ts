import type { Transaction } from "./types";

const NINETY_DAYS = 90 * 24 * 60 * 60 * 1000;

export interface AnomalyHit {
  txId: string;
  amount: number;
  mean: number;
  prior: number;
  merchant?: string;
  categoryId?: string;
}

interface Group {
  key: string;
  prior: Transaction[];
  current: Transaction[];
}

function keyFor(t: Transaction): string | null {
  if (t.merchant) return `m:${t.merchant.toLowerCase()}`;
  if (t.categoryId) return `c:${t.categoryId}`;
  return null;
}

export function findAnomalies(
  transactions: Transaction[],
  now: Date = new Date(),
): AnomalyHit[] {
  const since = now.getTime() - NINETY_DAYS;
  const recent = transactions
    .filter((t) => !t.isRefund && t.amount > 0)
    .filter((t) => new Date(t.date).getTime() >= since);

  const groups = new Map<string, Group>();
  for (const t of recent) {
    const k = keyFor(t);
    if (!k) continue;
    const g = groups.get(k) ?? { key: k, prior: [], current: [] };
    g.current.push(t);
    groups.set(k, g);
  }

  const hits: AnomalyHit[] = [];
  for (const g of groups.values()) {
    const sorted = [...g.current].sort((a, b) => a.date.localeCompare(b.date));
    for (let i = 4; i < sorted.length; i++) {
      const tx = sorted[i];
      const prior = sorted.slice(0, i);
      const amounts = prior.map((p) => p.amount);
      const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
      const variance =
        amounts.reduce((a, b) => a + (b - mean) ** 2, 0) / amounts.length;
      const stddev = Math.sqrt(variance);
      if (
        tx.amount > mean + 2.5 * stddev &&
        tx.amount > 1.5 * mean &&
        mean > 0
      ) {
        hits.push({
          txId: tx.id,
          amount: tx.amount,
          mean,
          prior: amounts.length,
          merchant: tx.merchant,
          categoryId: tx.categoryId,
        });
      }
    }
  }
  return hits;
}

export function fallbackText(hit: AnomalyHit): string {
  const ratio = hit.mean > 0 ? hit.amount / hit.mean : 0;
  const ratioText =
    ratio >= 2 ? `~${ratio.toFixed(1)}× your usual` : "above your usual";
  return `$${hit.amount.toFixed(2)} ${hit.merchant ?? "expense"} — ${ratioText}.`;
}
