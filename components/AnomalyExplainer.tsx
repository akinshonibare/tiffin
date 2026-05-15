"use client";

import { useEffect, useRef } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { AnomalyHit } from "@/lib/anomalies";
import type { Category, Transaction } from "@/lib/types";

export function AnomalyExplainer({
  anomalies,
  transactions,
  categories,
}: {
  anomalies: AnomalyHit[];
  transactions: Transaction[];
  categories: Category[];
}) {
  const explainAnomalies = useAction(api.ai.anomaly.explainAnomalies);
  const seenRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const unexplained = anomalies
      .map((a) => {
        const tx = transactions.find((t) => t.id === a.txId);
        if (!tx) return null;
        if (tx.anomalyText) return null;
        if (seenRef.current.has(a.txId)) return null;
        const cat = categories.find((c) => c.id === tx.categoryId);
        return {
          clientId: a.txId,
          merchant: tx.merchant ?? undefined,
          amount: a.amount,
          mean: a.mean,
          prior: a.prior,
          categoryName: cat?.name ?? undefined,
        };
      })
      .filter(Boolean) as {
      clientId: string;
      merchant?: string;
      amount: number;
      mean: number;
      prior: number;
      categoryName?: string;
    }[];
    if (unexplained.length === 0) return;
    unexplained.forEach((u) => seenRef.current.add(u.clientId));
    explainAnomalies({ items: unexplained }).catch(console.error);
  }, [anomalies, transactions, categories, explainAnomalies]);

  return null;
}
