"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, Shuffle, Share2, RotateCcw, Sparkles } from "lucide-react";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { getDB } from "@/lib/db";
import { cn } from "@/lib/utils";
import { money } from "@/lib/format";
import {
  buildRecap,
  demoRecap,
  getCurrentRecapKey,
  TIER_COLORS,
  type RecapItem,
  type RecapPuzzle,
  type Tier,
  type WeekGroup,
} from "@/lib/recap";

const MAX_MISTAKES = 4;

interface SavedState {
  monthKey: string;
  solvedTiers: Tier[];
  guesses: { tiers: Tier[]; correct: boolean }[];
  mistakes: number;
  done: boolean;
  won: boolean;
  order: string[];
}

function fresh(puzzle: RecapPuzzle): SavedState {
  const all = puzzle.weeks.flatMap((w) => w.items.map((i) => i.id));
  return {
    monthKey: puzzle.monthKey,
    solvedTiers: [],
    guesses: [],
    mistakes: 0,
    done: false,
    won: false,
    order: shuffleStable(all, puzzle.monthKey),
  };
}

function shuffleStable(arr: string[], seedStr: string): string[] {
  let seed = 0;
  for (let i = 0; i < seedStr.length; i++)
    seed = (seed * 31 + seedStr.charCodeAt(i)) >>> 0;
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const j = seed % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function loadState(puzzle: RecapPuzzle, storageKey: string): SavedState {
  if (typeof window === "undefined") return fresh(puzzle);
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return fresh(puzzle);
    const parsed = JSON.parse(raw) as SavedState;
    if (parsed.monthKey !== puzzle.monthKey) return fresh(puzzle);
    return parsed;
  } catch {
    return fresh(puzzle);
  }
}

export default function RecapPage() {
  return (
    <Suspense fallback={<PageHeader title="Recap" />}>
      <RecapInner />
    </Suspense>
  );
}

function RecapInner() {
  const search = useSearchParams();
  const isDemo = search.get("demo") === "1";

  const txs = useLiveQuery(() => getDB().transactions.toArray(), []);
  const categories = useLiveQuery(() => getDB().categories.toArray(), []);
  const accounts = useLiveQuery(() => getDB().accounts.toArray(), []);

  const puzzle = useMemo<RecapPuzzle | null>(() => {
    if (isDemo) return demoRecap();
    if (!txs || !categories || !accounts) return null;
    const key = getCurrentRecapKey();
    return buildRecap(key, txs, categories, accounts);
  }, [isDemo, txs, categories, accounts]);

  if (!txs || !categories || !accounts) {
    return (
      <div>
        <PageHeader title="Recap" />
      </div>
    );
  }

  if (!puzzle) {
    return <NotReady />;
  }

  return <RecapGame puzzle={puzzle} isDemo={isDemo} />;
}

function NotReady() {
  return (
    <div>
      <PageHeader
        eyebrow={
          <Link
            href="/"
            className="inline-flex items-center gap-1 hover:underline"
          >
            <ChevronLeft className="size-3" /> Home
          </Link>
        }
        title="Recap"
      />
      <section className="px-5">
        <div className="rounded-[22px] bg-[var(--color-surface)] p-6 text-center">
          <Sparkles className="mx-auto mb-3 size-6 text-[var(--color-ink-3)]" />
          <div className="font-display text-xl">Not enough yet</div>
          <p className="mt-2 text-sm text-[var(--color-ink-3)]">
            The Recap unlocks when last month had at least 16 expenses, 4 per
            week, each at a distinct amount.
          </p>
          <Link
            href="/play/recap?demo=1"
            className="mt-5 inline-block rounded-full bg-[var(--color-ink)] px-4 py-2 text-sm font-medium text-[var(--color-bg)]"
          >
            Try a demo round
          </Link>
        </div>
      </section>
    </div>
  );
}

function RecapGame({
  puzzle,
  isDemo,
}: {
  puzzle: RecapPuzzle;
  isDemo: boolean;
}) {
  const storageKey = isDemo
    ? "tiffin.recap.demo"
    : `tiffin.recap.${puzzle.monthKey}`;
  const [state, setState] = useState<SavedState>(() =>
    loadState(puzzle, storageKey),
  );
  const [selected, setSelected] = useState<string[]>([]);
  const [shake, setShake] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {}
  }, [state, storageKey]);

  const itemMap = useMemo(() => {
    const m = new Map<string, RecapItem>();
    puzzle.weeks.forEach((w) => w.items.forEach((it) => m.set(it.id, it)));
    return m;
  }, [puzzle]);

  const itemTier = useCallback(
    (id: string): Tier => itemMap.get(id)?.tier ?? 0,
    [itemMap],
  );

  const solvedGroups: WeekGroup[] = useMemo(
    () =>
      state.solvedTiers
        .map((t) => puzzle.weeks.find((w) => w.tier === t)!)
        .filter(Boolean),
    [state.solvedTiers, puzzle.weeks],
  );
  const solvedIds = useMemo(
    () => new Set(solvedGroups.flatMap((g) => g.items.map((i) => i.id))),
    [solvedGroups],
  );
  const remaining = useMemo(
    () => state.order.filter((id) => !solvedIds.has(id)),
    [state.order, solvedIds],
  );

  const showToast = useCallback((msg: string, ms = 1400) => {
    setToast(msg);
    setTimeout(() => setToast(null), ms);
  }, []);

  function toggle(id: string) {
    if (state.done || busy) return;
    if (solvedIds.has(id)) return;
    setSelected((cur) => {
      if (cur.includes(id)) return cur.filter((x) => x !== id);
      if (cur.length >= 4) return cur;
      return [...cur, id];
    });
  }

  function shuffle() {
    if (state.done) return;
    setState((s) => ({
      ...s,
      order: [...s.order].sort(() => Math.random() - 0.5),
    }));
  }

  function deselect() {
    setSelected([]);
  }

  function submit() {
    if (selected.length !== 4 || state.done || busy) return;
    setBusy(true);
    const tiers = selected.map(itemTier);
    const allSame = tiers.every((t) => t === tiers[0]);

    if (allSame) {
      const tier = tiers[0];
      const group = puzzle.weeks.find((w) => w.tier === tier)!;
      const remainingAfter = state.order.filter(
        (id) =>
          !solvedIds.has(id) && !group.items.some((it) => it.id === id),
      );
      const newOrder = [
        ...solvedGroups.flatMap((g) => g.items.map((i) => i.id)),
        ...group.items.map((i) => i.id),
        ...remainingAfter,
      ];
      const nextSolvedTiers = [...state.solvedTiers, tier];
      const won = nextSolvedTiers.length === 4;
      setState((s) => ({
        ...s,
        solvedTiers: nextSolvedTiers,
        guesses: [...s.guesses, { tiers, correct: true }],
        order: newOrder,
        done: won,
        won,
      }));
      setSelected([]);
      if (won) showToast("Solved the month ✨", 1800);
      setTimeout(() => setBusy(false), 400);
      return;
    }

    const counts = new Map<Tier, number>();
    tiers.forEach((t) => counts.set(t, (counts.get(t) ?? 0) + 1));
    const hasThree = [...counts.values()].some((c) => c === 3);
    setShake(true);
    setTimeout(() => setShake(false), 400);
    showToast(hasThree ? "One away…" : "Not quite", 1300);

    const nextMistakes = state.mistakes + 1;
    const out = nextMistakes >= MAX_MISTAKES;
    let nextSolvedTiers = state.solvedTiers;
    let order = state.order;
    if (out) {
      nextSolvedTiers = [0, 1, 2, 3];
      order = [...puzzle.weeks]
        .sort((a, b) => a.tier - b.tier)
        .flatMap((w) => w.items.map((i) => i.id));
    }
    setState((s) => ({
      ...s,
      guesses: [...s.guesses, { tiers, correct: false }],
      mistakes: nextMistakes,
      solvedTiers: nextSolvedTiers,
      order,
      done: out,
      won: false,
    }));
    setSelected([]);
    setTimeout(() => setBusy(false), 400);
  }

  function reset() {
    setState(fresh(puzzle));
    setSelected([]);
  }

  async function share() {
    const grid = state.guesses
      .map((g) =>
        g.tiers.map((t) => ["🟨", "🟩", "🟦", "🟪"][t]).join(""),
      )
      .join("\n");
    const score = state.won
      ? `${MAX_MISTAKES - state.mistakes}/${MAX_MISTAKES} mistakes spared`
      : "Bested by my own month";
    const txt = `Tiffin Recap · ${puzzle.monthLabel}\n${score}\n\n${grid}`;
    try {
      await navigator.clipboard.writeText(txt);
      showToast("Copied to clipboard", 1500);
    } catch {
      showToast("Couldn't copy", 1500);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow={
          <Link
            href="/"
            className="inline-flex items-center gap-1 hover:underline"
          >
            <ChevronLeft className="size-3" /> Home
          </Link>
        }
        title={`${puzzle.monthLabel} Recap`}
        right={
          state.done ? (
            <button
              type="button"
              onClick={share}
              className="flex items-center gap-1 rounded-full bg-[var(--color-ink)] px-3 py-1.5 text-xs text-[var(--color-bg)]"
            >
              <Share2 className="size-3.5" /> Share
            </button>
          ) : (
            <span className="text-[11px] uppercase tracking-wider text-[var(--color-ink-3)]">
              4×4 · which week?
            </span>
          )
        }
      />

      <section className="px-5">
        <div className="mb-4 text-center text-xs text-[var(--color-ink-3)]">
          Group the 16 expenses by the week they happened in.
        </div>

        <div className="space-y-1.5">
          <AnimatePresence>
            {solvedGroups.map((g) => (
              <SolvedBar key={g.tier} group={g} />
            ))}
          </AnimatePresence>
        </div>

        <motion.div
          animate={shake ? { x: [0, -8, 8, -6, 6, 0] } : { x: 0 }}
          transition={{ duration: 0.4 }}
          className={cn(
            "mt-2 grid grid-cols-4 gap-1.5",
            solvedGroups.length === 4 && "hidden",
          )}
        >
          {remaining.map((id) => {
            const item = itemMap.get(id)!;
            const isSel = selected.includes(id);
            return (
              <motion.button
                key={id}
                type="button"
                layout
                onClick={() => toggle(id)}
                animate={{ scale: isSel ? 0.96 : 1 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                className={cn(
                  "flex aspect-square flex-col items-center justify-center rounded-md px-1 py-1.5 text-center leading-tight transition-colors",
                  isSel
                    ? "bg-[var(--color-ink)] text-[var(--color-bg)]"
                    : "bg-[var(--color-surface-2)] text-[var(--color-ink)]",
                )}
              >
                <div className="text-base">{item.categoryIcon}</div>
                <div className="font-display text-sm tabular leading-none">
                  {money(item.amount, { whole: item.amount >= 100 })}
                </div>
                <div
                  className={cn(
                    "mt-0.5 line-clamp-1 text-[9px] opacity-80",
                  )}
                >
                  {item.merchant ?? item.categoryName}
                </div>
              </motion.button>
            );
          })}
        </motion.div>
      </section>

      <section className="mt-5 px-5">
        <div className="mb-3 flex items-center justify-center gap-2">
          <span className="text-xs uppercase tracking-wider text-[var(--color-ink-3)]">
            Mistakes
          </span>
          {Array.from({ length: MAX_MISTAKES }).map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-2.5 w-2.5 rounded-full transition-colors",
                i < MAX_MISTAKES - state.mistakes
                  ? "bg-[var(--color-ink)]"
                  : "bg-[var(--color-line)]",
              )}
            />
          ))}
        </div>

        {!state.done ? (
          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={shuffle}
              className="flex items-center gap-1 rounded-full border border-[var(--color-line)] px-4 py-2 text-sm"
            >
              <Shuffle className="size-3.5" /> Shuffle
            </button>
            <button
              type="button"
              onClick={deselect}
              disabled={selected.length === 0}
              className="rounded-full border border-[var(--color-line)] px-4 py-2 text-sm disabled:opacity-40"
            >
              Deselect
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={selected.length !== 4}
              className="rounded-full bg-[var(--color-ink)] px-5 py-2 text-sm font-medium text-[var(--color-bg)] disabled:opacity-40"
            >
              Submit
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={reset}
              className="flex items-center gap-1 rounded-full border border-[var(--color-line)] px-4 py-2 text-sm"
            >
              <RotateCcw className="size-3.5" /> Try again
            </button>
            <Link
              href="/"
              className="rounded-full bg-[var(--color-ink)] px-5 py-2 text-sm font-medium text-[var(--color-bg)]"
            >
              Home
            </Link>
          </div>
        )}
      </section>

      <section className="mt-6 px-5 text-center text-xs text-[var(--color-ink-3)]">
        How well do you remember last month? · 4 mistakes allowed
      </section>

      {toast && (
        <div className="fixed left-1/2 top-24 z-50 -translate-x-1/2 rounded-full bg-[var(--color-ink)] px-4 py-2 text-xs text-[var(--color-bg)] shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

function SolvedBar({ group }: { group: WeekGroup }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 380, damping: 26 }}
      className="rounded-md px-3 py-2 text-center text-white"
      style={{ background: TIER_COLORS[group.tier] }}
    >
      <div className="text-[10px] uppercase tracking-widest opacity-90">
        {group.label} · {group.range}
      </div>
      <div className="mt-0.5 flex flex-wrap items-center justify-center gap-x-2 text-[11px] font-medium">
        {group.items.map((it) => (
          <span key={it.id} className="tabular">
            {it.categoryIcon} {money(it.amount, { whole: it.amount >= 100 })}
          </span>
        ))}
      </div>
    </motion.div>
  );
}
