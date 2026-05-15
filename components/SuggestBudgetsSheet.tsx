"use client";

import { useEffect, useState } from "react";
import { useAction } from "convex/react";
import { useAuthState } from "@/lib/auth";
import { useLiveQuery } from "dexie-react-hooks";
import { api } from "@/convex/_generated/api";
import { Sheet } from "./Sheet";
import { showToast } from "./Toast";
import { getDB, uid } from "@/lib/db";
import { repo } from "@/lib/repo";
import { money } from "@/lib/format";
import { isClerkConfigured } from "@/lib/convex";
import type { Budget } from "@/lib/types";

interface Suggestion {
  categoryId: string;
  suggested: number;
  rationale: string;
}

export function SuggestBudgetsSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  if (!isClerkConfigured()) return null;
  return <Inner open={open} onClose={onClose} />;
}

function Inner({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { isSignedIn } = useAuthState();
  const suggest = useAction(api.ai.suggestBudgets.suggestBudgets);
  const categories = useLiveQuery(() => getDB().categories.toArray(), []);
  const budgets = useLiveQuery(() => getDB().budgets.toArray(), []);

  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    if (!open || !isSignedIn) return;
    setLoading(true);
    setSuggestions(null);
    suggest({})
      .then((result: Suggestion[]) => {
        setSuggestions(result);
        setSelected(new Set(result.map((s) => s.categoryId)));
      })
      .catch((err) => {
        console.error(err);
        showToast("Couldn't generate suggestions", { emoji: "⚠️" });
      })
      .finally(() => setLoading(false));
  }, [open, isSignedIn, suggest]);

  async function applySelected() {
    if (!suggestions) return;
    setApplying(true);
    try {
      const now = Date.now();
      for (const s of suggestions) {
        if (!selected.has(s.categoryId)) continue;
        const existing = (budgets ?? []).find(
          (b) => b.categoryId === s.categoryId,
        );
        if (existing) {
          await repo.budgets.update(existing.id, { amount: s.suggested });
        } else {
          const next: Budget = {
            id: uid("bgt_"),
            categoryId: s.categoryId,
            amount: s.suggested,
            period: "monthly",
            anchorDate: new Date().toISOString().slice(0, 10),
            createdAt: now,
          };
          await repo.budgets.put(next);
        }
      }
      showToast("Budgets applied", { emoji: "🎯" });
      onClose();
    } finally {
      setApplying(false);
    }
  }

  if (!isSignedIn) return null;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Suggested budgets"
      footer={
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-full border border-[var(--color-line)] py-3 text-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={applying || !suggestions || selected.size === 0}
            onClick={applySelected}
            className="flex-1 rounded-full bg-[var(--color-ink)] py-3 text-sm font-medium text-[var(--color-bg)] disabled:opacity-40"
          >
            {applying
              ? "Applying…"
              : `Apply ${selected.size} ${selected.size === 1 ? "budget" : "budgets"}`}
          </button>
        </div>
      }
    >
      {loading && (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-[18px] bg-[var(--color-surface-2)]"
            />
          ))}
        </div>
      )}

      {!loading && suggestions && suggestions.length === 0 && (
        <div className="rounded-[18px] bg-[var(--color-surface-2)] p-4 text-sm text-[var(--color-ink-3)]">
          Not enough spending history yet — log a few weeks of expenses and try
          again.
        </div>
      )}

      {!loading && suggestions && suggestions.length > 0 && (
        <div className="space-y-2">
          <p className="mb-2 text-xs text-[var(--color-ink-3)]">
            Based on your last 3 months. Toggle which to apply, then confirm.
          </p>
          {suggestions.map((s) => {
            const cat = categories?.find((c) => c.id === s.categoryId);
            const existing = (budgets ?? []).find(
              (b) => b.categoryId === s.categoryId,
            );
            const checked = selected.has(s.categoryId);
            return (
              <label
                key={s.categoryId}
                className="flex cursor-pointer items-center gap-3 rounded-[18px] bg-[var(--color-surface-2)] p-3"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() =>
                    setSelected((prev) => {
                      const next = new Set(prev);
                      if (next.has(s.categoryId)) next.delete(s.categoryId);
                      else next.add(s.categoryId);
                      return next;
                    })
                  }
                  className="size-4 accent-[var(--color-ink)]"
                />
                <span className="text-lg">{cat?.icon ?? "✨"}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="truncate text-sm font-medium">
                      {cat?.name ?? s.categoryId}
                    </div>
                    <div className="ml-auto font-display tabular text-base">
                      {money(s.suggested)}
                    </div>
                  </div>
                  <div className="mt-0.5 text-xs text-[var(--color-ink-3)]">
                    {existing ? `was ${money(existing.amount)} · ` : ""}
                    {s.rationale}
                  </div>
                </div>
              </label>
            );
          })}
        </div>
      )}
    </Sheet>
  );
}
