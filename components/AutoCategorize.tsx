"use client";

import { useEffect } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";

export function AutoCategorize({
  merchant,
  note,
  amount,
  onSuggest,
  onLoadingChange,
}: {
  merchant: string;
  note: string;
  amount: number;
  onSuggest: (categoryId: string) => void;
  onLoadingChange: (loading: boolean) => void;
}) {
  const suggestCategory = useAction(api.ai.categorize.suggestCategory);

  useEffect(() => {
    const m = merchant.trim();
    const n = note.trim();
    if (m.length < 3 && n.length < 3) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      onLoadingChange(true);
      try {
        const result = await suggestCategory({
          merchant: m || undefined,
          note: n || undefined,
          amount: amount > 0 ? amount : undefined,
        });
        if (cancelled) return;
        if (result?.categoryId) onSuggest(result.categoryId);
      } catch (err) {
        console.warn("auto-categorize failed", err);
      } finally {
        if (!cancelled) onLoadingChange(false);
      }
    }, 600);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [merchant, note]);

  return null;
}
